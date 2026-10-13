// The intake questionnaire as data. The client page renders it, the server
// turns answers into a readable PDF, and both build the document checklist
// from it. Parts adapt to the engagement's sections and to the client's own
// answers (for example, a short-term rental adds its own part).

import type { ModuleId } from './config'

export type Val = string | string[] | boolean
export type Answers = { v: Record<string, Val>; props: string[] }
export const EMPTY_ANSWERS: Answers = { v: {}, props: [] }

type Base = { key: string; label: string; hint?: string; full?: boolean; req?: boolean }
export type Field =
  | (Base & { kind: 'text'; type?: 'text' | 'email' | 'tel' | 'date'; ph?: string; numeric?: boolean })
  | (Base & { kind: 'money' })
  | (Base & { kind: 'area'; rows?: number })
  | (Base & { kind: 'select'; options: string[] })
  | (Base & { kind: 'pick'; options: string[]; sm?: boolean })
  | (Base & { kind: 'multi'; options: string[] })
  | (Base & { kind: 'check' })

export type Group = { title?: string; fields: Field[] }
export type Section =
  | ({ type: 'group' } & Group)
  | { type: 'lede'; text: string }
  | { type: 'note'; text: string; link?: { href: string; label: string } }
  | { type: 'columns'; cols: { title: string; fields: Field[] }[] }
  | { type: 'priorities'; items: { key: string; label: string }[]; options: string[] }
  | { type: 'properties'; cards: PropertyCard[] }
  | { type: 'rows'; title?: string; rows: { title: string; fields: Field[] }[] }

export type PropertyCard = { pid: string; index: number; title: string; meta: string; groups: Group[] }
export type Part = { id: string; title: string; short: string; sections: Section[] }

export const USES = ['Primary residence', 'Long-term rental', 'Short-term rental', 'Group or supportive housing', 'Renovate and sell', 'Hold vacant', 'Other', 'Not decided']
export const PTYPES = ['Single-family', 'Condo', '2–4 units', '5+ units', 'Mixed-use', 'Land', 'Other']
export const GOALS: { key: string; label: string }[] = [
  { key: 'protect', label: 'Protect your home and savings from lawsuits or debts tied to your properties' },
  { key: 'probate', label: 'Avoid probate' },
  { key: 'simple', label: 'Keep setup and yearly upkeep simple and low-cost' },
  { key: 'cash', label: 'Maximize rental income and cash flow' },
  { key: 'grow', label: 'Grow the portfolio with more properties' },
  { key: 'tax', label: 'Reduce income and estate taxes' },
  { key: 'family', label: 'Provide for your spouse or family' },
  { key: 'control', label: 'Keep control of decisions during your lifetime' },
  { key: 'legacy', label: 'Leave a legacy (charity, community, family)' },
  { key: 'privacy', label: 'Keep your name off public records' },
]

const S = (a: Answers, k: string) => {
  const x = a.v[k]
  return typeof x === 'string' ? x : ''
}
const txt = (key: string, label: string, o: Partial<Extract<Field, { kind: 'text' }>> = {}): Field => ({ kind: 'text', key, label, ...o })
const money = (key: string, label: string, o: Partial<Base> = {}): Field => ({ kind: 'money', key, label, ...o })
const area = (key: string, label: string, o: Partial<Extract<Field, { kind: 'area' }>> = {}): Field => ({ kind: 'area', key, label, full: true, ...o })
const sel = (key: string, label: string, options: string[], o: Partial<Base> = {}): Field => ({ kind: 'select', key, label, options, ...o })
const pick = (key: string, label: string, options: string[], o: Partial<Extract<Field, { kind: 'pick' }>> = {}): Field => ({ kind: 'pick', key, label, options, ...o })
const multi = (key: string, label: string, options: string[], o: Partial<Base> = {}): Field => ({ kind: 'multi', key, label, options, full: true, ...o })
const when = <T>(cond: boolean, ...items: T[]): T[] => (cond ? items : [])

export function propName(a: Answers, pid: string, i: number) {
  const addr = S(a, `prop.${pid}.address`).split(',')[0].trim()
  return addr || `Property ${i + 1}`
}

function person(p: 'p1' | 'p2'): Field[] {
  return [
    txt(`${p}.name`, 'Full legal name', { req: p === 'p1' }),
    txt(`${p}.dob`, 'Date of birth', { type: 'date' }),
    pick(`${p}.citizen`, 'U.S. citizen?', ['Yes', 'No'], { hint: 'Affects certain estate-tax rules' }),
    txt(`${p}.phone`, 'Phone', { type: 'tel' }),
    txt(`${p}.email`, 'Email', { type: 'email' }),
    sel(`${p}.work`, 'Work status', ['Employed', 'Self-employed', 'Retired', 'Not working']),
    txt(`${p}.retire`, 'Planned retirement date', { ph: 'For example, 2032' }),
    area(`${p}.prior`, 'Prior marriages, or children from a prior relationship?', { rows: 2 }),
  ]
}

function partAbout(a: Answers): Section[] {
  const sp = S(a, 'hh.spouse') === 'Yes'
  const m = S(a, 'hh.marital')
  return [
    { type: 'group', fields: [pick('hh.spouse', 'Is a spouse or co-owner taking part in this engagement?', ['Yes', 'No'], { full: true })] },
    { type: 'columns', cols: [{ title: 'You', fields: person('p1') }, ...when(sp, { title: 'Spouse or co-owner', fields: person('p2') })] },
    {
      type: 'group', title: 'Household', fields: [
        txt('hh.address', 'Home address', { full: true }),
        sel('hh.marital', 'Marital status', ['Married', 'Single', 'Divorced', 'Widowed', 'Domestic partnership']),
        ...when(m === 'Married', txt('hh.marriedOn', 'Date of marriage', { type: 'date' })),
        ...when(m === 'Married' || m === 'Domestic partnership', pick('hh.prenup', 'Prenuptial or postnuptial agreement?', ['Yes', 'No', 'Unsure'])),
        pick('hh.move', 'Plans to move to another state in the next 10 years?', ['Yes', 'No', 'Maybe']),
        txt('hh.contact', 'Best way and time to reach you'),
        area('hh.support', 'Anyone else you support or want to provide for?', { hint: 'Parents, siblings, nieces and nephews, friends' }),
        area('hh.health', 'Health or caregiving considerations that affect timing', { hint: 'Optional' }),
      ],
    },
  ]
}

function partGoals(): Section[] {
  return [
    { type: 'lede', text: 'How important is each of these to you?' },
    { type: 'priorities', items: GOALS.map((g) => ({ key: `goal.${g.key}`, label: g.label })), options: ['High', 'Medium', 'Low'] },
    {
      type: 'group', title: 'In your words', fields: [
        area('goal.success', 'What would make this plan a success five years from now?'),
        area('goal.worry', 'What is your biggest worry about your properties or finances?'),
        area('goal.changes', 'Plans to buy, sell, or refinance in the next 1–5 years', { rows: 2 }),
        sel('goal.manager', 'Who handles day-to-day management?', ['Me', 'My spouse or co-owner', 'A property manager', 'Not decided']),
        sel('goal.paperwork', 'How much paperwork will you keep up with?', ['Keep it minimal', 'Some is fine', 'Whatever the plan needs']),
        txt('goal.budget', 'Budget for setup and yearly upkeep', { full: true, hint: 'Attorney and filing fees, insurance changes, bookkeeping' }),
      ],
    },
  ]
}

function partInvesting(): Section[] {
  return [
    {
      type: 'group', title: 'Capital and financing', fields: [
        sel('inv.capital', 'Capital available to invest', ['Under $50K', '$50K–$150K', '$150K–$500K', '$500K–$1M', 'Over $1M']),
        sel('inv.timeline', 'When do you want to buy?', ['Ready now', 'Within 3 months', '3–12 months', 'Just exploring']),
        multi('inv.financing', 'How will you finance purchases?', ['Cash', 'DSCR loan', 'Conventional loan', 'Hard money', 'Private money', 'Partners']),
      ],
    },
    {
      type: 'group', title: 'What you want to buy', fields: [
        multi('inv.types', 'Property types', ['Single-family', '2–4 units', '5+ units', 'Mixed-use', 'Short-term rental', 'Section 8 rentals']),
        txt('inv.areas', 'Target neighborhoods or markets', { full: true }),
        txt('inv.returns', 'Target return', { hint: 'Cash-on-cash, cap rate, or monthly cash flow' }),
        sel('inv.involve', 'How involved do you want to be?', ['Fully passive', 'Some involvement', 'Hands-on']),
        sel('inv.experience', 'Experience so far', ['This would be my first property', '1–5 properties', '6–20 properties', 'More than 20']),
        area('inv.notes', 'Anything else about what you are looking for?', { rows: 2 }),
      ],
    },
  ]
}

export function propertyGroups(a: Answers, pid: string): Group[] {
  const P = (k: string) => `prop.${pid}.${k}`
  const use = S(a, P('use'))
  const occ = S(a, P('occ'))
  const rented = occ === 'Tenants' || occ === 'Partly rented'
  return [
    {
      title: 'Basics', fields: [
        txt(P('address'), 'Full address', { full: true, req: true }),
        sel(P('ptype'), 'Property type', PTYPES),
        txt(P('units'), 'Number of units', { numeric: true }),
        sel(P('use'), 'Planned use', USES, { hint: 'Some uses add a short follow-up section.' }),
        txt(P('parcel'), 'Parcel ID', { hint: 'Shown on your property tax bill' }),
        ...when(!!use && use !== 'Primary residence' && use !== 'Not decided', txt(P('start'), 'Target start date for planned use', { type: 'date' })),
      ],
    },
    {
      title: 'Ownership', fields: [
        txt(P('deed'), 'Names on the deed, exactly as written', { full: true }),
        sel(P('title'), 'How title is held', ['Sole name', 'Joint with spouse', 'Tenants by the entirety', 'Trust', 'LLC or company', 'Unsure']),
        sel(P('acq'), 'How it was acquired', ['Purchased before marriage', 'Purchased during marriage', 'Inherited', 'Gift', 'Other']),
        txt(P('year'), 'Year acquired', { numeric: true }),
        money(P('price'), 'Purchase price'),
        money(P('value'), 'Estimated current value'),
      ],
    },
    {
      title: 'Debt and costs', fields: [
        txt(P('lender'), 'Mortgage lender'),
        sel(P('loan'), 'Loan was for', ['Primary home', 'Second home', 'Investment property', 'No mortgage']),
        money(P('balance'), 'Loan balance'),
        money(P('payment'), 'Monthly payment'),
        money(P('tax'), 'Annual property tax'),
        money(P('hoa'), 'HOA or condo dues per month'),
        pick(P('abate'), 'Tax abatement, TIF, or tax freeze in place?', ['Yes', 'No', 'Unsure']),
        txt(P('liens'), 'Other liens, home equity lines, or back taxes'),
      ],
    },
    {
      title: 'Insurance', fields: [
        txt(P('insurer'), 'Insurance company and policy type', { hint: 'Homeowner, landlord, or short-term rental policy' }),
        txt(P('liability'), 'Liability limit'),
      ],
    },
    {
      title: 'Occupancy and condition', fields: [
        sel(P('occ'), 'Who lives there now?', ['Owner', 'Tenants', 'Vacant', 'Partly rented']),
        ...when(rented, money(P('rent'), 'Current monthly rent'), txt(P('leases'), 'Lease end dates')),
        ...when(rented || use === 'Long-term rental', pick(P('voucher'), 'Any Housing Choice Voucher (Section 8) tenants?', ['Yes', 'No', 'Open to it'])),
        area(P('repairs'), 'Repairs needed and estimated cost', { rows: 2 }),
        txt(P('violations'), 'Open code violations or city notices', { full: true }),
      ],
    },
  ]
}

function partProps(a: Answers): Section[] {
  return [
    { type: 'lede', text: "Add each property you own or have under contract. Your deeds and latest mortgage statements answer most of these questions. If you don't own property yet, skip this part." },
    {
      type: 'properties',
      cards: a.props.map((pid, i) => {
        const pt = S(a, `prop.${pid}.ptype`)
        const use = S(a, `prop.${pid}.use`)
        return { pid, index: i, title: propName(a, pid, i), meta: [pt, use].filter(Boolean).join(' · ') || 'Add details', groups: propertyGroups(a, pid) }
      }),
    },
  ]
}

function partStr(a: Answers, pid: string, name: string): Section[] {
  const K = (k: string) => `str.${pid}.${k}`
  const pt = S(a, `prop.${pid}.ptype`)
  return [
    { type: 'lede', text: `A few questions about your short-term rental plan for ${name}.` },
    {
      type: 'note',
      text: "Cities set their own short-term rental rules. St. Louis City's ordinance (No. 71729) requires permits and caps rentals per building, but a court order has paused enforcement since April 2025. We plan as if local rules will apply.",
      link: { href: 'https://www.stlouis-mo.gov/government/departments/public-safety/building/permits/short-term-rental-permits/', label: 'City of St. Louis' },
    },
    {
      type: 'group', title: 'Rules and permits', fields: [
        area(K('rules'), 'Do HOA, condo, or neighborhood rules allow rentals under 30 days? Any minimum stay or caps?', { rows: 2, hint: 'You can upload the rules in the Documents step.' }),
        ...when(pt === 'Condo' || pt === '2–4 units' || pt === '5+ units', txt(K('building'), 'Units in the building, and how many already rent short-term', { full: true })),
        pick(K('permit'), 'Have you checked city permit or license requirements?', ['Yes', 'No', 'Not sure']),
        pick(K('told'), 'Have you told your lender and insurer about this plan?', ['Yes', 'No', 'Not yet']),
      ],
    },
    {
      type: 'group', title: 'Running it', fields: [
        pick(K('hosted'), 'Have you hosted before?', ['Yes', 'No']),
        multi(K('platforms'), 'Platforms you plan to use', ['Airbnb', 'Vrbo', 'Furnished Finder', 'Direct bookings'], { full: false }),
        sel(K('ops'), 'Who will handle guest messages, cleaning, and turnovers?', ['Me', 'A family member', 'A co-host or manager', 'Not decided']),
        pick(K('furnished'), 'Is it furnished?', ['Yes', 'No', 'Partly']),
        money(K('setup'), 'Estimated setup budget'),
        txt(K('rate'), 'Expected nightly rate and occupancy, if known'),
      ],
    },
  ]
}

function partGroup(pid: string, name: string): Section[] {
  const K = (k: string) => `grp.${pid}.${k}`
  return [
    { type: 'lede', text: `Tell us about the housing program you plan at ${name}.` },
    {
      type: 'note',
      text: 'Who operates the program shapes the structure we recommend. Many grant programs, including VA Grant and Per Diem, fund only nonprofits and government agencies.',
      link: { href: 'https://department.va.gov/homeless/grant-per-diem/', label: 'VA Grant & Per Diem' },
    },
    {
      type: 'group', title: 'Residents and services', fields: [
        area(K('residents'), 'Who will live there?', { rows: 2, hint: 'For example: veterans leaving homelessness, people in recovery, seniors, people with disabilities' }),
        txt(K('beds'), 'How many residents per unit? Shared bedrooms?', { full: true }),
        multi(K('services'), 'Services provided', ['Housing only', 'Meals', 'Supervision', 'Case management', 'Medical or behavioral health', 'Transportation', 'Job support']),
        pick(K('staff'), 'Staff on site?', ['No', 'Daytime', 'Around the clock']),
      ],
    },
    {
      type: 'group', title: 'Operator and funding', fields: [
        sel(K('operator'), 'Who will run the program?', ['Me personally', 'A new company', 'A new nonprofit', 'A partner agency', 'Not decided']),
        pick(K('zoning'), 'Have you checked zoning, occupancy limits, and licensing?', ['Yes', 'No', 'In progress']),
        multi(K('funding'), 'How will it be paid for?', ['Resident rent', 'VA or disability benefits', 'Housing vouchers', 'Government grants', 'Donations', 'Other']),
        area(K('contacts'), 'Have you talked with any agencies, partners, or the city yet?', { rows: 2 }),
        area(K('reno'), 'Renovations needed (fire safety, exits, accessibility), with budget and timeline', { rows: 2 }),
        area(K('legacy'), 'Should the program continue after your lifetime? Who would run it?', { rows: 2 }),
      ],
    },
  ]
}

function partFlip(pid: string, name: string): Section[] {
  const K = (k: string) => `flip.${pid}.${k}`
  return [
    { type: 'lede', text: `Your renovation plan for ${name}.` },
    {
      type: 'group', title: 'Plan', fields: [
        area(K('scope'), 'Scope of work', { rows: 3 }),
        money(K('budget'), 'Renovation budget'),
        txt(K('timeline'), 'Timeline'),
        sel(K('financing'), 'How it will be financed', ['Cash', 'Hard money', 'Private money', 'Line of credit', 'Not decided']),
        money(K('arv'), 'Expected resale price'),
        txt(K('contractor'), 'Contractor lined up?', { full: true }),
      ],
    },
  ]
}

function partFinances(a: Answers): Section[] {
  const claims = S(a, 'fin.claims') === 'Yes'
  return [
    { type: 'lede', text: "Ranges are fine. Please don't enter Social Security or account numbers." },
    {
      type: 'group', title: 'Assets', fields: [
        sel('fin.worth', 'Approximate total value of everything you own (with your spouse, if married)', ['Under $1M', '$1M–$2M', '$2M–$4M', 'Over $4M'], { full: true }),
        area('fin.retire', 'Retirement accounts: type and approximate balance', { rows: 2 }),
        txt('fin.bank', 'Bank and investment accounts: approximate total'),
        pick('fin.ltc', 'Long-term care insurance?', ['Yes', 'No', 'Unsure']),
        area('fin.life', 'Life insurance: owner, insured, coverage amount, beneficiary', { rows: 2 }),
        area('fin.other', 'Business interests, vehicles, or valuables', { rows: 2 }),
      ],
    },
    {
      type: 'group', title: 'Debts and claims', fields: [
        area('fin.debts', 'Debts besides mortgages', { rows: 2, hint: 'Car, credit cards, loans, personal guarantees' }),
        pick('fin.claims', 'Any pending or threatened lawsuits, judgments, tax liens, or bankruptcies in the past 10 years?', ['Yes', 'No'], { full: true, hint: 'We ask because moving property while a claim is pending can be undone by a court.' }),
        ...when(claims, area('fin.claimsDetail', 'Please describe', { rows: 2 })),
      ],
    },
    {
      type: 'group', title: 'Taxes and income', fields: [
        pick('fin.joint', 'Do you file taxes jointly?', ['Yes', 'No', 'Not married']),
        pick('fin.schedE', 'Are your rentals reported on Schedule E now?', ['Yes', 'No', 'Unsure', 'No rentals yet']),
        area('fin.income', 'Main sources of household income', { rows: 2 }),
        sel('fin.use', 'Will rental income cover living expenses, or be reinvested?', ['Cover living expenses', 'Reinvest', 'Some of both', 'Not sure'], { full: true }),
      ],
    },
  ]
}

function partEstate(): Section[] {
  const docs = [
    ['will', 'Will'],
    ['trust', 'Revocable living trust'],
    ['fpoa', 'Financial power of attorney'],
    ['hpoa', 'Healthcare power of attorney or living will'],
    ['tod', 'Beneficiary deed or transfer-on-death deed'],
    ['bene', 'Beneficiary forms on retirement accounts and life insurance'],
  ]
  return [
    {
      type: 'rows', title: 'Documents you have now',
      rows: docs.map(([k, label]) => ({
        title: label,
        fields: [pick(`est.${k}.have`, 'Have it?', ['Yes', 'No', 'Unsure'], { sm: true }), txt(`est.${k}.when`, 'Year signed and state'), txt(`est.${k}.atty`, 'Prepared by')],
      })),
    },
    {
      type: 'group', title: 'Your wishes', fields: [
        area('est.heirs', 'Who should inherit after you (and your spouse) are gone?', { rows: 2 }),
        area('est.gifts', 'Gifts to specific people or charities', { rows: 2 }),
        txt('est.trustee', "Who would manage your affairs if you can't? A backup?"),
        txt('est.health', "Who should make healthcare decisions if you can't? A backup?"),
        area('est.concerns', 'Anyone who might inherit who has special needs, creditor problems, or a shaky marriage?', { rows: 2 }),
      ],
    },
  ]
}

function partAdvisors(): Section[] {
  const roles = [
    ['attorney', 'Attorney'],
    ['cpa', 'CPA or tax preparer'],
    ['insurance', 'Insurance agent'],
    ['advisor', 'Financial advisor'],
    ['lender', 'Mortgage lender'],
    ['pm', 'Property manager'],
  ]
  return [
    { type: 'lede', text: "Leave a row blank if you don't have one. We contact only the advisors you mark Yes." },
    {
      type: 'rows',
      rows: roles.map(([k, label]) => ({
        title: label,
        fields: [pick(`adv.${k}.ok`, 'May we contact them?', ['Yes', 'No'], { sm: true }), txt(`adv.${k}.name`, 'Name and firm'), txt(`adv.${k}.contact`, 'Phone or email')],
      })),
    },
  ]
}

function partFinal(): Section[] {
  return [
    { type: 'group', title: 'Anything else', fields: [area('wrap.notes', 'Anything else we should know?', { rows: 3 })] },
    {
      type: 'group', title: 'Confirm', fields: [
        { kind: 'check', key: 'wrap.confirm', label: 'I confirm this information is accurate to the best of my knowledge, and I authorize Midwest Investor Services to contact the advisors I marked Yes.', full: true },
        txt('wrap.name', 'Type your full name', { req: true }),
      ],
    },
  ]
}

export function buildParts(modules: ModuleId[], a: Answers): Part[] {
  const P: Part[] = []
  P.push({ id: 'about', title: 'About you', short: 'About you', sections: partAbout(a) })
  P.push({ id: 'goals', title: 'Goals and priorities', short: 'Goals', sections: partGoals() })
  if (modules.includes('investing')) P.push({ id: 'investing', title: 'Investment goals', short: 'Investment goals', sections: partInvesting() })
  P.push({ id: 'props', title: 'Your properties', short: 'Properties', sections: partProps(a) })
  a.props.forEach((pid, i) => {
    const use = S(a, `prop.${pid}.use`)
    const name = propName(a, pid, i)
    if (use === 'Short-term rental') P.push({ id: `str-${pid}`, title: `Short-term rental: ${name}`, short: `Short-term rental · ${name}`, sections: partStr(a, pid, name) })
    if (use === 'Group or supportive housing') P.push({ id: `grp-${pid}`, title: `Group or supportive housing: ${name}`, short: `Group housing · ${name}`, sections: partGroup(pid, name) })
    if (use === 'Renovate and sell') P.push({ id: `flip-${pid}`, title: `Renovate and sell: ${name}`, short: `Renovation · ${name}`, sections: partFlip(pid, name) })
  })
  if (modules.includes('finances')) P.push({ id: 'finances', title: 'Other assets and finances', short: 'Finances', sections: partFinances(a) })
  if (modules.includes('estate')) P.push({ id: 'estate', title: 'Existing estate plan', short: 'Estate plan', sections: partEstate() })
  P.push({ id: 'advisors', title: 'Your advisors', short: 'Advisors', sections: partAdvisors() })
  P.push({ id: 'final', title: 'Review and submit', short: 'Review and submit', sections: partFinal() })
  return P
}

/** Messages for anything that blocks moving past this part. */
export function validatePart(id: string, a: Answers): string[] {
  const m: string[] = []
  if (id === 'about' && !S(a, 'p1.name').trim()) m.push('Enter your full legal name.')
  if (id === 'props') a.props.forEach((pid, i) => { if (!S(a, `prop.${pid}.address`).trim()) m.push(`Add an address for property ${i + 1}.`) })
  if (id === 'final') {
    if (a.v['wrap.confirm'] !== true) m.push('Check the confirmation box.')
    if (!S(a, 'wrap.name').trim()) m.push('Type your full name.')
  }
  return m
}

export function answeredCount(a: Answers): number {
  return Object.entries(a.v).filter(([k, v]) => !k.startsWith('wrap.') && (Array.isArray(v) ? v.length > 0 : v !== '' && v != null && v !== false)).length
}

// ------------------------------------------------------------ documents

export type DocItem = { group: string; id: string; title: string }

export function docItems(modules: ModuleId[], a: Answers): DocItem[] {
  const items: DocItem[] = []
  const add = (group: string, id: string, title: string) => items.push({ group, id, title })
  add('Personal and tax', 'tax', 'Last two years of federal and state tax returns, including Schedule E')
  if (S(a, 'hh.prenup') === 'Yes') add('Personal and tax', 'prenup', 'Prenuptial or postnuptial agreement')
  a.props.forEach((pid, i) => {
    const g = propName(a, pid, i)
    const use = S(a, `prop.${pid}.use`)
    const occ = S(a, `prop.${pid}.occ`)
    const pt = S(a, `prop.${pid}.ptype`)
    add(g, `${pid}-deed`, 'Recorded deed')
    add(g, `${pid}-closing`, 'Closing (settlement) statement from the purchase')
    if (S(a, `prop.${pid}.loan`) !== 'No mortgage') add(g, `${pid}-mortgage`, 'Latest mortgage statement, plus the note and deed of trust')
    add(g, `${pid}-title`, "Owner's title insurance policy")
    add(g, `${pid}-taxbill`, 'Latest property tax bill, and any abatement or TIF paperwork')
    add(g, `${pid}-ins`, 'Insurance declarations page')
    if (occ === 'Tenants' || occ === 'Partly rented' || use === 'Long-term rental') add(g, `${pid}-leases`, 'Current leases, rent roll, and security deposit records')
    add(g, `${pid}-notices`, 'Code violation notices, permits, or inspection reports')
    add(g, `${pid}-repairs`, 'Repair estimates or scopes of work')
    if (pt === 'Condo') add(g, `${pid}-hoa`, 'Condo declaration, bylaws, rules, and latest HOA statement')
    if (use === 'Short-term rental') add(g, `${pid}-str`, 'Any HOA or city correspondence about short-term rentals')
    if (use === 'Group or supportive housing') {
      add(g, `${pid}-grp1`, 'Program outline or business plan, even a rough one')
      add(g, `${pid}-grp2`, 'Letters or emails with agencies, partners, or the city')
      add(g, `${pid}-grp3`, 'Zoning or occupancy letters, and a draft renovation and operating budget')
    }
    if (use === 'Renovate and sell') add(g, `${pid}-flip`, 'Scope of work, contractor bids, and budget')
  })
  if (modules.includes('investing')) add('Investing', 'proof', 'Proof of funds or lender pre-approval, if you have one')
  if (modules.includes('finances')) {
    add('Other finances', 'stmts', 'Latest statements for retirement, bank, and investment accounts (balances only)')
    add('Other finances', 'policies', 'Life insurance and long-term care policies')
    add('Other finances', 'benef', 'Beneficiary designation forms')
  }
  if (modules.includes('estate')) {
    add('Existing estate documents', 'estdocs', 'Will, trust, powers of attorney, and healthcare directive')
    add('Existing estate documents', 'toddeeds', 'Any recorded beneficiary deeds or transfer-on-death deeds')
  }
  return items
}

export type DocState = Record<string, { files: string[]; na: boolean }>

export function docsDone(items: DocItem[], d: DocState): number {
  return items.filter((x) => d[x.id]?.na || (d[x.id]?.files.length ?? 0) > 0).length
}

// ------------------------------------------------------------ summary (for the PDF)

export type SummarySection = { title: string; rows: [string, string][] }

function display(f: Field, a: Answers): string {
  const v = a.v[f.key]
  if (v == null || v === '' || v === false) return ''
  if (Array.isArray(v)) return v.join(', ')
  if (v === true) return 'Yes'
  if (f.kind === 'money') return `$${String(v).replace(/^\$/, '')}`
  return String(v)
}

export function summarize(modules: ModuleId[], a: Answers): SummarySection[] {
  const out: SummarySection[] = []
  for (const part of buildParts(modules, a)) {
    const rows: [string, string][] = []
    const push = (label: string, value: string) => { if (value.trim()) rows.push([label, value]) }
    for (const s of part.sections) {
      if (s.type === 'group') s.fields.forEach((f) => push((s.title ? `${s.title}: ` : '') + f.label, display(f, a)))
      if (s.type === 'columns') s.cols.forEach((c) => c.fields.forEach((f) => push(`${c.title}: ${f.label}`, display(f, a))))
      if (s.type === 'priorities') s.items.forEach((it) => push(it.label, String(a.v[it.key] ?? '')))
      if (s.type === 'rows') s.rows.forEach((r) => r.fields.forEach((f) => push(`${r.title}: ${f.label}`, display(f, a))))
      if (s.type === 'properties') {
        s.cards.forEach((c) => {
          const prow: [string, string][] = []
          c.groups.forEach((g) => g.fields.forEach((f) => { const d = display(f, a); if (d.trim()) prow.push([`${g.title}: ${f.label}`, d]) }))
          out.push({ title: `Property ${c.index + 1}: ${c.title}`, rows: prow })
        })
      }
    }
    if (part.id === 'props') continue
    out.push({ title: part.title, rows })
  }
  return out
}
