// Shared by the admin pages, the client flow, and the server.
// Nothing here is secret.

export type EngagementType = 'estate' | 'invest' | 'portfolio' | 'custom'
export type ModuleId = 'investing' | 'finances' | 'estate'

export const ENGAGEMENT_TYPES: Record<EngagementType, { label: string; modules: ModuleId[]; focus: string }> = {
  estate: {
    label: 'Estate and asset-protection planning',
    modules: ['finances', 'estate'],
    focus: "protecting Client's personal assets and organizing ownership of Client's real estate for asset protection, income, and passing the estate on.",
  },
  invest: {
    label: 'Investment consulting and acquisitions',
    modules: ['investing'],
    focus: "defining Client's investment criteria and a plan for acquiring income-producing real estate in the St. Louis area.",
  },
  portfolio: {
    label: 'Portfolio review and strategy',
    modules: ['finances'],
    focus: "reviewing Client's current properties for performance, risk, and next steps.",
  },
  custom: { label: 'Custom engagement', modules: [], focus: '' },
}

/** Short names for the top-level Nextcloud folder, e.g. "Estate Planning - John and Jane Smith". */
export const FOLDER_LABELS: Record<EngagementType, string> = {
  estate: 'Estate Planning',
  invest: 'Investment Consulting',
  portfolio: 'Portfolio Review',
  custom: 'Engagement',
}

export const CORE_SECTIONS: { label: string; note: string }[] = [
  { label: 'About you', note: 'Contact details, household, spouse or co-owner' },
  { label: 'Goals and priorities', note: 'What matters most and what worries them' },
  { label: 'Properties', note: 'Every property they own, with planned use' },
  { label: 'Advisors', note: 'Attorney, CPA, insurance agent, lender' },
  { label: 'Review and submit', note: 'Confirmation and typed name' },
]

export const OPTIONAL_SECTIONS: { id: ModuleId; label: string; note: string }[] = [
  { id: 'investing', label: 'Investment goals and buy box', note: 'Capital, financing, target properties, experience' },
  { id: 'finances', label: 'Other assets and finances', note: 'Accounts, insurance, debts, claims, taxes' },
  { id: 'estate', label: 'Existing estate plan', note: 'Wills, trusts, powers of attorney, heirs' },
]

export const PAY_METHODS = ['Check', 'ACH bank transfer', 'Credit card', 'Zelle'] as const
export const PAY_OPTIONS = ['100% at signing', '50% at signing, 50% when the report is delivered'] as const

export type Fees = {
  phase1: string
  meetingHours: string
  deliveryDays: string
  hourly: string
  extra: string
  retainer: string
  cap: string
  cancel: string
  mileage: string
  approval: string
}

export const FEE_FIELDS: { key: keyof Fees; label: string; money: boolean; required: boolean; hint?: string }[] = [
  { key: 'phase1', label: 'Phase 1 flat fee', money: true, required: true },
  { key: 'meetingHours', label: 'Strategy meeting length (hours)', money: false, required: true },
  { key: 'deliveryDays', label: 'Report delivered within (business days)', money: false, required: true },
  { key: 'hourly', label: 'Phase 2 hourly rate', money: true, required: true },
  { key: 'extra', label: 'Meetings beyond Phase 1 (per hour)', money: true, required: true },
  { key: 'retainer', label: 'Phase 2 retainer', money: true, required: false, hint: 'Optional; leave blank for none' },
  { key: 'cap', label: 'Phase 2 cap without client approval', money: true, required: true },
  { key: 'cancel', label: 'Kept if client cancels before the meeting', money: true, required: true },
  { key: 'mileage', label: 'Bill travel over (miles)', money: false, required: true },
  { key: 'approval', label: 'Single expenses over this need approval', money: true, required: true },
]

export const EMPTY_FEES: Fees = {
  phase1: '', meetingHours: '', deliveryDays: '', hourly: '', extra: '',
  retainer: '', cap: '', cancel: '', mileage: '', approval: '',
}

export type MisSettings = {
  entity_type: string
  office_address: string
  signer_name: string
  signer_title: string
}

export const MIS_CONTACT = {
  phone: '636-590-7698',
  email: 'info@midwestinvestorservices.com',
  hours: 'Mon–Fri, 8AM–6PM CT',
}

export type EngagementStatus = 'invited' | 'signing' | 'signed' | 'submitted' | 'canceled'

export const STATUS_LABELS: Record<EngagementStatus, string> = {
  invited: 'Invited',
  signing: 'Awaiting signature',
  signed: 'Signed',
  submitted: 'Questionnaire submitted',
  canceled: 'Canceled',
}

/** Missing fields that would leave blanks in the agreement. */
export function missingFees(fees: Partial<Fees>, payMethods: string[]): string[] {
  const out = FEE_FIELDS.filter((f) => f.required && !String(fees[f.key] ?? '').trim()).map((f) => f.label)
  if (!payMethods.length) out.push('Accepted payment methods')
  return out
}

export function missingSettings(s: Partial<MisSettings> | null | undefined): string[] {
  const out: string[] = []
  if (!s?.entity_type?.trim()) out.push('MIS entity type')
  if (!s?.office_address?.trim()) out.push('MIS office address')
  if (!s?.signer_name?.trim()) out.push('MIS signer name')
  if (!s?.signer_title?.trim()) out.push('MIS signer title')
  return out
}

export function moneyText(v: string | undefined | null): string {
  const s = String(v ?? '').trim().replace(/^\$/, '')
  return s ? `$${s}` : ''
}

export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

export function householdName(client: string, spouse?: string | null): string {
  const a = (client ?? '').trim()
  const b = (spouse ?? '').trim()
  if (!a) return 'your household'
  if (!b) return a
  const la = a.split(/\s+/).pop()
  const lb = b.split(/\s+/).pop()
  return la === lb ? `${firstName(a)} & ${firstName(b)} ${la}` : `${a} & ${b}`
}
