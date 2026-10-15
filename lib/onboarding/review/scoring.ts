// Turns questionnaire answers into weighted scores. Pure functions, no network:
// the same answers and weights always give the same scores.
//
// Every dimension scores 0 to 100 per person, where higher means "needs more
// attention". The household score is the higher (more cautious) of the two
// people's scores. Priority = household score x the admin's weight x a factor
// from how the client rated the related goals.

import { GOALS, propName, type Answers, type DocItem, type DocState, docsDone } from '../questionnaire'
import {
  DIMENSIONS, GOAL_FACTOR, type DimKey, type DimNote, type HouseholdScores, type ScoreRow, type Weights,
} from './config'

export type PersonInput = {
  name: string
  submitted: boolean
  answers: Answers
  items: DocItem[]
  docs: DocState
}

type DimResult = { applicable: boolean; score: number; notes: string[] }
type PersonScores = { name: string; dims: Record<DimKey, DimResult>; goals: Record<string, string> }

const cap = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

function makeReader(a: Answers) {
  const s = (k: string) => {
    const x = a.v[k]
    return typeof x === 'string' ? x.trim() : ''
  }
  const num = (k: string) => {
    const t = s(k).replace(/[$,\s]/g, '')
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return { s, num }
}

const blankish = (t: string) => !t || /^(none|no|n\/a|na|nothing|-|0)$/i.test(t.trim())
const personallyHeld = (title: string) => title !== 'LLC or company' && title !== 'Trust'

/** Compares addresses ignoring case, punctuation and unit numbers. */
export function addressKey(addr: string): string {
  return addr.split(',')[0].toLowerCase().replace(/#\s*\w+|\b(apt|unit|suite|ste)\b\.?\s*\w+/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function scorePerson(p: PersonInput): PersonScores {
  const a = p.answers
  const { s, num } = makeReader(a)
  const props = a.props.map((pid, i) => ({ pid, name: propName(a, pid, i), P: (k: string) => s(`prop.${pid}.${k}`) }))
  const out = {} as Record<DimKey, DimResult>
  const result = (key: DimKey, applicable: boolean, score: number, notes: string[]) => {
    out[key] = { applicable, score: applicable ? cap(score) : 0, notes: applicable ? notes : [] }
  }

  // ---- liability
  {
    const notes: string[] = []
    let pts = 0
    if (s('fin.claims') === 'Yes') {
      pts += 40
      notes.push('Reports a pending or past lawsuit, judgment, lien or bankruptcy.' + (s('fin.claimsDetail') ? ` Detail: ${s('fin.claimsDetail').slice(0, 160)}` : ''))
    }
    for (const x of props) {
      const bits: string[] = []
      let sub = 0
      const use = x.P('use')
      const occ = x.P('occ')
      if (use === 'Short-term rental') { sub += 10; bits.push('short-term rental') }
      if (use === 'Group or supportive housing') { sub += 15; bits.push('group or supportive housing') }
      if (use === 'Renovate and sell') { sub += 8; bits.push('renovation project') }
      if (occ === 'Tenants' || occ === 'Partly rented') { sub += 6; bits.push('tenants in place') }
      if (x.P('voucher') === 'Yes') { sub += 3; bits.push('Section 8 tenants') }
      if (!blankish(x.P('violations'))) { sub += 8; bits.push('open code violations or notices') }
      const title = x.P('title')
      const risky = sub > 0
      if (title && personallyHeld(title)) { sub += 10; bits.push(`title held as "${title}"`); if (risky) sub += 6 }
      if (!title) bits.push('how title is held was not answered')
      if (sub > 0) { pts += sub; notes.push(`${x.name}: ${bits.join(', ')}.`) }
    }
    result('liability', props.length > 0 || s('fin.claims') !== '', pts, notes)
  }

  // ---- asset-protection structure
  {
    const notes: string[] = []
    const answered = props.filter((x) => x.P('title'))
    let score = 0
    if (answered.length) {
      const personal = answered.filter((x) => personallyHeld(x.P('title')))
      score = answered.length ? (personal.length / answered.length) * 90 + 10 : 0
      if (!personal.length) score = 10
      notes.push(`${personal.length} of ${answered.length} properties are held personally (not in an LLC or trust).`)
    } else if (props.length) {
      score = 60
      notes.push('Title was not answered for any property, so the structure is unknown.')
    }
    const worth = s('fin.worth')
    if (worth === '$2M–$4M' || worth === 'Over $4M') { score += 10; notes.push(`Household net worth range: ${worth}.`) }
    result('protection', props.length > 0, score, notes)
  }

  // ---- insurance
  {
    const notes: string[] = []
    const subs: number[] = []
    for (const x of props) {
      let sub = 0
      const bits: string[] = []
      if (!x.P('insurer')) { sub += 45; bits.push('no insurer or policy type given') }
      if (!x.P('liability')) { sub += 25; bits.push('no liability limit given') }
      if (x.P('use') === 'Short-term rental') {
        const told = s(`str.${x.pid}.told`)
        if (told === 'No' || told === 'Not yet') { sub += 30; bits.push('short-term rental plan not yet shared with the insurer') }
      }
      subs.push(Math.min(100, sub))
      if (bits.length) notes.push(`${x.name}: ${bits.join(', ')}.`)
    }
    let score = subs.length ? subs.reduce((n, v) => n + v, 0) / subs.length : 0
    if (s('fin.ltc') === 'No') { score += 10; notes.push('No long-term care insurance.') }
    result('insurance', props.length > 0, score, notes)
  }

  // ---- estate readiness
  {
    const keys: [string, string, number][] = [
      ['will', 'will', 1.5], ['trust', 'revocable living trust', 1], ['fpoa', 'financial power of attorney', 1.5],
      ['hpoa', 'healthcare power of attorney', 1.5], ['tod', 'transfer-on-death deed', 0.75], ['bene', 'beneficiary forms', 1],
    ]
    const any = keys.some(([k]) => s(`est.${k}.have`)) || s('est.heirs') || s('fin.worth')
    const notes: string[] = []
    let total = 0
    let wsum = 0
    for (const [k, label, w] of keys) {
      const have = s(`est.${k}.have`)
      const v = have === 'Yes' ? 0 : have === 'No' ? 100 : have === 'Unsure' ? 70 : 60
      total += v * w
      wsum += w
      if (have !== 'Yes') notes.push(`${label}: ${have || 'not answered'}.`)
    }
    let score = wsum ? total / wsum : 0
    if (!s('est.heirs')) { score += 8; notes.push('Heirs not named.') }
    if (!s('est.trustee')) { score += 5; notes.push('No one named to manage affairs if the client cannot.') }
    if (s('est.concerns')) { score += 10; notes.push(`Heir concerns: ${s('est.concerns').slice(0, 160)}`) }
    result('estate', Boolean(any), score, notes)
  }

  // ---- debt and leverage
  {
    const notes: string[] = []
    const ltvScores: number[] = []
    for (const x of props) {
      const bal = num(`prop.${x.pid}.balance`)
      const val = num(`prop.${x.pid}.value`)
      if (bal != null && val) {
        const ltv = bal / val
        ltvScores.push(ltv > 0.85 ? 90 : ltv > 0.75 ? 70 : ltv > 0.65 ? 50 : ltv > 0.5 ? 30 : 10)
        notes.push(`${x.name}: loan-to-value about ${Math.round(ltv * 100)}%.`)
      }
      if (!blankish(x.P('liens'))) notes.push(`${x.name}: other liens or back taxes noted (${x.P('liens').slice(0, 100)}).`)
    }
    let score = 0
    if (ltvScores.length) score = 0.6 * Math.max(...ltvScores) + 0.4 * (ltvScores.reduce((n, v) => n + v, 0) / ltvScores.length)
    if (props.some((x) => !blankish(x.P('liens')))) score += 10
    if (!blankish(s('fin.debts'))) { score += 10; notes.push(`Other debts: ${s('fin.debts').slice(0, 120)}`) }
    result('leverage', ltvScores.length > 0 || !blankish(s('fin.debts')), score, notes)
  }

  // ---- compliance
  {
    const notes: string[] = []
    let pts = 0
    for (const x of props) {
      if (!blankish(x.P('violations'))) { pts += 25; notes.push(`${x.name}: open code violations or notices (${x.P('violations').slice(0, 100)}).`) }
      if (x.P('use') === 'Short-term rental') {
        const permit = s(`str.${x.pid}.permit`)
        if (permit === 'No' || permit === 'Not sure') { pts += 25; notes.push(`${x.name}: short-term rental permit requirements not checked.`) }
        if (!s(`str.${x.pid}.rules`)) { pts += 10; notes.push(`${x.name}: HOA, condo or neighborhood rules on short-term rentals not answered.`) }
      }
      if (x.P('use') === 'Group or supportive housing') {
        const zoning = s(`grp.${x.pid}.zoning`)
        if (zoning === 'No') { pts += 30; notes.push(`${x.name}: zoning, occupancy and licensing not checked.`) }
        else if (zoning === 'In progress') { pts += 10; notes.push(`${x.name}: zoning and licensing still in progress.`) }
      }
      if (x.P('abate') === 'Unsure') { pts += 5; notes.push(`${x.name}: unsure whether a tax abatement or freeze applies.`) }
    }
    result('compliance', props.length > 0, pts, notes)
  }

  // ---- information completeness
  {
    const notes: string[] = []
    const total = p.items.length
    const done = docsDone(p.items, p.docs)
    let score = total ? (1 - done / total) * 100 : 40
    if (total) notes.push(`${done} of ${total} checklist documents are in or marked not applicable.`)
    if (!p.submitted) { score = Math.max(score, 50); notes.push('The questionnaire has not been submitted yet.') }
    result('documentation', true, score, notes)
  }

  const goals: Record<string, string> = {}
  for (const g of GOALS) {
    const r = s(`goal.${g.key}`)
    if (r) goals[g.key] = r
  }
  return { name: p.name, dims: out, goals }
}

/** The highest factor among the goals tied to a dimension, across everyone. 1 when nobody rated them. */
function goalFactor(links: string[], people: PersonScores[]): number {
  let best: number | null = null
  for (const key of links) {
    for (const p of people) {
      const f = GOAL_FACTOR[p.goals[key]]
      if (f != null && (best == null || f > best)) best = f
    }
  }
  return best ?? 1
}

const RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 }

function discrepanciesBetween(a: PersonInput, b: PersonInput): string[] {
  const out: string[] = []
  const ra = makeReader(a.answers)
  const rb = makeReader(b.answers)
  const differ = (label: string, ka: string) => {
    const x = ra.s(ka)
    const y = rb.s(ka)
    if (x && y && x.toLowerCase() !== y.toLowerCase()) out.push(`${label}: ${a.name} says "${x}", ${b.name} says "${y}".`)
  }
  differ('Marital status', 'hh.marital')
  differ('Plans to move out of state', 'hh.move')
  const addrA = ra.s('hh.address')
  const addrB = rb.s('hh.address')
  if (addrA && addrB && addressKey(addrA) !== addressKey(addrB)) out.push(`Home address: ${a.name} says "${addrA}", ${b.name} says "${addrB}".`)

  for (const g of GOALS) {
    const x = ra.s(`goal.${g.key}`)
    const y = rb.s(`goal.${g.key}`)
    if (x && y && Math.abs((RANK[x] ?? 2) - (RANK[y] ?? 2)) >= 2) out.push(`Goal "${g.label}": ${a.name} rated it ${x}, ${b.name} rated it ${y}.`)
  }

  const propsOf = (p: PersonInput) => p.answers.props.map((pid, i) => ({ name: propName(p.answers, pid, i), key: addressKey(makeReader(p.answers).s(`prop.${pid}.address`)), pid, R: makeReader(p.answers) }))
  const pa = propsOf(a)
  const pb = propsOf(b)
  for (const x of pa) {
    if (!x.key) continue
    const y = pb.find((q) => q.key === x.key)
    if (!y) { out.push(`${x.name} is listed by ${a.name} but not by ${b.name}.`); continue }
    for (const [label, k] of [['how title is held', 'title'], ['planned use', 'use'], ['who lives there', 'occ']] as const) {
      const v1 = x.R.s(`prop.${x.pid}.${k}`)
      const v2 = y.R.s(`prop.${y.pid}.${k}`)
      if (v1 && v2 && v1 !== v2) out.push(`${x.name}, ${label}: ${a.name} says "${v1}", ${b.name} says "${v2}".`)
    }
    for (const [label, k] of [['estimated value', 'value'], ['loan balance', 'balance']] as const) {
      const v1 = x.R.num(`prop.${x.pid}.${k}`)
      const v2 = y.R.num(`prop.${y.pid}.${k}`)
      if (v1 && v2 && Math.abs(v1 - v2) / Math.max(v1, v2) > 0.1) out.push(`${x.name}, ${label}: ${a.name} says $${v1.toLocaleString('en-US')}, ${b.name} says $${v2.toLocaleString('en-US')}.`)
    }
  }
  for (const y of pb) {
    if (y.key && !pa.some((q) => q.key === y.key)) out.push(`${y.name} is listed by ${b.name} but not by ${a.name}.`)
  }
  return out
}

export function scoreHousehold(inputs: PersonInput[], weights: Weights): HouseholdScores {
  const people = inputs.map(scorePerson)
  const rows: ScoreRow[] = DIMENSIONS.map((d) => {
    const per = people.map((p) => ({ name: p.name, score: p.dims[d.key].applicable ? p.dims[d.key].score : null }))
    const present = per.filter((x) => x.score != null) as { name: string; score: number }[]
    const household = present.length ? Math.max(...present.map((x) => x.score)) : null
    const factor = goalFactor(d.goals, people)
    const weight = weights[d.key] ?? d.weight
    const notes: DimNote[] = people.flatMap((p) => p.dims[d.key].notes.map((text) => ({ who: p.name, text })))
    return {
      key: d.key, label: d.label, weight, goalFactor: factor, people: per, household,
      priority: household == null ? 0 : Math.round(household * weight * factor * 10) / 10,
      disagree: present.length > 1 && Math.max(...present.map((x) => x.score)) - Math.min(...present.map((x) => x.score)) >= 25,
      notes,
    }
  }).sort((x, y) => y.priority - x.priority)

  const live = rows.filter((r) => r.household != null && r.weight > 0)
  const denom = live.reduce((n, r) => n + r.weight * r.goalFactor, 0)
  const index = denom ? Math.round(live.reduce((n, r) => n + (r.household as number) * r.weight * r.goalFactor, 0) / denom) : null

  const discrepancies: string[] = []
  for (let i = 0; i < inputs.length; i++) for (let j = i + 1; j < inputs.length; j++) discrepancies.push(...discrepanciesBetween(inputs[i], inputs[j]))
  inputs.forEach((p) => { if (!p.submitted) discrepancies.push(`${p.name} has not submitted the questionnaire yet, so this review may be incomplete.`) })

  return {
    rows, index, discrepancies,
    people: people.map((p, i) => ({
      name: p.name, submitted: inputs[i].submitted,
      goals: GOALS.filter((g) => p.goals[g.key]).map((g) => ({ label: g.label, rating: p.goals[g.key] })),
    })),
  }
}
