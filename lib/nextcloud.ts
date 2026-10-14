// Server-only: talks to Nextcloud (WebDAV files) and LibreSign (e-signatures)
// as the mis-signing account. Never import this from a client component.

const API = '/ocs/v2.php/apps/libresign/api/v1'

export class NextcloudError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function cfg() {
  const url = (process.env.NEXTCLOUD_URL ?? '').trim().replace(/\/+$/, '')
  const user = (process.env.NEXTCLOUD_USER ?? '').trim()
  const pass = (process.env.NEXTCLOUD_APP_PASSWORD ?? '').trim()
  if (!url || !user || !pass) {
    throw new NextcloudError('Nextcloud is not configured (NEXTCLOUD_URL, NEXTCLOUD_USER, NEXTCLOUD_APP_PASSWORD).', 500)
  }
  return { url, user, auth: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') }
}

export function nextcloudConfigured() {
  return Boolean(process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_USER && process.env.NEXTCLOUD_APP_PASSWORD)
}

export const CLIENT_ROOT = (process.env.ONBOARDING_FOLDER ?? 'MIS Clients').trim() || 'MIS Clients'

function encPath(path: string) {
  return path.split('/').filter(Boolean).map(encodeURIComponent).join('/')
}

function filesUrl(path: string) {
  const c = cfg()
  return `${c.url}/remote.php/dav/files/${encodeURIComponent(c.user)}/${encPath(path)}`
}

type Init = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }

async function request(url: string, init: Init = {}) {
  const c = cfg()
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: c.auth, 'OCS-APIRequest': 'true', ...(init.headers ?? {}) },
    cache: 'no-store',
  })
  return res
}

// ---------------------------------------------------------------- files

/** Creates every folder along the path. Existing folders are fine. */
export async function ensureFolder(path: string) {
  const parts = path.split('/').filter(Boolean)
  let cur = ''
  for (const p of parts) {
    cur = cur ? `${cur}/${p}` : p
    const res = await request(filesUrl(cur), { method: 'MKCOL' })
    if (!(res.ok || res.status === 405)) {
      throw new NextcloudError(`Could not create folder ${cur} (HTTP ${res.status})`, res.status)
    }
  }
}

export async function putFile(path: string, body: Buffer | Uint8Array | string, contentType = 'application/octet-stream') {
  const res = await request(filesUrl(path), {
    method: 'PUT',
    body: typeof body === 'string' ? body : new Uint8Array(body),
    headers: { 'Content-Type': contentType },
  })
  if (!res.ok) throw new NextcloudError(`Could not save ${path} (HTTP ${res.status})`, res.status)
}

export async function getFile(path: string): Promise<Buffer | null> {
  const res = await request(filesUrl(path))
  if (res.status === 404) return null
  if (!res.ok) throw new NextcloudError(`Could not read ${path} (HTTP ${res.status})`, res.status)
  return Buffer.from(await res.arrayBuffer())
}

export async function getJson<T>(path: string): Promise<T | null> {
  const buf = await getFile(path)
  if (!buf) return null
  try {
    return JSON.parse(buf.toString('utf8')) as T
  } catch {
    return null
  }
}

export async function putJson(path: string, data: unknown) {
  await putFile(path, JSON.stringify(data, null, 2), 'application/json')
}

/** Link that opens the folder in Nextcloud for the person it is shared with. */
export function folderWebUrl(path: string) {
  const url = (process.env.NEXTCLOUD_URL ?? '').trim().replace(/\/+$/, '')
  return `${url}/apps/files/files?dir=${encodeURIComponent('/' + path)}`
}

// ---------------------------------------------------------------- chunked uploads
// Vercel limits a request body to 4.5 MB, so the browser sends large files in
// pieces. Nextcloud's chunked upload (v1: no Destination header until the final
// MOVE) assembles them on the server.

function uploadsUrl(uploadId: string, chunk?: string) {
  const c = cfg()
  return `${c.url}/remote.php/dav/uploads/${encodeURIComponent(c.user)}/${encodeURIComponent(uploadId)}${chunk ? '/' + encodeURIComponent(chunk) : ''}`
}

export async function chunkStart(uploadId: string) {
  const res = await request(uploadsUrl(uploadId), { method: 'MKCOL' })
  if (!(res.ok || res.status === 405)) throw new NextcloudError(`Could not start upload (HTTP ${res.status})`, res.status)
}

export async function chunkPut(uploadId: string, index: number, body: Buffer) {
  const name = String(index).padStart(5, '0')
  const res = await request(uploadsUrl(uploadId, name), { method: 'PUT', body: new Uint8Array(body) })
  if (!res.ok) throw new NextcloudError(`Could not upload part ${index} (HTTP ${res.status})`, res.status)
}

export async function chunkFinish(uploadId: string, destPath: string, totalLength: number) {
  const res = await request(uploadsUrl(uploadId, '.file'), {
    method: 'MOVE',
    headers: { Destination: filesUrl(destPath), 'OC-Total-Length': String(totalLength), Overwrite: 'T' },
  })
  if (!res.ok) throw new NextcloudError(`Could not finish upload (HTTP ${res.status})`, res.status)
}

export async function chunkAbort(uploadId: string) {
  try {
    await request(uploadsUrl(uploadId), { method: 'DELETE' })
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- LibreSign

type Ocs<T> = { ocs?: { meta?: { message?: string }; data?: T } }

async function ocs<T>(path: string, init: Init = {}): Promise<T> {
  const c = cfg()
  const res = await request(`${c.url}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) } as Record<string, string>,
  })
  const text = await res.text()
  let json: Ocs<T & { message?: string; errors?: unknown[] }> | null = null
  try {
    json = JSON.parse(text)
  } catch {
    /* not JSON */
  }
  if (!res.ok || !json?.ocs?.data) {
    const d = json?.ocs?.data as { message?: string; errors?: Array<string | { message?: string }> } | undefined
    const parts: string[] = []
    if (d?.message) parts.push(d.message)
    if (Array.isArray(d?.errors)) for (const e of d.errors) parts.push(typeof e === 'string' ? e : e?.message ?? '')
    if (json?.ocs?.meta?.message) parts.push(json.ocs.meta.message)
    const msg = parts.filter(Boolean).join(' — ') || text.slice(0, 200) || `HTTP ${res.status}`
    throw new NextcloudError(`LibreSign: ${msg}`, res.status || 502)
  }
  return json.ocs.data as T
}

export type LibreSignSigner = {
  displayName?: string
  email?: string
  identifyMethods?: { method?: string; value?: string }[]
  signed?: string | null
  sign_date?: string | null
  /** LibreSign only returns this for the signer who is viewing, never to the requester */
  sign_request_uuid?: string
  signRequestId?: number
  signingOrder?: number
  /** Newer LibreSign: sign request status (0 draft, 1 able to sign, 2 signed, 3 rejected, 4 observing) */
  status?: number
  displayStatus?: string
  statusText?: string
}

export type LibreSignFile = {
  id?: number
  uuid: string
  nodeId?: number
  name?: string
  status: number
  statusText?: string
  url?: string
  signatureFlow?: string
  signers?: LibreSignSigner[]
}

export const LS_STATUS = { DRAFT: 0, ABLE_TO_SIGN: 1, PARTIAL: 2, SIGNED: 3, DELETED: 4, IN_PROGRESS: 5, CANCELED: 6 } as const

export type SignerInput =
  | { kind: 'email'; name: string; email: string; order: number; note?: string }
  | { kind: 'account'; name: string; account: string; order: number; note?: string }

export async function libresignRequest(opts: { name: string; pdf: Buffer; signers: SignerInput[]; callback?: string }) {
  const body: Record<string, unknown> = {
    name: opts.name,
    file: { base64: opts.pdf.toString('base64') },
    status: LS_STATUS.ABLE_TO_SIGN,
    signers: opts.signers.map((s) => ({
      displayName: s.name,
      description: s.note,
      identifyMethods: [
        s.kind === 'email'
          ? { method: 'email', value: s.email, requirement: 'required', mandatory: 1 }
          : { method: 'account', value: s.account, requirement: 'required', mandatory: 1 },
      ],
      notify: 1,
      signingOrder: s.order,
    })),
  }
  if (opts.callback) body.callback = opts.callback
  return ocs<LibreSignFile>(`${API}/request-signature`, { method: 'POST', body: JSON.stringify(body) })
}

/** Asks LibreSign to email one signer their signing link again. Only the account that sent the request can do this. */
export async function libresignNotifySigner(fileId: number, signRequestId: number) {
  return ocs<{ message?: string }>(`${API}/notify/signer`, { method: 'POST', body: JSON.stringify({ fileId, signRequestId }) })
}

export async function libresignValidate(uuid: string) {
  return ocs<LibreSignFile>(`${API}/file/validate/uuid/${encodeURIComponent(uuid)}`)
}

/** Downloads the current PDF for a LibreSign file (signed once status is SIGNED). */
export async function libresignDownload(file: LibreSignFile): Promise<Buffer | null> {
  const c = cfg()
  const candidates: string[] = []
  if (file.url) candidates.push(new URL(file.url, c.url + '/').toString())
  candidates.push(`${c.url}/index.php/apps/libresign/p/pdf/${encodeURIComponent(file.uuid)}`)
  for (const url of candidates) {
    const res = await request(url, { headers: { Accept: 'application/pdf,*/*' } })
    if (!res.ok) continue
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.subarray(0, 5).toString() === '%PDF-') return buf
  }
  return null
}

/** LibreSign's public page where anyone can check a signed document by its file uuid. */
export function validationPageUrl(fileUuid: string) {
  const c = cfg()
  return `${c.url}/index.php/apps/libresign/p/validation/${encodeURIComponent(fileUuid)}`
}

export function signingPageUrl(signRequestUuid: string) {
  const c = cfg()
  return `${c.url}/index.php/apps/libresign/p/sign/${encodeURIComponent(signRequestUuid)}`
}
