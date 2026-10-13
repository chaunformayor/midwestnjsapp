// The Engagement Agreement and NDA as structured content.
// One source of truth: the client reads these blocks on the website, and the
// same blocks become the PDF sent to LibreSign for signature.

import type { Fees, MisSettings } from './config'
import { moneyText } from './config'

export type Run = { t: string; b?: boolean; blank?: boolean }
export type Block =
  | { k: 'title'; text: string }
  | { k: 'h'; text: string }
  | { k: 'p'; runs: Run[] }
  | { k: 'ol'; items: Run[][] }
  | { k: 'ul'; items: Run[][] }
  | { k: 'table'; head: string[]; rows: Run[][][]; widths?: number[] }
  | { k: 'break' }

export type AgreementContext = {
  date: string
  mis: MisSettings
  signers: { name: string }[] // client first, then spouse or co-owner if any
  clientAddress: string
  payOption: string
  focus: string
  fees: Fees
  payMethods: string[]
}

const t = (s: string): Run => ({ t: s })
const b = (s: string): Run => ({ t: s, b: true })
function v(value: string | undefined | null, placeholder: string, bold = false): Run {
  const s = String(value ?? '').trim()
  return s ? { t: s, b: bold } : { t: placeholder, blank: true }
}
function m(value: string | undefined | null): Run {
  const s = moneyText(value)
  return s ? { t: s } : { t: '$ amount', blank: true }
}
const P = (...runs: Run[]): Block => ({ k: 'p', runs })
const OL = (...items: Run[][]): Block => ({ k: 'ol', items })
const UL = (...items: Run[][]): Block => ({ k: 'ul', items })
const H = (text: string): Block => ({ k: 'h', text })

function parties(c: AgreementContext): Block[] {
  const [a, sp] = c.signers
  const clientRuns: Run[] = [v(a?.name, 'client name', true)]
  if (sp) clientRuns.push(t(' and '), v(sp.name, 'spouse or co-owner name', true))
  clientRuns.push(t(', residing at '), v(c.clientAddress, 'client address'), t(' (together, "Client").'))
  return [
    P(t(`This agreement is made on ${c.date} between:`)),
    UL(
      [b('Midwest Investor Services'), t(', a Missouri '), v(c.mis.entity_type, 'entity type'), t(', with its principal office at '), v(c.mis.office_address, 'office address'), t(' ("MIS"); and')],
      clientRuns,
    ),
  ]
}

function signatures(c: AgreementContext): Block[] {
  const rows: Run[][][] = [[[t('Midwest Investor Services')], [v(c.mis.signer_name, 'signer name')], [v(c.mis.signer_title, 'title')]]]
  c.signers.forEach((s, i) => rows.push([[t(i ? "Client's spouse or co-owner" : 'Client')], [v(s.name, 'name')], [t('—')]]))
  return [
    H('Signatures'),
    P(t('Each party signs this agreement electronically through LibreSign. The signed PDF carries a digital signature certificate for each signer, with the date and time of signing.')),
    { k: 'table', head: ['Party', 'Name', 'Title'], rows, widths: [0.38, 0.37, 0.25] },
  ]
}

export function engagementAgreement(c: AgreementContext): Block[] {
  const f = c.fees
  const feeRows: Run[][][] = [
    [[t('Phase 1 — Assessment and Recommendations')], [m(f.phase1), t(' flat')], [t('Per the payment option below')]],
    [[t('Phase 2 — Implementation Coordination')], [m(f.hourly), t(' per hour, billed in 15-minute increments')], [t('Monthly invoice, due within 15 days')]],
  ]
  if (String(f.retainer ?? '').trim()) {
    feeRows.push([[t('Phase 2 retainer')], [m(f.retainer)], [t('Before Phase 2 starts; applied to invoices')]])
  }
  feeRows.push(
    [[t('Meetings beyond Phase 1 scope')], [m(f.extra), t(' per hour')], [t('Monthly invoice, due within 15 days')]],
    [
      [t('Out-of-pocket expenses (records, title searches, travel over '), v(f.mileage, '#'), t(' miles)')],
      [t('At cost')],
      [t('Monthly invoice; any single expense over '), m(f.approval), t(" needs Client's approval first")],
    ],
  )

  return [
    { k: 'title', text: 'Consulting Fee and Engagement Agreement' },
    ...parties(c),

    H('1. Services'),
    P(t('MIS will provide real estate strategy and investment consulting focused on '), v(c.focus, 'engagement focus'), t(' The engagement covers the properties Client lists in the Intake Questionnaire.')),
    P(b('Phase 1 — Assessment and Recommendations (flat fee)')),
    OL(
      [t("Review of Client's completed Intake Questionnaire and documents.")],
      [t('One strategy meeting of up to '), v(f.meetingHours, '#'), t(' hours, in person or by video.')],
      [t('A property-by-property review of title, debt, insurance, condition, and planned use.')],
      [t('A written recommendations report with a step-by-step action plan, delivered within '), v(f.deliveryDays, '#'), t(' business days after MIS receives the completed questionnaire and documents.')],
      [t('One follow-up call of up to 60 minutes within 30 days of delivery.')],
    ),
    P(b('Phase 2 — Implementation Coordination (optional, hourly)')),
    P(t('If Client chooses, MIS will:')),
    OL(
      [t("Coordinate with Client's attorney, CPA, insurance agent, and lender to carry out the plan.")],
      [t("Track the action plan and keep Client's advisors on schedule.")],
      [t("Provide planning support for Client's property plans.")],
      [t("Attend meetings with Client's advisors as requested.")],
    ),
    P(t('Phase 2 starts only after Client approves it in writing. Email is sufficient.')),

    H('2. What is not included'),
    UL(
      [b('Legal services:'), t(' drafting or reviewing trusts, wills, deeds, LLC documents, leases, or contracts, and legal opinions.')],
      [b('Tax services:'), t(' tax preparation, tax opinions, and tax elections.')],
      [b('Securities advice:'), t(' advice on stocks, bonds, funds, or retirement account investments.')],
      [b('Insurance sales and real estate brokerage.')],
      [b('Third-party costs:'), t(' attorney, CPA, filing, recording, title, and insurance costs. Client pays these directly.')],
      [b('Affiliated-business services:'), t(" construction, property management, or other services from MIS's affiliates, which require a separate agreement.")],
    ),

    H('3. Fees and payment'),
    { k: 'table', head: ['Item', 'Fee', 'When due'], rows: feeRows, widths: [0.38, 0.3, 0.32] },
    P(t('Phase 1 payment option chosen by Client: '), v(c.payOption, 'chosen before signing'), t('.')),
    OL(
      [t('Phase 2 hours will not exceed '), m(f.cap), t(" in total without Client's written approval.")],
      [t('Accepted payment methods: '), v(c.payMethods.join(', '), 'payment methods'), t('.')],
      [t('Balances unpaid 30 days after the due date accrue interest at 1.5% per month, or the highest rate allowed by law, whichever is less. MIS may pause work until the account is current.')],
    ),

    H('4. Client responsibilities'),
    P(t('Client will:')),
    OL(
      [t('Provide complete and accurate information and documents. MIS relies on them without independently verifying them.')],
      [t('Make decisions and approve next steps in a timely way.')],
      [t("Hire and pay Client's own attorney, CPA, and insurance agent.")],
      [t('Review all recommendations with a licensed attorney and CPA before acting on them.')],
    ),

    H('5. Nature of advice; no guarantee'),
    OL(
      [t('Recommendations are based on information available when they are made. Laws, regulations, and market conditions change.')],
      [t('MIS does not guarantee any result, including rental income, occupancy, permit approval, grant funding, tax outcomes, or protection from any claim.')],
      [t("All final decisions are Client's.")],
      [t('MIS is not a law firm, accounting firm, or registered investment adviser. Communications with MIS are not protected by attorney-client or accountant-client privilege.')],
    ),

    H('6. Affiliated businesses and referrals'),
    P(t('MIS is affiliated with Missouri Construction Service and Luxe Property Solutions. Before recommending any provider, MIS will disclose in writing any affiliation with that provider and any compensation MIS would receive. Client is free to choose any provider.')),

    H('7. Confidentiality'),
    P(t('The Mutual Confidentiality and Non-Disclosure Agreement signed with this Agreement governs confidentiality and is part of this Agreement.')),

    H('8. Term, termination, and refunds'),
    OL(
      [t('This Agreement starts on the date above. Phase 1 ends after the follow-up call. Phase 2, if approved, continues until the action plan is complete or either party ends it.')],
      [t('Either party may end this Agreement at any time with written notice. Email is sufficient.')],
      [t('If Client ends the Agreement before the strategy meeting, MIS will refund Phase 1 payments minus '), m(f.cancel), t(' for work already performed.')],
      [t('Once the written report is delivered, the Phase 1 fee is fully earned and non-refundable.')],
      [t('Client pays for Phase 2 work and approved expenses through the termination date.')],
      [t('MIS may end the Agreement if Client does not pay, does not provide needed information, or asks MIS to act unlawfully or unethically.')],
    ),

    H('9. Work product'),
    P(t("Client owns the final written report and may share it with Client's advisors. MIS keeps all rights to its templates, models, and methods, and may reuse general know-how that contains none of Client's Confidential Information.")),

    H('10. Limitation of liability'),
    OL(
      [t("MIS's total liability under this Agreement will not exceed the fees Client paid MIS under this Agreement in the 12 months before the claim.")],
      [t('Neither party is liable for indirect, incidental, or consequential damages, including lost profits.')],
      [t('These limits do not apply to gross negligence, willful misconduct, or breach of the Mutual NDA.')],
    ),

    H('11. Disputes'),
    OL(
      [t('The parties will first try to resolve any dispute by meeting in good faith within 30 days of written notice.')],
      [t("If that fails, the parties will try mediation in St. Louis, Missouri, and share the mediator's fees equally.")],
      [t('If mediation fails, either party may file suit in the state or federal courts located in the City or County of St. Louis, Missouri.')],
      [t("Missouri law governs this Agreement. The prevailing party in any lawsuit may recover reasonable attorney's fees and costs.")],
    ),

    H('12. General terms'),
    OL(
      [b('Independent contractor.'), t(" MIS is an independent contractor, not Client's employee, agent, or fiduciary.")],
      [b('Entire agreement.'), t(" This Agreement and the Mutual NDA are the parties' entire agreement on this engagement.")],
      [b('Changes.'), t(' Changes to scope or fees must be in writing and approved by both parties. Email is sufficient.')],
      [b('Assignment.'), t(" Neither party may assign this Agreement without the other's written consent.")],
      [b('Severability.'), t(' If any part is unenforceable, the rest remains in effect.')],
      [b('Notices.'), t(' Notices go to the email addresses used to sign this Agreement.')],
      [b('Signatures.'), t(' This Agreement may be signed in counterparts and electronically. Each counts as an original.')],
    ),
    ...signatures(c),
  ]
}

export function ndaAgreement(c: AgreementContext): Block[] {
  return [
    { k: 'title', text: 'Mutual Confidentiality and Non-Disclosure Agreement' },
    ...parties(c),
    P(t('MIS and Client are each a "Party."')),

    H('1. Purpose'),
    P(t("The Parties will share information so MIS can evaluate and provide real estate, investment, and estate-planning strategy consulting to Client (the \"Purpose\"). Each Party will use the other's Confidential Information only for the Purpose.")),

    H('2. Confidential Information'),
    P(t('"Confidential Information" means any non-public information one Party (the "Discloser") shares with the other (the "Recipient"), in any form, before or after the date above. It includes:')),
    UL(
      [b('Client information:'), t(" personal, family, health, financial, tax, and legal information; property details, deeds, leases, loan and insurance records; estate-planning documents; and plans for Client's properties.")],
      [b('MIS information:'), t(' analyses, recommendations, financial models, pricing, deal and vendor sources, contacts, market data, methods, and written work product.')],
    ),

    H('3. Exclusions'),
    P(t('Confidential Information does not include information that the Recipient can show:')),
    OL(
      [t('is or becomes public through no fault of the Recipient;')],
      [t('the Recipient already knew, without a duty of confidentiality, before receiving it;')],
      [t('the Recipient lawfully received from a third party with no duty of confidentiality; or')],
      [t("the Recipient developed independently without using the Discloser's information.")],
    ),

    H('4. Obligations'),
    P(t('The Recipient will:')),
    OL(
      [t("keep the Discloser's Confidential Information confidential, using at least the care it uses for its own sensitive information, and never less than reasonable care;")],
      [t('use it only for the Purpose; and')],
      [t('share it only with employees, contractors, and professional advisors who need it for the Purpose and are bound by confidentiality duties at least as protective as this Agreement. The Recipient is responsible for any breach by them.')],
    ),

    H('5. Client information — additional protections'),
    OL(
      [t("MIS will not share Client's Confidential Information with any third party, including its affiliated businesses, without Client's prior consent. Email consent is sufficient. Client may authorize MIS to speak with named advisors in the Intake Questionnaire.")],
      [t("MIS will never sell Client's information or use it for marketing.")],
      [t("MIS will store Client's documents securely and will not ask Client to send full Social Security numbers or full account numbers by unencrypted email.")],
      [t("MIS will promptly notify Client if it learns of any unauthorized access to Client's information.")],
    ),

    H('6. Required disclosure'),
    P(t('If law, court order, or government authority requires disclosure, the Recipient will give the Discloser prompt written notice where legally allowed, and will disclose only what is legally required.')),

    H('7. Return or destruction'),
    P(t("Within 15 days of a written request, or at the end of the engagement, the Recipient will return or destroy the Discloser's Confidential Information. Copies required by law or held in routine backups may be kept and remain subject to this Agreement.")),

    H('8. Term'),
    P(t("Confidentiality obligations continue for five (5) years after the relationship ends. Obligations for Client's personal, health, and financial information, and for any trade secret, continue for as long as the information remains confidential.")),

    H('9. No other obligations'),
    OL(
      [t('This Agreement does not obligate either Party to any engagement or transaction. Any consulting engagement and fees are set out in a separate written agreement.')],
      [t('This Agreement does not create a partnership, agency, fiduciary, or attorney-client relationship.')],
      [t('MIS is not a law firm, accounting firm, or registered investment adviser, and communications with MIS are not protected by attorney-client or accountant-client privilege.')],
      [t('All Confidential Information is provided "as is." No license or ownership rights transfer under this Agreement.')],
    ),

    H('10. Remedies'),
    P(t('Unauthorized use or disclosure may cause irreparable harm. The Discloser may seek injunctive relief, in addition to any other remedy available at law, without posting a bond where permitted.')),

    H('11. General terms'),
    OL(
      [b('Governing law and venue.'), t(' Missouri law governs this Agreement. Any dispute will be heard in the state or federal courts located in the City or County of St. Louis, Missouri.')],
      [b('Entire agreement.'), t(" This is the Parties' entire agreement on confidentiality.")],
      [b('Changes and waivers.'), t(' Changes must be in writing and signed by both Parties. A delay in enforcing a right is not a waiver.')],
      [b('Severability.'), t(' If any part is unenforceable, the rest remains in effect.')],
      [b('Signatures.'), t(' This Agreement may be signed in counterparts and electronically. Each counts as an original.')],
    ),
    ...signatures(c),
  ]
}

/** True if any placeholder is still showing. The signing PDF must have none. */
export function hasBlanks(blocks: Block[]): boolean {
  const runsBlank = (runs: Run[]) => runs.some((r) => r.blank)
  return blocks.some((bl) => {
    if (bl.k === 'p') return runsBlank(bl.runs)
    if (bl.k === 'ol' || bl.k === 'ul') return bl.items.some(runsBlank)
    if (bl.k === 'table') return bl.rows.some((row) => row.some(runsBlank))
    return false
  })
}
