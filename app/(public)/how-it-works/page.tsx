import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const BOOKING_URL = 'https://chaun-missourihandymanservice.zohobookings.com/#/4594161000000711006'

const STEPS = [
  {
    num: '01',
    title: 'Discovery Call',
    body: 'We start with a 30-minute conversation — no pitch, just listening. We learn your capital capacity, risk tolerance, target returns, and timeline. Then we map out a custom strategy.',
    details: ['We cover your goals and constraints', 'You get a realistic picture of current market returns', 'Zero sales pressure — you drive the pace'],
  },
  {
    num: '02',
    title: 'Deal Matching & Analysis',
    body: 'Once we understand your criteria, you get first access to deals before they hit the market. Every deal comes with a full underwriting package: ARV, rehab budget, rent projections, and ROI.',
    details: ['Off-market sourcing from our network', 'Independent ARV and market rent comps', 'Conservative underwriting — no inflated numbers'],
  },
  {
    num: '03',
    title: 'Acquisition & Financing',
    body: 'We can close fast — often in 10–21 days with our preferred title company. Our lending partners offer investor-specific programs including DSCR loans, bridge financing, and hard money.',
    details: ['Close in as few as 10 days', 'Investor lending partners available', 'Title, escrow, and legal coordination handled'],
  },
  {
    num: '04',
    title: 'Rehab & Construction',
    body: 'Our in-house construction crew handles the full scope of work. You get weekly photo updates, a detailed scope of work before we start, and a fixed-price contract so there are no surprises.',
    details: ['Fixed-price contracts — no scope creep', 'Weekly photo and video updates', 'Licensed and insured crew, St. Louis-based'],
  },
  {
    num: '05',
    title: 'Tenant Placement',
    body: 'We screen tenants, execute leases, and collect first month + deposit before you see a single maintenance call. Our leasing team targets occupancy within 30 days of rehab completion.',
    details: ['Full background and income verification', 'Market-rate or Section 8 placement', 'Average days-to-lease: under 30'],
  },
  {
    num: '06',
    title: 'Ongoing Management & Reporting',
    body: 'After placement, you step back. We handle rent collection, maintenance, renewals, and compliance. You get a monthly owner statement and an annual performance review.',
    details: ['Monthly owner disbursements and statements', 'Online maintenance request portal', 'Annual portfolio review and optimization'],
  },
]

export default function HowItWorksPage() {
  return (
    <>
      <section className="bg-navy py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-3">The Process</div>
          <h1 className="font-head text-white text-4xl sm:text-5xl mb-4">How It Works</h1>
          <p className="text-white/65 text-base">From first conversation to monthly distributions — a transparent look at how we work.</p>
        </div>
      </section>

      <section className="py-20 bg-off-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex flex-col gap-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-gold flex items-center justify-center text-navy font-head font-bold text-sm shrink-0">
                    {s.num}
                  </div>
                  {i < STEPS.length - 1 && <div className="w-px flex-1 bg-gold/20 my-2" />}
                </div>
                <div className="pb-8">
                  <h2 className="font-head text-navy text-xl mb-2">{s.title}</h2>
                  <p className="text-gray-500 text-sm leading-relaxed mb-3">{s.body}</p>
                  <ul className="flex flex-col gap-1">
                    {s.details.map(d => (
                      <li key={d} className="text-xs text-gray-400 flex gap-2">
                        <span className="text-gold">→</span>{d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-navy rounded-xl p-10 text-center">
            <h2 className="font-head text-white text-2xl mb-3">Take the First Step</h2>
            <p className="text-white/60 text-sm mb-6">All it takes is a 30-minute call to see whether we&apos;re a fit.</p>
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gold text-navy font-semibold px-6 py-3 rounded hover:bg-gold-dark transition text-sm">
              Schedule a Call <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
