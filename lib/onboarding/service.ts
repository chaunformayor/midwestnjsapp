// Server-only business logic for client onboarding. API routes stay thin and
// call into here.

import { createHash } from 'node:crypto'
import { format } from 'date-fns'
import {
  ENGAGEMENT_TYPES, PAY_OPTIONS, firstName, householdName, missingFees, missingSettings,
  type EngagementType, type Fees, type MisSettings, type ModuleId,
} from './config'
import { engagementAgreement, ndaAgreement, hasBlanks, type AgreementContext } from './agreements'
import { agreementsPdf, certificatePdf, questionnairePdf } from './pdf'
import { buildParts, checklistRows, docItems, docsDone, summarize, validatePart, type Answers, type DocState, EMPTY_ANSWERS } from './questionnaire'
import {
  type LibreSignSigner, NextcloudError, ensureFolder, putFile, getJson, putJson, folderWebUrl, libresignRequest, libresignValidate, libresignDownload, libresignNotifySigner,
  signingPageUrl, validationPageUrl, LS_STATUS, chunkStart, chunkPut, chunkFinish, chunkAbort, type LibreSignFile, type SignerInput,
} from '@/lib/nextcloud'
import {
  type Engagement, type Person, type SignDetails, PATHS, engagementFolderName, personFolderName, clientLink, callbackUrl, decryptToken, encryptToken,
  ensurePeople, getEngagement, getSettings, hashToken, insertEngagement, listPeople, newToken, personLink, safeFileName, siteUrl, updateEngagement, updatePerson,
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

  await ensurePeople(e)
  const link = clientLink(token)
  let emailed = false
  if (input.send_email) emailed = await emailInvite(e, link)
  return { engagement: e, link, emailed }
}

async function emailInvite(e: Engagement, link: string, p?: Pick<Person, 'name' | 'email'>) {
  try {
    await sendOnboardingInvite({ to: p?.email || e.client_email, firstName: firstName(p?.name || e.client_name), link, engagement: ENGAGEMENT_TYPES[e.engagement_type].label })
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

export async function personByRole(e: Engagement, role: 'client' | 'spouse' = 'client'): Promise<Person> {
  const p = (await ensurePeople(e)).find((x) => x.role === role)
  if (!p) throw new UserError('That person is not part of this engagement.', 404)
  return p
}

export async function resendInvite(e: Engagement, p: Person) {
  const link = personLink(e, p)
  if (!link) throw new UserError('This link can no longer be shown. Make a new link instead.')
  if (!(await emailInvite(e, link, p))) throw new UserError('The email could not be sent. Check the email settings and try again.', 502)
}

export async function replaceLink(e: Engagement, p: Person, sendEmail: boolean) {
  const token = newToken()
  if (p.role === 'client') {
    const updated = await updateEngagement(e.id, { token_hash: hashToken(token), token_enc: encryptToken(token) })
    if (!updated) throw new UserError('Client not found.', 404)
  } else {
    const updated = await updatePerson(p.id, { token_hash: hashToken(token), token_enc: encryptToken(token) })
    if (!updated) throw new UserError('Client not found.', 404)
  }
  const link = clientLink(token)
  const emailed = sendEmail ? await emailInvite(e, link, p) : false
  return { link, emailed }
}

// ---------------------------------------------------------------- client: view

export type ClientView = {
  /** The person looking at this page */
  me: { role: 'client' | 'spouse'; name: string; email: string }
  /** The other person on the engagement, if any */
  partner: { name: string; submitted: boolean } | null
  signers_done: { name: string; signed_at: string | null }[]
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
  /** Link to LibreSign's public page for checking the signatures, once signed */
  validationUrl: string | null
}

export async function clientView(e: Engagement, p: Person): Promise<ClientView> {
  if (e.status === 'signing') e = (await refreshSigning(e)) ?? e
  const people = await listPeople(e.id)
  p = people.find((x) => x.id === p.id) ?? p
  const partner = people.find((x) => x.id !== p.id) ?? null
  const mis = e.sign_details?.mis ?? (await getSettings())
  let answers: Answers = EMPTY_ANSWERS
  let part: string | null = p.questionnaire_part
  let docs: DocState = {}
  let storageError = false
  if (p.nextcloud_folder) {
    try {
      const saved = await getJson<{ answers: Answers; part?: string }>(PATHS.answers(p.nextcloud_folder))
      if (saved?.answers) {
        answers = { v: saved.answers.v ?? {}, props: saved.answers.props ?? [] }
        part = saved.part ?? part
      }
      docs = (await getJson<DocState>(PATHS.checklist(p.nextcloud_folder))) ?? {}
    } catch (err) {
      console.error('onboarding: could not read from Nextcloud', err)
      storageError = true
    }
  }
  // Start each person's questionnaire with what we already know about them
  if (!part && (e.status === 'signed' || e.status === 'submitted')) {
    const v = { ...answers.v }
    if (v['p1.name'] == null) v['p1.name'] = p.name
    if (v['p1.email'] == null) v['p1.email'] = p.email
    if (v['hh.address'] == null && e.sign_details?.address) v['hh.address'] = e.sign_details.address
    answers = { ...answers, v }
  }
  // Each person sees their own progress: they are "submitted" once they have submitted
  const status: Engagement['status'] = e.status === 'signed' || e.status === 'submitted' ? (p.submitted_at ? 'submitted' : 'signed') : e.status
  return {
    me: { role: p.role, name: p.name, email: p.email },
    partner: partner ? { name: partner.name, submitted: Boolean(partner.submitted_at) } : null,
    signers_done: (e.signers_status ?? []).map((s) => ({ name: s.name, signed_at: s.signed_at })),
    validationUrl: e.status === 'signed' || e.status === 'submitted' ? certificateValidationUrl(e) : null,
    client_name: e.client_name,
    client_email: e.client_email,
    spouse_name: e.spouse_name,
    spouse_email: e.spouse_email,
    engagement_type: e.engagement_type,
    focus: e.focus,
    modules: e.modules,
    fees: e.fees,
    pay_methods: e.pay_methods,
    status,
    sign_details: e.sign_details,
    signers: (e.signers_status ?? []).filter((s) => s.email).map((s) => ({
      name: s.name,
      email: s.email ?? '',
      signed_at: s.signed_at,
      signUrl: !s.signed_at && s.sign_request_uuid && e.status === 'signing' ? safeSigningUrl(s.sign_request_uuid) : null,
    })),
    signed_at: e.signed_at,
    submitted_at: p.submitted_at,
    mis,
    answers,
    part,
    docs,
    storageError,
  }
}

function certificateValidationUrl(e: Pick<Engagement, 'libresign_uuid'>) {
  if (!e.libresign_uuid) return null
  try {
    return validationPageUrl(e.libresign_uuid)
  } catch {
    return null
  }
}

function safeSigningUrl(uuid: string) {
  try {
    return signingPageUrl(uuid)
  } catch {
    return null
  }
}

/** The engagement's top-level folder, with the shared Agreements folder inside. */
async function ensureRootFolder(e: Engagement, force = false): Promise<string> {
  if (e.nextcloud_folder && !force) return e.nextcloud_folder
  const root = e.nextcloud_folder || engagementFolderName(e)
  await ensureFolder(PATHS.agreements(root))
  if (!e.nextcloud_folder) {
    await updateEngagement(e.id, { nextcloud_folder: root })
    e.nextcloud_folder = root
  }
  return root
}

/** One person's own folder under the engagement folder, with Questionnaire and Documents inside. */
async function ensurePersonFolder(e: Engagement, p: Person, force = false): Promise<string> {
  if (p.nextcloud_folder && !force) return p.nextcloud_folder
  const root = await ensureRootFolder(e, force)
  const folder = p.nextcloud_folder || personFolderName(root, p, await listPeople(e.id))
  await ensureFolder(PATHS.questionnaire(folder))
  await ensureFolder(PATHS.documents(folder))
  if (!p.nextcloud_folder) {
    await updatePerson(p.id, { nextcloud_folder: folder })
    p.nextcloud_folder = folder
  }
  return folder
}

const folderMissing = (err: unknown) => err instanceof NextcloudError && (err.status === 409 || err.status === 404)

/** Runs a write in the engagement folder; if Nextcloud says a folder is missing (someone deleted it), recreates it and retries once. */
async function withRoot<T>(e: Engagement, op: (root: string) => Promise<T>): Promise<T> {
  const root = await ensureRootFolder(e)
  try {
    return await op(root)
  } catch (err) {
    if (folderMissing(err)) return op(await ensureRootFolder(e, true))
    throw err
  }
}

/** Same as withRoot, for one person's own folder. */
async function withFolders<T>(e: Engagement, p: Person, op: (folder: string) => Promise<T>): Promise<T> {
  const folder = await ensurePersonFolder(e, p)
  try {
    return await op(folder)
  } catch (err) {
    if (folderMissing(err)) return op(await ensurePersonFolder(e, p, true))
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

export async function startSigning(e: Engagement, p: Person, body: Record<string, unknown>) {
  if (p.role !== 'client') throw new UserError(`${firstName(e.client_name) || 'The main client'} sets up the signing for both of you. You'll get your own link once the agreements are signed.`, 403)
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

  await withRoot(e, (root) => putFile(PATHS.unsigned(root), pdf, 'application/pdf'))

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
  // The names and emails entered at signing are the ones LibreSign uses; keep each person's record the same
  await updatePerson(p.id, { name: d.name1, email: d.email1 })
  if (hasSpouse) {
    const sp = (await listPeople(e.id)).find((x) => x.role === 'spouse')
    if (sp) await updatePerson(sp.id, { name: d.name2, email: d.email2 })
  }
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
  const root = await ensureRootFolder(done, true)
  let signedPdf: Buffer | null = null
  try {
    signedPdf = (await libresignDownload(file)) ?? callbackPdf ?? null
    if (signedPdf) await putFile(PATHS.signed(root), signedPdf, 'application/pdf')
    else console.error('onboarding: signed PDF could not be downloaded for', e.id)
  } catch (err) {
    console.error('onboarding: saving signed PDF failed', err)
  }
  try {
    await saveCertificate(done, root, merged, signedPdf)
  } catch (err) {
    console.error('onboarding: saving signing certificate failed', err)
  }
  try {
    const people = await ensurePeople(done)
    await sendOnboardingSigned({
      client: householdName(done.client_name, done.spouse_name),
      adminUrl: `${siteUrl()}/admin/onboarding/${done.id}`,
      folderUrl: folderWebUrl(root),
      signers: merged.map((s) => ({ name: s.name, signedAt: whenText(s.signed_at) })),
      validationUrl: certificateValidationUrl(done),
      people: people.map((x) => ({ email: x.email, firstName: firstName(x.name), link: personLink(done, x) })),
    })
  } catch (err) {
    console.error('onboarding: signed email failed', err)
  }
  return done
}

const whenText = (iso: string | null | undefined) => {
  const t = iso && iso !== SIGNED_UNKNOWN_TIME ? new Date(iso) : null
  // Shown in UTC so the same instant reads the same on any server
  return t && !Number.isNaN(t.getTime()) ? format(new Date(t.getTime() + t.getTimezoneOffset() * 60_000), "MMMM d, yyyy 'at' h:mm a") + ' UTC' : 'Signed'
}

/** The signing certificate: who signed and when, plus a fingerprint of the signed PDF. Saved next to it. */
export async function saveCertificate(e: Engagement, root: string, signers: NonNullable<Engagement['signers_status']>, signedPdf: Buffer | null) {
  const pdf = await certificatePdf({
    household: householdName(e.client_name, e.spouse_name),
    document: 'Engagement Agreement and NDA',
    engagement: ENGAGEMENT_TYPES[e.engagement_type].label,
    signers: signers.map((s) => ({
      name: s.name,
      role: s.email ? 'Client' : 'Midwest Investor Services',
      signedAt: whenText(s.signed_at),
    })),
    completedAt: whenText(e.signed_at),
    libresignId: e.libresign_uuid ?? '',
    validationUrl: certificateValidationUrl(e),
    sha256: signedPdf ? createHash('sha256').update(signedPdf).digest('hex') : null,
  })
  await putFile(PATHS.certificate(root), pdf, 'application/pdf')
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

/** Questionnaire answers can be saved once the agreements are signed, until this person submits. */
function assertCanAnswer(e: Engagement, p: Person) {
  if (e.status === 'invited' || e.status === 'signing') throw new UserError('Please sign the agreements first.', 409)
  if (e.status === 'canceled') throw new UserError('This onboarding was canceled.', 409)
  if (p.submitted_at) throw new UserError('Your questionnaire was already submitted. Call us if something needs to change.', 409)
}

/** Keeps the engagement's own totals in step with its people, and marks it submitted once everyone has. */
async function syncEngagement(e: Engagement): Promise<Engagement | null> {
  const people = await listPeople(e.id)
  const patch: Partial<Engagement> = {
    docs_total: people.reduce((n, x) => n + x.docs_total, 0),
    docs_done: people.reduce((n, x) => n + x.docs_done, 0),
    questionnaire_part: people.find((x) => x.role === 'client')?.questionnaire_part ?? people.find((x) => x.questionnaire_part)?.questionnaire_part ?? null,
  }
  const everyone = people.length > 0 && people.every((x) => x.submitted_at)
  if (everyone && e.status === 'signed') {
    return updateEngagement(e.id, { ...patch, status: 'submitted', submitted_at: new Date().toISOString() }, ['signed'])
  }
  return updateEngagement(e.id, patch)
}

export async function saveAnswers(e: Engagement, p: Person, body: Record<string, unknown>) {
  assertCanAnswer(e, p)
  const answers = cleanAnswers(body.answers)
  const part = str(body.part, 80) || null
  const folder = await withFolders(e, p, async (f) => { await putJson(PATHS.answers(f), { answers, part, savedAt: new Date().toISOString() }); return f })
  const items = docItems(e.modules, answers)
  const docs = (await getJson<DocState>(PATHS.checklist(folder))) ?? {}
  await updatePerson(p.id, { questionnaire_part: part, docs_total: items.length, docs_done: docsDone(items, docs) })
  await syncEngagement(e)
}

/** Rebuilds a person's PDF (answers plus document checklist) from what is saved in Nextcloud. */
export async function writeQuestionnairePdf(e: Engagement, p: Person, submitted: Date): Promise<{ folder: string; items: ReturnType<typeof docItems>; docs: DocState }> {
  const folder = await ensurePersonFolder(e, p)
  const saved = await getJson<{ answers: Answers }>(PATHS.answers(folder))
  const answers = saved?.answers ? { v: saved.answers.v ?? {}, props: saved.answers.props ?? [] } : EMPTY_ANSWERS
  const items = docItems(e.modules, answers)
  const docs = (await getJson<DocState>(PATHS.checklist(folder))) ?? {}
  const pdf = await questionnairePdf(
    {
      person: p.name,
      household: householdName(e.client_name, e.spouse_name),
      engagement: ENGAGEMENT_TYPES[e.engagement_type].label,
      submitted: format(submitted, 'MMMM d, yyyy'),
    },
    summarize(e.modules, answers),
    checklistRows(items, docs),
  )
  await putFile(PATHS.answersPdf(folder), pdf, 'application/pdf')
  return { folder, items, docs }
}

export async function submitAnswers(e: Engagement, p: Person, body: Record<string, unknown>) {
  if (p.submitted_at) throw new UserError('Your questionnaire was already submitted.', 409)
  if (e.status !== 'signed' && e.status !== 'submitted') throw new UserError('Please sign the agreements first.', 409)
  const answers = cleanAnswers(body.answers)
  const parts = buildParts(e.modules, answers)
  const problems = parts.flatMap((x) => validatePart(x.id, answers))
  if (problems.length) throw new UserError(problems.join(' '))

  const now = new Date()
  await withFolders(e, p, async (f) => { await putJson(PATHS.answers(f), { answers, part: 'final', savedAt: now.toISOString(), submittedAt: now.toISOString() }) })
  const { folder, items, docs } = await writeQuestionnairePdf(e, p, now)
  const done = docsDone(items, docs)
  const updated = await updatePerson(p.id, {
    submitted_at: now.toISOString(), questionnaire_part: 'final', docs_total: items.length, docs_done: done,
  })
  if (!updated) throw new UserError('Your questionnaire was already submitted.', 409)
  const eng = (await syncEngagement(e)) ?? e

  try {
    const people = await listPeople(e.id)
    await sendOnboardingSubmitted({
      clientEmail: p.email,
      firstName: firstName(p.name),
      client: people.length > 1 ? `${p.name} (${householdName(e.client_name, e.spouse_name)})` : p.name,
      link: personLink(e, p),
      adminUrl: `${siteUrl()}/admin/onboarding/${e.id}`,
      docsDone: done,
      docsTotal: items.length,
      folderUrl: folderWebUrl(folder),
      everyoneDone: eng.status === 'submitted',
      waitingOn: people.filter((x) => !x.submitted_at && x.id !== p.id).map((x) => x.name),
    })
  } catch (err) {
    console.error('onboarding: submitted email failed', err)
  }
  return eng
}

// ---------------------------------------------------------------- client: documents

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
export const CHUNK_BYTES = 4 * 1024 * 1024

async function loadDocContext(e: Engagement, p: Person) {
  const folder = await ensurePersonFolder(e, p)
  const saved = await getJson<{ answers: Answers }>(PATHS.answers(folder))
  const answers = saved?.answers ? { v: saved.answers.v ?? {}, props: saved.answers.props ?? [] } : EMPTY_ANSWERS
  const items = docItems(e.modules, answers)
  const docs = (await getJson<DocState>(PATHS.checklist(folder))) ?? {}
  return { folder, items, docs }
}

async function saveDocs(e: Engagement, p: Person, folder: string, items: ReturnType<typeof docItems>, docs: DocState) {
  await putJson(PATHS.checklist(folder), docs)
  await updatePerson(p.id, { docs_total: items.length, docs_done: docsDone(items, docs) })
  await syncEngagement(e)
  // After the questionnaire is in, the PDF's checklist keeps up with each upload
  if (p.submitted_at) {
    try {
      await writeQuestionnairePdf(e, p, new Date(p.submitted_at))
    } catch (err) {
      console.error('onboarding: refreshing the checklist PDF failed', err)
    }
  }
}

function assertCanUpload(e: Engagement) {
  if (e.status !== 'signed' && e.status !== 'submitted') throw new UserError('Please sign the agreements first.', 409)
}

export async function setNotApplicable(e: Engagement, p: Person, docId: string, na: boolean) {
  assertCanUpload(e)
  const { folder, items, docs } = await loadDocContext(e, p)
  if (!items.some((x) => x.id === docId)) throw new UserError('Unknown document.', 404)
  const cur = docs[docId] ?? { files: [], na: false }
  docs[docId] = { files: cur.files, na: na && cur.files.length === 0 }
  await saveDocs(e, p, folder, items, docs)
  return docs
}

/**
 * Receives one piece of a file. Files up to CHUNK_BYTES arrive in one piece;
 * larger ones arrive in order as index 1..total and are assembled by Nextcloud.
 */
export async function receiveUpload(e: Engagement, p: Person, q: { doc: string; name: string; upload: string; index: number; total: number; size: number }, body: Buffer) {
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

  const { folder, items, docs } = await loadDocContext(e, p)
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
  await saveDocs(e, p, folder, items, docs)
  return { done: true as const, name, docs }
}
