// Server-only helpers for onboarding: private-link tokens, the database,
// admin checks, URLs, and the client's Nextcloud folder.

import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import type { EngagementStatus, EngagementType, Fees, MisSettings, ModuleId } from './config'
import { EMPTY_FEES } from './config'
import { CLIENT_ROOT } from '@/lib/nextcloud'

export type Engagement = {
  id: string
  token_hash: string
  token_enc: string | null
  client_name: string
  client_email: string
  spouse_name: string | null
  spouse_email: string | null
  engagement_type: EngagementType
  focus: string
  modules: ModuleId[]
  fees: Fees
  pay_methods: string[]
  status: EngagementStatus
  sign_details: SignDetails | null
  libresign_uuid: string | null
  libresign_status: number | null
  signers_status: { name: string; signed_at: string | null; sign_request_uuid?: string; sign_request_id?: number; email?: string }[] | null
  nextcloud_folder: string | null
  questionnaire_part: string | null
  docs_total: number
  docs_done: number
  invited_at: string | null
  sent_for_signature_at: string | null
  signed_at: string | null
  submitted_at: string | null
  last_activity_at: string | null
  created_by?: string | null
  created_at: string
}

export type SignDetails = {
  name1: string
  email1: string
  name2?: string
  email2?: string
  address: string
  payOption: string
  date: string
  mis: MisSettings
  /** When the signing email was last re-sent (limits repeat sends) */
  reminded_at?: string
}

// ---------------------------------------------------------------- secrets

function secretKey(): Buffer {
  const s = process.env.ONBOARDING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!s) throw new Error('ONBOARDING_SECRET or SUPABASE_SERVICE_ROLE_KEY must be set')
  return createHash('sha256').update('mis-onboarding:' + s).digest()
}

export function newToken() {
  return randomBytes(24).toString('base64url')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function encryptToken(token: string) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', secretKey(), iv)
  const enc = Buffer.concat([c.update(token, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.')
}

export function decryptToken(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const [iv, tag, enc] = value.split('.').map((s) => Buffer.from(s, 'base64url'))
    const d = createDecipheriv('aes-256-gcm', secretKey(), iv)
    d.setAuthTag(tag)
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
  } catch {
    return null
  }
}

export function callbackSignature(engagementId: string) {
  return createHmac('sha256', secretKey()).update('libresign-callback:' + engagementId).digest('base64url')
}

export function verifyCallbackSignature(engagementId: string, sig: string) {
  const want = Buffer.from(callbackSignature(engagementId))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got)
}

// ---------------------------------------------------------------- URLs

export function siteUrl() {
  if (process.env.VERCEL_ENV === 'preview') {
    const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL
    if (host) return `https://${host}`
  }
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://midwestinvestorservices.com').replace(/\/+$/, '')
}

/** On preview deployments, lets people and LibreSign through Vercel's login wall. */
function withPreviewBypass(url: string, setCookie: boolean) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (process.env.VERCEL_ENV !== 'preview' || !secret) return url
  const u = new URL(url)
  u.searchParams.set('x-vercel-protection-bypass', secret)
  if (setCookie) u.searchParams.set('x-vercel-set-bypass-cookie', 'true')
  return u.toString()
}

export function clientLink(token: string) {
  return withPreviewBypass(`${siteUrl()}/onboarding/${token}`, true)
}

export function callbackUrl(engagementId: string) {
  const u = new URL(`${siteUrl()}/api/onboarding/libresign-callback`)
  u.searchParams.set('e', engagementId)
  u.searchParams.set('sig', callbackSignature(engagementId))
  return withPreviewBypass(u.toString(), false)
}

// ---------------------------------------------------------------- database

const TABLE = 'onboarding_engagements'

function normalize(row: Record<string, unknown>): Engagement {
  const r = row as unknown as Engagement
  return { ...r, fees: { ...EMPTY_FEES, ...(r.fees ?? {}) }, modules: r.modules ?? [], pay_methods: r.pay_methods ?? [] }
}

export async function getEngagementByToken(token: string): Promise<Engagement | null> {
  if (!token || token.length < 20 || token.length > 100) return null
  const db = createAdminClient()
  const { data, error } = await db.from(TABLE).select('*').eq('token_hash', hashToken(token)).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? normalize(data) : null
}

export async function getEngagement(id: string): Promise<Engagement | null> {
  const db = createAdminClient()
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? normalize(data) : null
}

export async function listEngagements(): Promise<Engagement[]> {
  const db = createAdminClient()
  const { data, error } = await db.from(TABLE).select('*').order('created_at', { ascending: false }).limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []).map(normalize)
}

export async function insertEngagement(row: Partial<Engagement>): Promise<Engagement> {
  const db = createAdminClient()
  const { data, error } = await db.from(TABLE).insert(row).select('*').single()
  if (error) throw new Error(error.message)
  return normalize(data)
}

export async function updateEngagement(id: string, patch: Partial<Engagement>, onlyIfStatus?: EngagementStatus[]): Promise<Engagement | null> {
  const db = createAdminClient()
  let q = db.from(TABLE).update({ ...patch, last_activity_at: new Date().toISOString() }).eq('id', id)
  if (onlyIfStatus?.length) q = q.in('status', onlyIfStatus)
  const { data, error } = await q.select('*')
  if (error) throw new Error(error.message)
  return data?.[0] ? normalize(data[0]) : null
}

export async function getSettings(): Promise<MisSettings> {
  const db = createAdminClient()
  const { data } = await db.from('onboarding_settings').select('*').eq('id', 1).maybeSingle()
  return {
    entity_type: data?.entity_type ?? '',
    office_address: data?.office_address ?? '',
    signer_name: data?.signer_name ?? '',
    signer_title: data?.signer_title ?? '',
  }
}

export async function saveSettings(s: MisSettings) {
  const db = createAdminClient()
  const { error } = await db.from('onboarding_settings').upsert({ id: 1, ...s })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------- admin check

export { currentAdmin } from '@/lib/auth'

// ---------------------------------------------------------------- Nextcloud folders

export function clientFolderName(e: Pick<Engagement, 'id' | 'client_name'>) {
  const safe = e.client_name.replace(/[\\/:*?"<>|#%{}~&]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Client'
  return `${CLIENT_ROOT}/${safe} (${e.id.slice(0, 6)})`
}

export const PATHS = {
  agreements: (folder: string) => `${folder}/Agreements`,
  unsigned: (folder: string) => `${folder}/Agreements/Engagement Agreement and NDA - unsigned.pdf`,
  signed: (folder: string) => `${folder}/Agreements/Engagement Agreement and NDA - signed.pdf`,
  questionnaire: (folder: string) => `${folder}/Questionnaire`,
  answers: (folder: string) => `${folder}/Questionnaire/answers.json`,
  answersPdf: (folder: string) => `${folder}/Questionnaire/Intake Questionnaire.pdf`,
  documents: (folder: string) => `${folder}/Documents`,
  checklist: (folder: string) => `${folder}/Documents/checklist.json`,
}

export function safeFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  return base.replace(/[\x00-\x1f<>:"|?*\\/]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'file'
}
