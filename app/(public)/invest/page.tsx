import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

const BOOKING_URL = 'https://chaun-missourihandymanservice.zohobookings.com/#/4594161000000711006'

const STRATEGIES = [
  {
    id: 'brrrr',
    title: 'BRRRR Strategy',
    tag: 'Buy, Rehab, Rent, Refinance, Repeat',
    body: 'We identify undervalued properties, manage the full rehab, stabilize with quality tenants, and refinance to return capital — so you can repeat the cycle. Our average BRRRR deal returns 80–100% of invested capital within 12 months.',
    bullets: ['Average ARV lift: 40–55%', 'Rehab timeline: 45–90 days', 'Target cash-on-cash: 12–18%', 'In-house construction crew'],
  },
  {
    id: 'section8',
    title: 'Section 8 Rentals',
    tag: 'Government-Backed Income',
    body: 'Section 8 vouchers deliver guaranteed rent paid directly by HUD — no late payments, no collections. We handle the inspections, tenant qualification, and ongoing compliance so you never touch a form.',
    bullets: ['100% rent guaranteed by HUD', 'Tenants pre-screened by housing authority', 'Average tenancy: 3–5 years', 'Annual inspection management included'],
  },
  {
    id: 'management',
    title: 'Turnkey Property Management',
    tag: 'For Existing Portfolios',
    body: 'Already own rentals but tired of self-managing? We take over the headaches — leasing, maintenance, accounting — and optimize your current portfolio for performance.',
    bullets: ['98% average occupancy', 'Same-day maintenance dispatch', 'Monthly owner statements', 'No vacancy gaps — we pre-lease'],
  },
]

export default function InvestPage() {
  return (
    <>
      <section className="bg-navy py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-3">Our Investment Approach</div>
          <h1 className="font-head text-white text-4xl sm:text-5xl mb-4">Invest With Us</h1>
          <p className="text-white/65 text-base leading-relaxed">
            We&apos;ve deployed capital in St. Louis for 25+ years. Our approach is simple: buy below market, force appreciation, and hold for long-term cash flow.
          </p>
        </div>
      </section>

      <section className="py-20 bg-off-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-col gap-10">
            {STRATEGIES.map(s => (
              <div key={s.id} id={s.id} className="bg-white rounded-xl border border-gray-100 p-8 scroll-mt-24">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-gold mb-2">{s.tag}</div>
                <h2 className="font-head text-navy text-2xl mb-3">{s.title}</h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-5">{s.body}</p>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {s.bullets.map(b => (
                    <li key={b} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-gold shrink-0" />{b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-14 bg-navy rounded-xl p-10 text-center">
            <h2 className="font-head text-white text-2xl mb-3">Ready to talk numbers?</h2>
            <p className="text-white/60 text-sm mb-6">Schedule a free 30-minute strategy call and we&apos;ll show you current deal flow and projected returns.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
                className="bg-gold text-navy font-semibold px-6 py-3 rounded hover:bg-gold-dark transition flex items-center gap-2 text-sm">
                Schedule a Call <ArrowRight className="w-4 h-4" />
              </a>
              <Link href="/submit-deal" className="border border-white/30 text-white font-semibold px-6 py-3 rounded hover:bg-white/10 transition text-sm">
                Submit a Deal
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
