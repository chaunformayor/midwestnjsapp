// Server-only business logic for client onboarding. API routes stay thin and
// call into here.

import { format } from 'date-fns'
import {
  ENGAGEMENT_TYPES, PAY_OPTIONS, firstName, householdName, missingFees, missingSettings,
  type EngagementType, type Fees, type MisSettings, type ModuleId,
} from './config'
import { engagementAgreement, ndaAgreement, hasBlanks, type AgreementContext } from './agreements'
import { agreementsPdf, questionnairePdf } from './pdf'
import { buildParts, docItems, docsDone, summarize, validatePart, type Answers, type DocState, EMPTY_ANSWERS } from './questionnaire'
import {
  type LibreSignSigner, NextcloudError, ensureFolder, putFile, getJson, putJson, folderWebUrl, libresignRequest, libresignValidate, libresignDownload, libresignNotifySigner,
  signingPageUrl, LS_STATUS, chunkStart, chunkPut, chunkFinish, chunkAbort, type LibreSignFile, type SignerInput,
} from '@/lib/nextcloud'
import {
  type Engagement, type SignDetails, PATHS, clientFolderName, clientLink, callbackUrl, decryptToken, encryptToken,
  getEngagement, getSettings, hashToken, insertEngagement, newToken, safeFileName, siteUrl, updateEngagement,
} from './server'
import { sendOnboardingInvite, sendOnboardingSigned, sendOnboardingSubmitted } from '@/lib/ses'

export class UserError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const emailOk = (v: unknown) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// ---------------------------------------------------------------- admin: create

export type CreateInput = {
  client_name: string
  client_email: string
  spouse_name?: string
  spouse_email?: string
  engagement_type: EngagementType
  focus: string
  modules: ModuleId[]
  fees: Fees
  pay_methods: string[]
  send_email: boolean
}

export async function createEngagement(input: CreateInput, adminId: string) {
  const errors: string[] = []
  const client_name = str(input.client_name, 120)
  const client_email = str(input.client_email, 200).toLowerCase()
  const spouse_name = str(input.spouse_name, 120)
  const spouse_email = str(input.spouse_email, 200).toLowerCase()
  if (!client_name) errors.push("Enter the client's name.")
  if (!emailOk(client_email)) errors.push('Enter a valid client email.')
  if (spouse_name && !emailOk(spouse_email)) errors.push('Enter a valid email for the spouse or co-owner, or clear their name.')
  const type: EngagementType = input.engagement_type in ENGAGEMENT_TYPES ? input.engagement_type : 'custom'
  const focus = str(input.focus, 600)
  if (!focus) errors.push('Enter the engagement focus.')
  const modules = (input.modules ?? []).filter((m): m is ModuleId => ['investing', 'finances', 'estate'].includes(m))
  const fees = Object.fromEntries(Object.entries(input.fees ?? {}).map(([k, v]) => [k, str(v, 40)])) as Fees
  const pay_methods = (input.pay_methods ?? []).map((p) => str(p, 60)).filter(Boolean)
  const missing = missingFees(fees, pay_methods)
  if (missing.length) errors.push(`Fill in: ${missing.join(', ')}.`)
  const settings = await getSettings()
  const missingS = missingSettings(settings)
  if (missingS.length) errors.push(`Fill in the MIS business details: ${missingS.join(', ')}.`)
  if (errors.length) throw new UserError(errors.join(' '))

  const token = newToken()
  const e = await insertEngagement({
    token_hash: hashToken(token),
    token_enc: encryptToken(token),
    client_name, client_email,
    spouse_name: spouse_name || null,
    spouse_email: spouse_name ? spouse_email : null,
    engagement_type: type, focus, modules, fees, pay_methods,
    status: 'invited',
    created_by: adminId,
  })

  const link = clientLink(token)
  let emailed = false
  if (input.send_email) emailed = await emailInvite(e, link)
  return { engagement: e, link, emailed }
}

async function emailInvite(e: Engagement, link: string) {
  try {
    await sendOnboardingInvite({ to: e.client_email, firstName: firstName(e.client_name), link, engagement: ENGAGEMENT_TYPES[e.engagement_type].label })
    return true
  } catch (err) {
    console.error('onboarding invite email failed', err)
    return false
  }
}

export function linkFor(e: Engagement) {
  const token = decryptToken(e.token_enc)
  return token ? clientLink(token) : null
}

export async function resendInvite(e: Engagement) {
  const link = linkFor(e)
  if (!link) throw new UserError('This link can no longer be shown. Make a new link instead.')
  if (!(await emailInvite(e, link))) throw new UserError('The email could not be sent. Check the email settings and try again.', 502)
}

export async function replaceLink(e: Engagement, sendEmail: boolean) {
  const token = newToken()
  const updated = await updateEngagement(e.id, { token_hash: hashToken(token), token_enc: encryptToken(token) })
  if (!updated) throw new UserError('Client not found.', 404)
  const link = clientLink(token)
  const emailed = sendEmail ? await emailInvite(updated, link) : false
  return { link, emailed }
}

// ---------------------------------------------------------------- client: view

export type ClientView = {
  client_name: string
  client_email: string
  spouse_name: string | null
  spouse_email: string | null
  engagement_type: EngagementType
  focus: string
  modules: ModuleId[]
  fees: Fees
  pay_methods: string[]
  status: Engagement['status']
  sign_details: SignDetails | null
  signers: { name: string; email: string; signed_at: string | null; signUrl: string | null }[]
  signed_at: string | null
  submitted_at: string | null
  mis: MisSettings
  answers: Answers
  part: string | null
  docs: DocState
  storageError: boolean
}

export async function clientView(e: Engagement): Promise<ClientView> {
  if (e.status === 'signing') e = (await refreshSigning(e)) ?? e
  const mis = e.sign_details?.mis ?? (await getSettings())
  let answers: Answers = EMPTY_ANSWERS
  let part: string | null = e.questionnaire_part
  let docs: DocState = {}
  let storageError = false
  if (e.nextcloud_folder) {
    try {
      const saved = await getJson<{ answers: Answers; part?: string }>(PATHS.answers(e.nextcloud_folder))
      if (saved?.answers) {
        answers = { v: saved.answers.v ?? {}, props: saved.answers.props ?? [] }
        part = saved.part ?? part
      }
      docs = (await getJson<DocState>(PATHS.checklist(e.nextcloud_folder))) ?? {}
    } catch (err) {
      console.error('onboarding: could not read from Nextcloud', err)
      storageError = true
    }
  }
  return {
    client_name: e.client_name,
    client_email: e.client_email,
    spouse_name: e.spouse_name,
    spouse_email: e.spouse_email,
    engagement_type: e.engagement_type,
    focus: e.focus,
    modules: e.modules,
    fees: e.fees,
    pay_methods: e.pay_methods,
    status: e.status,
    sign_details: e.sign_details,
    signers: (e.signers_status ?? []).filter((s) => s.email).map((s) => ({
      name: s.name,
      email: s.email ?? '',
      signed_at: s.signed_at,
      signUrl: !s.signed_at && s.sign_request_uuid && e.status === 'signing' ? safeSigningUrl(s.sign_request_uuid) : null,
    })),
    signed_at: e.signed_at,
    submitted_at: e.submitted_at,
    mis,
    answers,
    part,
    docs,
    storageError,
  }
}

function safeSigningUrl(uuid: string) {
  try {
    return signingPageUrl(uuid)
  } catch {
    return null
  }
}

async function ensureClientFolder(e: Engagement, force = false): Promise<string> {
  if (e.nextcloud_folder && !force) return e.nextcloud_folder
  const folder = e.nextcloud_folder || clientFolderName(e)
  await ensureFolder(PATHS.agreements(folder))
  await ensureFolder(PATHS.questionnaire(folder))
  await ensureFolder(PATHS.documents(folder))
  if (!e.nextcloud_folder) {
    await updateEngagement(e.id, { nextcloud_folder: folder })
    e.nextcloud_folder = folder
  }
  return folder
}

/** Runs a write; if Nextcloud says a folder is missing (someone deleted it), recreates the folders and retries once. */
async function withFolders<T>(e: Engagement, op: (folder: string) => Promise<T>): Promise<T> {
  const folder = await ensureClientFolder(e)
  try {
    return await op(folder)
  } catch (err) {
    if (err instanceof NextcloudError && (err.status === 409 || err.status === 404)) {
      return op(await ensureClientFolder(e, true))
    }
    throw err
  }
}

// ---------------------------------------------------------------- client: signing

export function agreementContext(e: Pick<Engagement, 'focus' | 'fees' | 'pay_methods'>, d: Omit<SignDetails, 'email1' | 'email2'> & { name2?: string }): AgreementContext {
  return {
    date: d.date,
    mis: d.mis,
    signers: [{ name: d.name1 }, ...(d.name2 ? [{ name: d.name2 }] : [])],
    clientAddress: d.address,
    payOption: d.payOption,
    focus: e.focus,
    fees: e.fees,
    payMethods: e.pay_methods,
  }
}

export async function startSigning(e: Engagement, body: Record<string, unknown>) {
  if (e.status === 'canceled') throw new UserError('This onboarding was canceled. Please contact us.', 409)
  if (e.status !== 'invited') throw new UserError('The agreements were already sent for signature.', 409)

  const hasSpouse = Boolean(e.spouse_name)
  const d = {
    name1: str(body.name1, 120),
    email1: str(body.email1, 200).toLowerCase(),
    name2: hasSpouse ? str(body.name2, 120) : '',
    email2: hasSpouse ? str(body.email2, 200).toLowerCase() : '',
    address: str(body.address, 300),
    payOption: str(body.payOption, 120),
  }
  const m: string[] = []
  if (!d.name1) m.push('Enter your full legal name.')
  if (!emailOk(d.email1)) m.push('Enter a valid email.')
  if (hasSpouse && !d.name2) m.push("Enter the spouse or co-owner's legal name.")
  if (hasSpouse && !emailOk(d.email2)) m.push('Enter a valid email for the spouse or co-owner.')
  if (hasSpouse && d.email2 && d.email2 === d.email1) m.push('Each signer needs their own email address.')
  if (!d.address) m.push('Enter your home address.')
  if (!(PAY_OPTIONS as readonly string[]).includes(d.payOption)) m.push('Choose a Phase 1 payment option.')
  if (body.read !== true) m.push('Confirm you have read both agreements.')
  if (m.length) throw new UserError(m.join(' '))

  const mis = await getSettings()
  const details: SignDetails = { ...d, name2: d.name2 || undefined, email2: d.email2 || undefined, date: format(new Date(), 'MMMM d, yyyy'), mis }
  const ctx = agreementContext(e, details)
  const eng = engagementAgreement(ctx)
  const nda = ndaAgreement(ctx)
  if (hasBlanks(eng) || hasBlanks(nda)) {
    throw new UserError("Something is missing from the agreement on our side. We've been notified; please call us at 636-590-7698.", 500)
  }
  const pdf = await agreementsPdf(eng, nda)

  await withFolders(e, (folder) => putFile(PATHS.unsigned(folder), pdf, 'application/pdf'))

  const signers: SignerInput[] = [{ kind: 'email', name: d.name1, email: d.email1, order: 1, note: 'Please review and sign the Engagement Agreement and NDA.' }]
  if (hasSpouse) signers.push({ kind: 'email', name: d.name2, email: d.email2, order: 1, note: 'Please review and sign the Engagement Agreement and NDA.' })
  const misAccount = (process.env.MIS_SIGNER_ACCOUNT ?? '').trim()
  if (misAccount) signers.push({ kind: 'account', name: 'Midwest Investor Services', account: misAccount, order: 2 })
  else console.warn('onboarding: MIS_SIGNER_ACCOUNT is not set, so MIS will not countersign')

  const file = await libresignRequest({
    name: `${householdName(d.name1, d.name2)} — Engagement Agreement and NDA`,
    pdf,
    signers,
    callback: callbackUrl(e.id),
  })

  console.info('onboarding: sent for signature', JSON.stringify({
    engagement: e.id, file: file.id, status: file.status, flow: file.signatureFlow,
    signers: (file.signers ?? []).map((x) => ({ order: x.signingOrder, methods: (x.identifyMethods ?? []).map((m) => m.method), id: x.signRequestId })),
  }))

  const updated = await updateEngagement(e.id, {
    status: 'signing',
    sign_details: details,
    libresign_uuid: file.uuid,
    libresign_status: file.status,
    signers_status: signersFrom(file, details),
    sent_for_signature_at: new Date().toISOString(),
  }, ['invited'])
  return updated ?? e
}

/**
 * Normalizes LibreSign's signer list. Clients sign by email; MIS signs with its
 * Nextcloud account. LibreSign versions differ in which fields they return, so
 * this falls back from identify methods, to signing order, to position.
 * LibreSign never gives the requester a signer's own link (sign_request_uuid),
 * so clients get their link by email; signRequestId lets us re-send it.
 */
function signersFrom(file: LibreSignFile, d: Pick<SignDetails, 'email1' | 'email2'>): NonNullable<Engagement['signers_status']> {
  const known = [d.email1, d.email2].filter(Boolean).map((x) => String(x).toLowerCase())
  const all = file.signers ?? []
  // Partly signed files can also list signatures read from the PDF itself; those
  // have no sign request id and would show up as extra signers.
  const list = all.some((x) => typeof x.signRequestId === 'number') ? all.filter((x) => typeof x.signRequestId === 'number') : all
  const misAccount = (process.env.MIS_SIGNER_ACCOUNT ?? '').trim().toLowerCase()
  return list.map((s, i) => {
    const im = s.identifyMethods ?? []
    const byEmail = (im.find((m) => m.method === 'email')?.value ?? '').toLowerCase()
    const byAccount = (im.find((m) => m.method === 'account')?.value ?? '').toLowerCase()
    const email = byEmail || (s.email ?? '').toLowerCase()
    let isMis: boolean
    if (byAccount && misAccount && byAccount === misAccount) isMis = true
    else if (byEmail) isMis = false // MIS always signs with its account, never by email
    else if (im.length) isMis = Boolean(byAccount)
    else if (email) isMis = !known.includes(email)
    else if (typeof s.signingOrder === 'number') isMis = Boolean(misAccount) && s.signingOrder > 1
    else isMis = Boolean(misAccount) && i === list.length - 1
    return {
      name: s.displayName || email || (isMis ? 'Midwest Investor Services' : 'Signer'),
      email: isMis ? undefined : email || known[i] || d.email1,
      signed_at: signedAt(s),
      sign_request_uuid: s.sign_request_uuid,
      sign_request_id: typeof s.signRequestId === 'number' ? s.signRequestId : undefined,
    }
  })
}

/** When a signer signed; falls back to the status fields newer LibreSign versions send. */
function signedAt(s: LibreSignSigner): string | null {
  const when = s.signed || s.sign_date
  if (when) return when
  const signed = s.status === 2 || /^signed$/i.test(s.displayStatus ?? '') || /^signed$/i.test(s.statusText ?? '')
  return signed ? SIGNED_UNKNOWN_TIME : null
}
const SIGNED_UNKNOWN_TIME = 'signed'

/** One line per signer, as LibreSign reports it. For the admin page and the logs. */
export async function describeSigning(e: Engagement): Promise<string> {
  if (!e.libresign_uuid) return 'Not sent to LibreSign yet.'
  const file = await libresignValidate(e.libresign_uuid)
  const signers = file.signers ?? []
  console.info('onboarding: LibreSign status', JSON.stringify({
    engagement: e.id, file: file.id, status: file.status, flow: file.signatureFlow,
    signers: signers.map((x) => ({
      id: x.signRequestId, order: x.signingOrder, methods: (x.identifyMethods ?? []).map((m) => m.method),
      signed: Boolean(x.signed || x.sign_date), status: x.status, displayStatus: x.displayStatus, keys: Object.keys(x).sort(),
    })),
  }))
  const fileText = file.statusText || (['Draft', 'Ready to sign', 'Partly signed', 'Signed'][file.status] ?? `status ${file.status}`)
  const people = signers.map((x) => `${x.displayName || 'Signer'}: ${x.signed || x.sign_date || signedAt(x) ? 'signed' : x.statusText || 'not signed yet'}`)
  return `LibreSign says the document is "${fileText}". ${people.join('; ')}.`
}

const RESEND_WAIT_MS = 60_000

/**
 * Asks LibreSign to email the signing link again to every client signer who
 * hasn't signed yet. Returns the addresses it was sent to.
 */
export async function resendSigningEmail(e: Engagement): Promise<{ sentTo: string[]; engagement: Engagement }> {
  if (e.status !== 'signing' || !e.libresign_uuid) throw new UserError('There is nothing waiting to be signed right now.', 409)
  const details = e.sign_details
  if (!details) throw new UserError('The signing details are missing. Ask Midwest Investor Services to reset signing.', 409)
  const last = details.reminded_at ? Date.parse(details.reminded_at) : 0
  if (last && Date.now() - last < RESEND_WAIT_MS) {
    throw new UserError('The signing email was just sent. Give it a minute or two, and check your spam folder.', 429)
  }
  const file = await libresignValidate(e.libresign_uuid)
  if (file.status === LS_STATUS.SIGNED) {
    const done = (await refreshSigning(e)) ?? e
    return { sentTo: [], engagement: done }
  }
  if (typeof file.id !== 'number') throw new NextcloudError('LibreSign: the file id was missing from the status response', 502)
  const pending = signersFrom(file, details).filter((x) => x.email && !x.signed_at && typeof x.sign_request_id === 'number')
  if (!pending.length) throw new UserError('Everyone on your side has signed. Midwest Investor Services signs next.', 409)
  for (const x of pending) await libresignNotifySigner(file.id, x.sign_request_id as number)
  console.info('onboarding: signing email re-sent', JSON.stringify({ engagement: e.id, file: file.id, count: pending.length }))
  const updated = await updateEngagement(e.id, { sign_details: { ...details, reminded_at: new Date().toISOString() } })
  return { sentTo: pending.map((x) => x.email as string), engagement: updated ?? e }
}

/** Checks LibreSign for progress. Finishes up once everyone has signed. */
export async function refreshSigning(e: Engagement, callbackPdf?: Buffer): Promise<Engagement | null> {
  if (e.status !== 'signing' || !e.libresign_uuid) return e
  let file: LibreSignFile
  try {
    file = await libresignValidate(e.libresign_uuid)
  } catch (err) {
    console.error('onboarding: LibreSign status check failed', err)
    return e
  }
  const signers = signersFrom(file, e.sign_details ?? { email1: e.client_email })
  // Keep sign links we already know about if LibreSign leaves them out of this response
  const merged = signers.map((s, i) => ({
    ...s,
    sign_request_uuid: s.sign_request_uuid ?? e.signers_status?.[i]?.sign_request_uuid,
    sign_request_id: s.sign_request_id ?? e.signers_status?.[i]?.sign_request_id,
    signed_at: s.signed_at === SIGNED_UNKNOWN_TIME ? (e.signers_status?.[i]?.signed_at || new Date().toISOString()) : s.signed_at,
  }))
  if (file.status !== LS_STATUS.SIGNED) {
    if (file.status !== e.libresign_status || JSON.stringify(merged) !== JSON.stringify(e.signers_status)) {
      return (await updateEngagement(e.id, { libresign_status: file.status, signers_status: merged })) ?? e
    }
    return e
  }
  // Signed: only one request gets to finish up (callback and page polling can race)
  const done = await updateEngagement(e.id, {
    status: 'signed', libresign_status: file.status, signers_status: merged, signed_at: new Date().toISOString(),
  }, ['signing'])
  if (!done) return (await getEngagement(e.id)) ?? e
  const folder = await ensureClientFolder(done, true)
  try {
    const pdf = (await libresignDownload(file)) ?? callbackPdf ?? null
    if (pdf) await putFile(PATHS.signed(folder), pdf, 'application/pdf')
    else console.error('onboarding: signed PDF could not be downloaded for', e.id)
  } catch (err) {
    console.error('onboarding: saving signed PDF failed', err)
  }
  try {
    await sendOnboardingSigned({
      clientEmail: done.client_email,
      firstName: firstName(done.client_name),
      client: householdName(done.client_name, done.spouse_name),
      link: linkFor(done),
      adminUrl: `${siteUrl()}/admin/onboarding/${done.id}`,
      folderUrl: folderWebUrl(folder),
    })
  } catch (err) {
    console.error('onboarding: signed email failed', err)
  }
  return done
}

// ---------------------------------------------------------------- client: questionnaire

function cleanAnswers(raw: unknown): Answers {
  const r = (raw ?? {}) as { v?: Record<string, unknown>; props?: unknown }
  const v: Answers['v'] = {}
  for (const [k, val] of Object.entries(r.v ?? {}).slice(0, 2000)) {
    if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(k)) continue
    if (typeof val === 'string') v[k] = val.slice(0, 5000)
    else if (typeof val === 'boolean') v[k] = val
    else if (Array.isArray(val)) v[k] = val.filter((x) => typeof x === 'string').slice(0, 30).map((x) => String(x).slice(0, 200))
  }
  const props = Array.isArray(r.props) ? r.props.filter((p) => typeof p === 'string' && /^p\d{1,4}$/.test(p)).slice(0, 50) : []
  return { v, props: props as string[] }
}

export async function saveAnswers(e: Engagement, body: Record<string, unknown>) {
  if (e.status === 'invited' || e.status === 'signing') throw new UserError('Please sign the agreements first.', 409)
  if (e.status === 'submitted') throw new UserError('Your questionnaire was already submitted. Call us if something needs to change.', 409)
  if (e.status === 'canceled') throw new UserError('This onboarding was canceled.', 409)
  const answers = cleanAnswers(body.answers)
  const part = str(body.part, 80) || null
  const folder = await withFolders(e, async (f) => { await putJson(PATHS.answers(f), { answers, part, savedAt: new Date().toISOString() }); return f })
  const items = docItems(e.modules, answers)
  const docs = (await getJson<DocState>(PATHS.checklist(folder))) ?? {}
  await updateEngagement(e.id, { questionnaire_part: part, docs_total: items.length, docs_done: docsDone(items, docs) })
}

export async function submitAnswers(e: Engagement, body: Record<string, unknown>) {
  if (e.status === 'submitted') throw new UserError('Your questionnaire was already submitted.', 409)
  if (e.status !== 'signed') throw new UserError('Please sign the agreements first.', 409)
  const answers = cleanAnswers(body.answers)
  const parts = buildParts(e.modules, answers)
  const problems = parts.flatMap((p) => validatePart(p.id, answers))
  if (problems.length) throw new UserError(problems.join(' '))

  const now = new Date()
  const folder = await withFolders(e, async (f) => { await putJson(PATHS.answers(f), { answers, part: 'final', savedAt: now.toISOString(), submittedAt: now.toISOString() }); return f })
  const pdf = await questionnairePdf(
    { client: householdName(e.client_name, e.spouse_name), engagement: ENGAGEMENT_TYPES[e.engagement_type].label, submitted: format(now, 'MMMM d, yyyy') },
    summarize(e.modules, answers),
  )
  await putFile(PATHS.answersPdf(folder), pdf, 'application/pdf')

  const items = docItems(e.modules, answers)
  const docs = (await getJson<DocState>(PATHS.checklist(folder))) ?? {}
  const done = docsDone(items, docs)
  const updated = await updateEngagement(e.id, {
    status: 'submitted', submitted_at: now.toISOString(), questionnaire_part: 'final', docs_total: items.length, docs_done: done,
  }, ['signed'])
  if (!updated) throw new UserError('Your questionnaire was already submitted.', 409)

  try {
    await sendOnboardingSubmitted({
      clientEmail: e.client_email,
      firstName: firstName(e.client_name),
      client: householdName(e.client_name, e.spouse_name),
      link: linkFor(e),
      adminUrl: `${siteUrl()}/admin/onboarding/${e.id}`,
      docsDone: done,
      docsTotal: items.length,
      folderUrl: folderWebUrl(folder),
    })
  } catch (err) {
    console.error('onboarding: submitted email failed', err)
  }
  return updated
}

// ---------------------------------------------------------------- client: documents

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
export const CHUNK_BYTES = 4 * 1024 * 1024

async function loadDocContext(e: Engagement) {
  const folder = await ensureClientFolder(e)
  const saved = await getJson<{ answers: Answers }>(PATHS.answers(folder))
  const answers = saved?.answers ? { v: saved.answers.v ?? {}, props: saved.answers.props ?? [] } : EMPTY_ANSWERS
  const items = docItems(e.modules, answers)
  const docs = (await getJson<DocState>(PATHS.checklist(folder))) ?? {}
  return { folder, items, docs }
}

async function saveDocs(e: Engagement, folder: string, items: ReturnType<typeof docItems>, docs: DocState) {
  await putJson(PATHS.checklist(folder), docs)
  await updateEngagement(e.id, { docs_total: items.length, docs_done: docsDone(items, docs) })
}

function assertCanUpload(e: Engagement) {
  if (e.status !== 'signed' && e.status !== 'submitted') throw new UserError('Please sign the agreements first.', 409)
}

export async function setNotApplicable(e: Engagement, docId: string, na: boolean) {
  assertCanUpload(e)
  const { folder, items, docs } = await loadDocContext(e)
  if (!items.some((x) => x.id === docId)) throw new UserError('Unknown document.', 404)
  const cur = docs[docId] ?? { files: [], na: false }
  docs[docId] = { files: cur.files, na: na && cur.files.length === 0 }
  await saveDocs(e, folder, items, docs)
  return docs
}

/**
 * Receives one piece of a file. Files up to CHUNK_BYTES arrive in one piece;
 * larger ones arrive in order as index 1..total and are assembled by Nextcloud.
 */
export async function receiveUpload(e: Engagement, q: { doc: string; name: string; upload: string; index: number; total: number; size: number }, body: Buffer) {
  assertCanUpload(e)
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(q.upload)) throw new UserError('Invalid upload.')
  if (!(q.total >= 1 && q.total <= Math.ceil(MAX_UPLOAD_BYTES / CHUNK_BYTES) && q.index >= 1 && q.index <= q.total)) throw new UserError('Invalid upload.')
  if (!(q.size > 0 && q.size <= MAX_UPLOAD_BYTES)) throw new UserError('Files can be up to 50 MB.', 413)
  if (body.length === 0 || body.length > CHUNK_BYTES) throw new UserError('Invalid upload.', 413)

  const uploadId = `mis-${e.id.slice(0, 8)}-${q.upload}`
  if (q.total > 1 && q.index < q.total) {
    if (q.index === 1) await chunkStart(uploadId)
    await chunkPut(uploadId, q.index, body)
    return { done: false as const }
  }

  const { folder, items, docs } = await loadDocContext(e)
  const item = items.find((x) => x.id === q.doc)
  const group = safeFileName(item?.group ?? 'Other')
  await ensureFolder(`${PATHS.documents(folder)}/${group}`)
  const cur = docs[q.doc] ?? { files: [], na: false }
  let name = safeFileName(q.name)
  if (cur.files.includes(name)) {
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    let n = 2
    while (cur.files.includes(`${stem} (${n})${ext}`)) n++
    name = `${stem} (${n})${ext}`
  }
  const dest = `${PATHS.documents(folder)}/${group}/${name}`
  try {
    if (q.total === 1) {
      await putFile(dest, body)
    } else {
      await chunkPut(uploadId, q.index, body)
      await chunkFinish(uploadId, dest, q.size)
    }
  } catch (err) {
    if (q.total > 1) await chunkAbort(uploadId)
    throw err
  }
  docs[q.doc] = { files: [...cur.files, name], na: false }
  await saveDocs(e, folder, items, docs)
  return { done: true as const, name, docs }
}
