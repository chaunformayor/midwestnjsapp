// One local server that pretends to be Supabase (PostgREST + Auth), Nextcloud
// (WebDAV + chunked uploads), LibreSign, and Amazon SES. For local testing only.
import http from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = 8899
const db = { onboarding_engagements: [], onboarding_people: [], onboarding_reviews: [], onboarding_settings: [{ id: 1, entity_type: '', office_address: '', signer_name: 'Chaun', signer_title: '' }], profiles: [{ id: 'admin-1', email: 'admin@example.com', role: 'admin' }] }
const files = new Map() // path -> Buffer
const dirs = new Set()
const uploads = new Map() // id -> Map(name -> Buffer)
const ls = new Map() // uuid -> file
const emails = []
const anthropic = [] // requests the site made to the (pretend) Anthropic API
const log = []
const NC_USER = 'mis-signing'
const AUTH = 'Basic ' + Buffer.from('mis-signing:app-pass').toString('base64')

const send = (res, code, body, headers = {}) => {
  const isBuf = Buffer.isBuffer(body)
  res.writeHead(code, { 'Content-Type': isBuf ? 'application/octet-stream' : 'application/json', ...headers })
  res.end(isBuf ? body : body === undefined ? '' : JSON.stringify(body))
}
const ocs = (res, code, data) => send(res, code, { ocs: { meta: { status: code < 300 ? 'ok' : 'failure', statuscode: code, message: code < 300 ? 'OK' : 'error' }, data } })

// ---------- PostgREST
function parseFilters(sp) {
  const f = []
  for (const [k, v] of sp.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
    const m = v.match(/^(eq|in|neq)\.(.*)$/)
    if (!m) continue
    let val = m[2]
    if (m[1] === 'in') val = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''))
    f.push({ k, op: m[1], val })
  }
  return f
}
const match = (row, f) => f.every(({ k, op, val }) => (op === 'eq' ? String(row[k]) === val : op === 'neq' ? String(row[k]) !== val : val.includes(String(row[k]))))
function respondRows(req, res, rows, code = 200) {
  const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object')
  if (wantsObject) {
    if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null })
    return send(res, code, rows[0])
  }
  return send(res, code, rows)
}
function defaults(table, row) {
  const now = new Date().toISOString()
  if (table === 'onboarding_engagements') {
    return { id: randomUUID(), status: 'invited', modules: [], pay_methods: [], fees: {}, docs_total: 0, docs_done: 0, invited_at: now, last_activity_at: now, created_at: now, updated_at: now,
      spouse_name: null, spouse_email: null, sign_details: null, libresign_uuid: null, libresign_status: null, signers_status: null, nextcloud_folder: null, questionnaire_part: null,
      sent_for_signature_at: null, signed_at: null, submitted_at: null, created_by: null, token_enc: null, ...row }
  }
  if (table === 'onboarding_reviews') {
    return { id: randomUUID(), created_by: null, model: '', weights: {}, scores: {}, review: {}, included: [], client_pdf_at: null, created_at: now + Math.random().toString().slice(1, 4), updated_at: now, ...row }
  }
  if (table === 'onboarding_people') {
    return { id: randomUUID(), token_hash: null, token_enc: null, nextcloud_folder: null, questionnaire_part: null, docs_total: 0, docs_done: 0, submitted_at: null,
      last_activity_at: now, created_at: now, updated_at: now, ...row }
  }
  return { ...row }
}

async function rest(req, res, table, url, body) {
  const t = db[table]
  if (!t) return send(res, 404, { message: 'no table ' + table })
  const f = parseFilters(url.searchParams)
  if (req.method === 'GET' || req.method === 'HEAD') {
    let rows = t.filter((r) => match(r, f))
    const order = url.searchParams.get('order')
    if (order) {
      const [col, dir] = order.split('.')
      rows = [...rows].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === 'desc' ? -1 : 1))
    }
    const limit = Number(url.searchParams.get('limit') || 0)
    if (limit) rows = rows.slice(0, limit)
    return respondRows(req, res, rows)
  }
  const data = body ? JSON.parse(body) : {}
  if (req.method === 'POST') {
    const prefer = req.headers.prefer || ''
    const list = Array.isArray(data) ? data : [data]
    // Like PostgREST: in a multi-row insert, a column one row leaves out is sent as NULL (not its default) for that row
    if (list.length > 1) {
      const keys = new Set(list.flatMap((r) => Object.keys(r)))
      for (const r of list) for (const k of keys) if (!(k in r)) r[k] = null
    }
    const out = []
    for (const row of list) {
      if (prefer.includes('merge-duplicates')) {
        const existing = t.find((r) => r.id === row.id)
        if (existing) { Object.assign(existing, row, { updated_at: new Date().toISOString() }); out.push(existing); continue }
      }
      if (table === 'onboarding_engagements' && t.some((r) => r.token_hash === row.token_hash)) return send(res, 409, { message: 'duplicate token_hash' })
      if (table === 'onboarding_people' && (t.some((r) => r.engagement_id === row.engagement_id && r.role === row.role) || (row.token_hash && t.some((r) => r.token_hash === row.token_hash)))) return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' })
      const r = defaults(table, row)
      t.push(r)
      out.push(r)
    }
    return respondRows(req, res, out, 201)
  }
  if (req.method === 'PATCH') {
    const rows = t.filter((r) => match(r, f))
    rows.forEach((r) => Object.assign(r, data, { updated_at: new Date().toISOString() }))
    return respondRows(req, res, rows)
  }
  return send(res, 405, {})
}

// ---------- WebDAV
const filesPrefix = `/remote.php/dav/files/${NC_USER}/`
const uploadsPrefix = `/remote.php/dav/uploads/${NC_USER}/`
function dav(req, res, path, body) {
  const p = decodeURIComponent(path).replace(/\/+$/, '')
  if (req.method === 'MKCOL') {
    if (dirs.has(p)) return send(res, 405, undefined)
    const parent = p.split('/').slice(0, -1).join('/')
    if (parent && !dirs.has(parent)) return send(res, 409, undefined)
    dirs.add(p)
    return send(res, 201, undefined)
  }
  if (req.method === 'PUT') {
    const parent = p.split('/').slice(0, -1).join('/')
    if (parent && !dirs.has(parent)) return send(res, 409, undefined)
    files.set(p, body)
    return send(res, 201, undefined)
  }
  if (req.method === 'GET') {
    const f = files.get(p)
    return f ? send(res, 200, f) : send(res, 404, undefined)
  }
  return send(res, 405, undefined)
}
function chunks(req, res, rest, body) {
  const [id, name] = rest.split('/').map(decodeURIComponent)
  if (req.method === 'MKCOL' && !name) {
    if (req.headers.destination) return send(res, 400, { error: 'test mock expects v1 (no Destination on MKCOL)' })
    uploads.set(id, new Map())
    return send(res, 201, undefined)
  }
  const up = uploads.get(id)
  if (!up) return send(res, 404, undefined)
  if (req.method === 'PUT') { up.set(name, body); return send(res, 201, undefined) }
  if (req.method === 'MOVE' && name === '.file') {
    const dest = new URL(req.headers.destination)
    const p = decodeURIComponent(dest.pathname.slice(filesPrefix.length)).replace(/\/+$/, '')
    const buf = Buffer.concat([...up.keys()].sort().map((k) => up.get(k)))
    if (Number(req.headers['oc-total-length']) !== buf.length) return send(res, 400, { error: 'length mismatch' })
    files.set(p, buf)
    uploads.delete(id)
    return send(res, 201, undefined)
  }
  if (req.method === 'DELETE') { uploads.delete(id); return send(res, 204, undefined) }
  return send(res, 405, undefined)
}

// ---------- LibreSign
function lsView(f) {
  return {
    id: f.id, uuid: f.uuid, nodeId: f.nodeId, name: f.name, status: f.status, statusText: ['Draft', 'Ready to sign', 'Partially signed', 'Signed'][f.status] || String(f.status),
    signatureFlow: 'ordered_numeric', url: `/index.php/apps/libresign/p/pdf/${f.uuid}`,
    signers: [...f.signers.map((s) => ({ signRequestId: s.id, displayName: s.displayName, email: s.method === 'account' ? ACCOUNT_EMAIL : s.email, identifyMethods: [{ method: s.method, value: s.value, requirement: 'required' }], signed: s.signed, signingOrder: s.signingOrder, me: false, status: s.signed ? 2 : 1 })),
      ...f.signers.filter((s) => s.signed).map((s) => ({ uid: 'email:' + s.value, displayName: s.displayName, signed: s.signed }))],
  }
}
async function signAll(uuid) {
  const f = ls.get(uuid)
  if (!f) return false
  f.signers.forEach((s) => { s.signed = new Date().toISOString() })
  f.status = 3
  if (f.callback) {
    const form = new FormData()
    form.set('uuid', f.uuid)
    form.set('status', '3')
    form.set('file', new Blob([signedPdf(f)], { type: 'application/pdf' }), 'signed.pdf')
    const r = await fetch(f.callback, { method: 'POST', body: form })
    log.push(`callback -> ${r.status} ${await r.text()}`)
  }
  return true
}
// Like a real setup where the tester's own address is also on the MIS Nextcloud account
const ACCOUNT_EMAIL = 'jordan@example.com'
const notifies = []
let nextSignRequestId = 500
const signedPdf = (f) => Buffer.concat([f.pdf, Buffer.from('\n% signed by mock /ByteRange [0 1 2 3]\n')])

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  const chunksIn = []
  for await (const c of req) chunksIn.push(c)
  const raw = Buffer.concat(chunksIn)
  const p = url.pathname
  log.push(`${req.method} ${p}${url.search.length > 120 ? url.search.slice(0, 120) + '…' : url.search}`)

  // mock controls
  if (p === '/__mock/state') return send(res, 200, { db, files: [...files.keys()].map((k) => [k, files.get(k).length]), dirs: [...dirs], emails, notifies, anthropic, ls: [...ls.values()].map(lsView), log: log.slice(-80) })
  if (p === '/__mock/sign-one') {
    const f = [...ls.values()].pop(); const s = f.signers[Number(url.searchParams.get('i') || 0)]
    s.signed = new Date().toISOString(); f.status = 2
    return send(res, 200, { ok: true })
  }
  if (p === '/__mock/sign-all') return send(res, 200, { ok: await signAll(url.searchParams.get('uuid') || [...ls.keys()].pop()) })
  if (p === '/__mock/file') { const f = files.get(url.searchParams.get('path')); return f ? send(res, 200, f) : send(res, 404, {}) }

  // SMTP sink forwards here
  if (p === '/__mock/smtp') { const b = JSON.parse(raw.toString()); emails.push({ ...b, via: 'smtp' }); return send(res, 200, { ok: true }) }

  // SES v2
  if (p === '/v2/email/outbound-emails') {
    const b = JSON.parse(raw.toString() || '{}')
    emails.push({ to: b.Destination?.ToAddresses, subject: b.Content?.Simple?.Subject?.Data, html: b.Content?.Simple?.Body?.Html?.Data })
    return send(res, 200, { MessageId: randomUUID() })
  }

  // Anthropic Messages API (the AI review)
  if (p === '/v1/messages' && req.method === 'POST') {
    const b = JSON.parse(raw.toString() || '{}')
    anthropic.push({ headers: { beta: req.headers['anthropic-beta'], key: req.headers['x-api-key'] }, body: b })
    const review = {
      summary: 'Mock review summary.',
      priorities: [
        { id: 'r1', title: 'Move the condo into an LLC', rationale: 'Held in sole name and used as a short-term rental.', dimension: 'liability', urgency: 'now', owner: 'attorney', next_step: 'Ask the attorney about an LLC.', confidence: 'high', client_text: 'Your condo is a short-term rental owned in your own name. Ask your attorney whether an LLC makes sense.' },
        { id: 'r2', title: 'Sign a will', rationale: 'No will on file.', dimension: 'estate', urgency: 'soon', owner: 'attorney', next_step: 'Schedule a will.', confidence: 'medium', client_text: 'A will keeps your wishes clear for your family.' },
      ],
      couple_notes: [{ topic: 'How title is held', detail: 'They answered differently.', suggested_question: 'How is title actually held?' }],
      missing_information: ['Insurance policy'],
      meeting_questions: ['What worries you most?'],
      cautions: ['Do not promise liability protection.'],
    }
    return send(res, 200, { id: 'msg_mock', type: 'message', role: 'assistant', model: b.model, content: [{ type: 'text', text: JSON.stringify(review) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } })
  }

  // Supabase auth
  if (p === '/auth/v1/user') {
    if ((req.headers.authorization || '') !== 'Bearer ' + TEST_ACCESS) return send(res, 401, { message: 'invalid token' })
    return send(res, 200, { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })
  }
  if (p.startsWith('/rest/v1/')) return rest(req, res, p.slice('/rest/v1/'.length), url, raw.toString())

  // Nextcloud
  if (req.headers.authorization !== AUTH && (p.startsWith('/remote.php') || p.startsWith('/ocs') || p.startsWith('/index.php'))) return send(res, 401, { message: 'bad auth' })
  if (p.startsWith(filesPrefix)) return dav(req, res, p.slice(filesPrefix.length), raw)
  if (p.startsWith(uploadsPrefix)) return chunks(req, res, p.slice(uploadsPrefix.length), raw)

  if (p === '/ocs/v2.php/apps/libresign/api/v1/request-signature' && req.method === 'POST') {
    const b = JSON.parse(raw.toString())
    const pdf = Buffer.from(b.file.base64, 'base64')
    if (pdf.subarray(0, 5).toString() !== '%PDF-') return ocs(res, 422, { message: 'Invalid file' })
    const f = {
      id: ls.size + 1, nodeId: 1000 + ls.size, uuid: randomUUID(), name: b.name, status: 1, callback: b.callback, pdf,
      signers: b.signers.map((s) => ({ id: nextSignRequestId++, displayName: s.displayName, method: s.identifyMethods[0].method, value: s.identifyMethods[0].value, email: s.identifyMethods[0].method === 'email' ? s.identifyMethods[0].value : '', signed: null, sign_request_uuid: randomUUID(), signingOrder: s.signingOrder })),
    }
    ls.set(f.uuid, f)
    return ocs(res, 200, lsView(f))
  }
  if (p === '/ocs/v2.php/apps/libresign/api/v1/notify/signer' && req.method === 'POST') {
    const b = JSON.parse(raw.toString() || '{}')
    const f = [...ls.values()].find((x) => x.id === b.fileId)
    const sr = f?.signers.find((x) => x.id === b.signRequestId)
    if (!f || !sr) return ocs(res, 401, { messages: [{ type: 'danger', message: 'Invalid data to sign file' }] })
    notifies.push({ fileId: f.id, signRequestId: sr.id, to: sr.value })
    return ocs(res, 200, { message: 'Notification sent with success.' })
  }
  const vm = p.match(/^\/ocs\/v2\.php\/apps\/libresign\/api\/v1\/file\/validate\/uuid\/(.+)$/)
  if (vm) { const f = ls.get(decodeURIComponent(vm[1])); return f ? ocs(res, 200, lsView(f)) : ocs(res, 404, { message: 'not found' }) }
  const pm = p.match(/^\/index\.php\/apps\/libresign\/p\/pdf\/(.+)$/)
  if (pm) { const f = ls.get(decodeURIComponent(pm[1])); return f ? send(res, 200, f.status === 3 ? signedPdf(f) : f.pdf, { 'Content-Type': 'application/pdf' }) : send(res, 404, {}) }

  send(res, 404, { message: 'mock: no route ' + req.method + ' ' + p })
})

// A fake but well-formed JWT; the mock auth endpoint accepts exactly this token.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
export const TEST_ACCESS = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'admin-1', role: 'authenticated', exp: 4102444800, aud: 'authenticated', email: 'admin@example.com' })}.sig`
server.listen(PORT, '127.0.0.1', () => console.log('mock listening', PORT, '\nACCESS', TEST_ACCESS))
