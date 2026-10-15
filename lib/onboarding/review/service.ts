// Server-only: runs a review of a client's answers, saves it, and makes the
// client-facing PDF.

import { format } from 'date-fns'
import { createAdminClient } from '@/lib/supabase/server'
import { ensureFolder, getJson, putFile } from '@/lib/nextcloud'
import { ENGAGEMENT_TYPES, householdName } from '../config'
import { EMPTY_ANSWERS, docItems, type Answers, type DocState } from '../questionnaire'
import { reviewPdf } from '../pdf'
import { PATHS, ensurePeople, type Engagement, type Person } from '../server'
import { UserError } from '../service'
import { buildPrompt, runClaudeReview, type ReviewPerson } from './ai'
import { cleanWeights, type ReviewRecord, type Weights } from './config'
import { scoreHousehold } from './scoring'

const TABLE = 'onboarding_reviews'

// ---------------------------------------------------------------- weights

export async function getWeights(): Promise<Weights> {
  const db = createAdminClient()
  const { data } = await db.from('onboarding_settings').select('review_weights').eq('id', 1).maybeSingle()
  return cleanWeights((data as { review_weights?: unknown } | null)?.review_weights)
}

export async function saveWeights(raw: unknown): Promise<Weights> {
  const weights = cleanWeights(raw)
  const db = createAdminClient()
  const { error } = await db.from('onboarding_settings').upsert({ id: 1, review_weights: weights })
  if (error) throw new UserError('Run supabase/migrations/006_onboarding_reviews.sql in Supabase first, then save again.', 500)
  return weights
}

// ---------------------------------------------------------------- reviews

export async function latestReview(engagementId: string): Promise<ReviewRecord | null> {
  const db = createAdminClient()
  const { data, error } = await db.from(TABLE).select('*').eq('engagement_id', engagementId).order('created_at', { ascending: false }).limit(1)
  if (error) throw new Error(error.message)
  return (data?.[0] as ReviewRecord | undefined) ?? null
}

async function loadPerson(e: Engagement, p: Person): Promise<ReviewPerson> {
  let answers: Answers = EMPTY_ANSWERS
  let docs: DocState = {}
  if (p.nextcloud_folder) {
    const saved = await getJson<{ answers: Answers }>(PATHS.answers(p.nextcloud_folder))
    if (saved?.answers) answers = { v: saved.answers.v ?? {}, props: saved.answers.props ?? [] }
    docs = (await getJson<DocState>(PATHS.checklist(p.nextcloud_folder))) ?? {}
  }
  return { name: p.name, submitted: Boolean(p.submitted_at), answers, items: docItems(e.modules, answers), docs }
}

export async function runReview(e: Engagement, adminId: string): Promise<ReviewRecord> {
  const people = await ensurePeople(e)
  if (!people.some((p) => p.submitted_at)) throw new UserError('Nobody has submitted a questionnaire yet. Run the review once at least one person has.', 409)
  const loaded = await Promise.all(people.filter((p) => p.submitted_at || p.questionnaire_part).map((p) => loadPerson(e, p)))
  const weights = await getWeights()
  const scores = scoreHousehold(loaded, weights)
  const prompt = buildPrompt({ engagementType: e.engagement_type, focus: e.focus, modules: e.modules, people: loaded, scores, weights })
  const { review, model } = await runClaudeReview(prompt)
  const db = createAdminClient()
  const { data, error } = await db.from(TABLE).insert({
    engagement_id: e.id, created_by: adminId, model, weights, scores, review,
    // Start with every recommendation selected; the admin unticks what the client shouldn't see
    included: review.priorities.map((x) => x.id),
  }).select('*').single()
  if (error) throw new UserError('Run supabase/migrations/006_onboarding_reviews.sql in Supabase first, then try again.', 500)
  return data as ReviewRecord
}

/** Saves which recommendations go in the client PDF and any edits to the client wording. */
export async function saveSelections(review: ReviewRecord, included: string[], edits: Record<string, string>): Promise<ReviewRecord> {
  const ids = new Set(review.review.priorities.map((x) => x.id))
  const cleanIncluded = included.filter((id) => ids.has(id))
  const priorities = review.review.priorities.map((x) => (typeof edits[x.id] === 'string' ? { ...x, client_text: edits[x.id].trim().slice(0, 1500) } : x))
  const db = createAdminClient()
  const { data, error } = await db.from(TABLE).update({ included: cleanIncluded, review: { ...review.review, priorities } }).eq('id', review.id).select('*').single()
  if (error) throw new Error(error.message)
  return data as ReviewRecord
}

export async function getReview(id: string, engagementId: string): Promise<ReviewRecord | null> {
  const db = createAdminClient()
  const { data } = await db.from(TABLE).select('*').eq('id', id).eq('engagement_id', engagementId).maybeSingle()
  return (data as ReviewRecord | null) ?? null
}

export const pdfPath = (root: string) => `${root}/Review/Recommendations for the client.pdf`

/** Builds the client-facing PDF from the selected recommendations and saves it in the engagement folder. */
export async function makeClientPdf(e: Engagement, review: ReviewRecord): Promise<{ pdf: Buffer; path: string }> {
  const chosen = review.review.priorities.filter((x) => review.included.includes(x.id) && x.client_text.trim())
  if (!chosen.length) throw new UserError('Select at least one recommendation for the client PDF.', 400)
  if (!e.nextcloud_folder) throw new UserError('This client has no folder in Nextcloud yet.', 409)
  const pdf = await reviewPdf({
    household: householdName(e.client_name, e.spouse_name),
    engagement: ENGAGEMENT_TYPES[e.engagement_type].label,
    date: format(new Date(), 'MMMM d, yyyy'),
    items: chosen.map((x) => ({ title: x.title, text: x.client_text.trim(), urgency: x.urgency, owner: x.owner })),
  })
  const root = e.nextcloud_folder
  await ensureFolder(`${root}/Review`)
  await putFile(pdfPath(root), pdf, 'application/pdf')
  const db = createAdminClient()
  await db.from(TABLE).update({ client_pdf_at: new Date().toISOString() }).eq('id', review.id)
  return { pdf, path: pdfPath(root) }
}
