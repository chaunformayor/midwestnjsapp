import { StatCard } from '@/components/ui/Card'

const STATS = [
  { value: '25+', label: 'Years in Business', sub: 'Investing in St. Louis since 1999' },
  { value: '$40M+', label: 'Assets Under Management', sub: 'Residential & mixed-use' },
  { value: '300+', label: 'Deals Closed', sub: 'Across BRRRR, Section 8, and flips' },
  { value: '98%', label: 'Average Occupancy', sub: 'Across managed portfolio' },
  { value: '14%', label: 'Avg Cash-on-Cash Return', sub: 'Last 5-year average' },
  { value: '30 Days', label: 'Avg Days to Lease', sub: 'Post-rehab completion' },
]

const CASE_STUDIES = [
  {
    address: 'Compton Heights, St. Louis',
    type: 'BRRRR',
    purchase: '$62,000',
    rehab: '$38,000',
    arv: '$148,000',
    refinance: '$112,000',
    cashOut: '$12,000',
    monthlyRent: '$1,450',
    timeline: '74 days',
    notes: 'Full gut rehab. Refinanced at 75% LTV. Investor deployed capital into second deal within 90 days of acquisition.',
  },
  {
    address: 'North St. Louis County',
    type: 'Section 8',
    purchase: '$55,000',
    rehab: '$22,000',
    arv: '$95,000',
    refinance: '$71,000',
    cashOut: '$6,000',
    monthlyRent: '$1,375',
    timeline: '52 days',
    notes: 'HUD inspection passed first attempt. Tenant placed in 18 days post-rehab. Rent guaranteed by St. Louis Housing Authority.',
  },
  {
    address: 'Maplewood / Richmond Heights',
    type: 'Duplex BRRRR',
    purchase: '$88,000',
    rehab: '$55,000',
    arv: '$220,000',
    refinance: '$165,000',
    cashOut: '$22,000',
    monthlyRent: '$2,600',
    timeline: '91 days',
    notes: 'Both units leased simultaneously. Cash-on-cash return exceeds 19% on remaining equity post-refi.',
  },
]

export default function TrackRecordPage() {
  return (
    <>
      <section className="bg-navy py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-3">Our Performance</div>
          <h1 className="font-head text-white text-4xl sm:text-5xl mb-4">Track Record</h1>
          <p className="text-white/65 text-base">Numbers don&apos;t lie. Here&apos;s what 25+ years of disciplined investing looks like.</p>
        </div>
      </section>

      <section className="py-20 bg-off-white">
        <div className="max-w-5xl mx-auto px-6">
          {/* Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {STATS.map(s => <StatCard key={s.label} {...s} />)}
          </div>

          {/* Case studies */}
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-2">Deal Breakdowns</div>
            <h2 className="font-head text-navy text-3xl mb-8">Recent Case Studies</h2>
          </div>
          <div className="flex flex-col gap-6">
            {CASE_STUDIES.map(c => (
              <div key={c.address} className="bg-white rounded-xl border border-gray-100 p-7">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                  <div>
                    <div className="font-head text-navy text-lg">{c.address}</div>
                    <div className="text-xs uppercase tracking-widest text-gold font-semibold mt-0.5">{c.type}</div>
                  </div>
                  <div className="text-xs text-gray-400">Rehab timeline: <span className="text-navy font-semibold">{c.timeline}</span></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
                  {[
                    ['Purchase', c.purchase], ['Rehab', c.rehab], ['ARV', c.arv],
                    ['Refinance', c.refinance], ['Cash Out', c.cashOut], ['Monthly Rent', c.monthlyRent]
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{l}</div>
                      <div className="text-navy font-semibold text-sm mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>
                <p className="text-gray-500 text-xs leading-relaxed border-t border-gray-100 pt-4">{c.notes}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 mt-8">
            Past performance is not a guarantee of future results. Deal outcomes vary based on market conditions, property condition, and financing terms.
          </p>
        </div>
      </section>
    </>
  )
}
