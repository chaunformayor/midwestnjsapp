// Shared by the scoring code, the AI review, the admin pages, and the weights screen.
// Nothing here is secret.

export type DimKey = 'liability' | 'protection' | 'insurance' | 'estate' | 'leverage' | 'compliance' | 'documentation'

export const DIMENSIONS: { key: DimKey; label: string; blurb: string; goals: string[]; weight: number }[] = [
  {
    key: 'liability', label: 'Liability exposure', weight: 5, goals: ['protect'],
    blurb: 'Lawsuit risk from how the properties are used and occupied (short-term rentals, group housing, tenants), open claims, and personal ownership of risky properties.',
  },
  {
    key: 'protection', label: 'Asset-protection structure', weight: 4, goals: ['protect', 'privacy', 'control'],
    blurb: 'How much of the real estate is held personally rather than in an LLC or trust, and how large the household net worth is.',
  },
  {
    key: 'insurance', label: 'Insurance coverage', weight: 4, goals: ['protect'],
    blurb: 'Missing or unclear policies and liability limits, short-term rentals the insurer has not been told about, and long-term care coverage.',
  },
  {
    key: 'estate', label: 'Estate readiness', weight: 4, goals: ['probate', 'family', 'legacy', 'control'],
    blurb: 'Will, trust, powers of attorney, transfer-on-death deeds and beneficiary forms, plus unanswered wishes for heirs and decision makers.',
  },
  {
    key: 'leverage', label: 'Debt and leverage', weight: 3, goals: ['cash', 'grow'],
    blurb: 'Loan-to-value on each property, other liens and non-mortgage debts.',
  },
  {
    key: 'compliance', label: 'Compliance and permits', weight: 3, goals: ['simple', 'grow'],
    blurb: 'Open code violations, short-term rental permits and rules, zoning for group housing, tax abatements.',
  },
  {
    key: 'documentation', label: 'Information completeness', weight: 2, goals: [],
    blurb: 'How much of the document checklist is in, and whether the questionnaire was submitted. Low completeness means the review rests on less evidence.',
  },
]

export const DIM_BY_KEY = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d])) as Record<DimKey, (typeof DIMENSIONS)[number]>

export type Weights = Record<DimKey, number>

export const DEFAULT_WEIGHTS: Weights = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d.weight])) as Weights

export const MAX_WEIGHT = 5

/** Fills in anything missing and keeps every weight between 0 and MAX_WEIGHT. 0 turns a dimension off. */
export function cleanWeights(raw: unknown): Weights {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = { ...DEFAULT_WEIGHTS }
  for (const d of DIMENSIONS) {
    const n = Number(r[d.key])
    if (r[d.key] !== undefined && r[d.key] !== '' && Number.isFinite(n)) out[d.key] = Math.min(MAX_WEIGHT, Math.max(0, Math.round(n * 2) / 2))
  }
  return out
}

/** How much a client's own goal ratings raise or lower a dimension's weight. */
export const GOAL_FACTOR: Record<string, number> = { High: 1.5, Medium: 1, Low: 0.6 }

export type DimNote = { who: string; text: string }

export type ScoreRow = {
  key: DimKey
  label: string
  weight: number
  /** 0.6 to 1.5, from how the client rated the goals tied to this dimension */
  goalFactor: number
  /** 0 to 100 per person; higher means more needs attention. null when it doesn't apply to that person. */
  people: { name: string; score: number | null }[]
  household: number | null
  /** household score x weight x goal factor */
  priority: number
  /** true when two people's scores differ by 25 or more */
  disagree: boolean
  notes: DimNote[]
}

export type HouseholdScores = {
  rows: ScoreRow[]
  /** weighted average of the household scores, 0 to 100 */
  index: number | null
  /** differences between what the two people answered, found by comparing their answers */
  discrepancies: string[]
  people: { name: string; submitted: boolean; goals: { label: string; rating: string }[] }[]
}

export const URGENCIES = ['now', 'soon', 'later'] as const
export type Urgency = (typeof URGENCIES)[number]
export const URGENCY_LABEL: Record<Urgency, string> = { now: 'Start now', soon: 'Next', later: 'Later' }

export type Recommendation = {
  id: string
  title: string
  /** Internal: why, citing the answers. Never shown to the client. */
  rationale: string
  dimension: string
  urgency: Urgency
  owner: string
  next_step: string
  confidence: 'high' | 'medium' | 'low'
  /** Plain-language wording for the client-facing PDF */
  client_text: string
}

export type ReviewOutput = {
  summary: string
  priorities: Recommendation[]
  couple_notes: { topic: string; detail: string; suggested_question: string }[]
  missing_information: string[]
  meeting_questions: string[]
  cautions: string[]
}

export type ReviewRecord = {
  id: string
  engagement_id: string
  created_at: string
  model: string
  scores: HouseholdScores
  weights: Weights
  review: ReviewOutput
  /** recommendation ids to put in the client PDF */
  included: string[]
  client_pdf_at: string | null
}
