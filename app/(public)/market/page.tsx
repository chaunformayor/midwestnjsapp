import { StatCard } from '@/components/ui/Card'

const MARKET_STATS = [
  { value: '$185K', label: 'Median Home Price', sub: 'St. Louis Metro — Q2 2026' },
  { value: '6.2%', label: 'Avg Cap Rate', sub: 'St. Louis rental market' },
  { value: '$1,250', label: 'Avg Monthly Rent', sub: '3BR single family, metro' },
  { value: '4.8%', label: 'Vacancy Rate', sub: 'Below national 6.1% avg' },
]

const NEIGHBORHOODS = [
  {
    name: 'Compton Heights',
    type: 'Gentrifying / BRRRR',
    priceRange: '$60K–$120K',
    rentRange: '$1,200–$1,600',
    notes: 'Strong ARV lift potential. Historic character attracts quality tenants. Fast appreciation over last 3 years.',
  },
  {
    name: 'North St. Louis County',
    type: 'Section 8 / Cash Flow',
    priceRange: '$45K–$85K',
    rentRange: '$1,100–$1,400',
    notes: 'High HUD voucher density. Lower acquisition costs with strong government-backed rent. Ideal for yield investors.',
  },
  {
    name: 'Maplewood / Richmond Heights',
    type: 'Duplex / Multi-family',
    priceRange: '$80K–$140K',
    rentRange: '$1,200–$1,500/unit',
    notes: 'Dense walkable corridor. High renter demand. Low vacancy historically. Strong duplex inventory.',
  },
  {
    name: 'Ferguson / Florissant',
    type: 'Workforce Housing',
    priceRange: '$50K–$90K',
    rentRange: '$1,000–$1,300',
    notes: 'Steady workforce tenant base. Good deal flow from motivated sellers. Improving infrastructure investment.',
  },
]

export default function MarketPage() {
  return (
    <>
      <section className="bg-navy py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-3">Market Intelligence</div>
          <h1 className="font-head text-white text-4xl sm:text-5xl mb-4">St. Louis + Midwest</h1>
          <p className="text-white/65 text-base">Why investors keep coming back to the St. Louis market — and where we&apos;re finding deals right now.</p>
        </div>
      </section>

      <section className="py-20 bg-off-white">
        <div className="max-w-5xl mx-auto px-6">
          {/* Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
            {MARKET_STATS.map(s => <StatCard key={s.label} {...s} />)}
          </div>

          {/* Why St. Louis */}
          <div className="bg-white rounded-xl border border-gray-100 p-8 mb-10">
            <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-2">Why St. Louis</div>
            <h2 className="font-head text-navy text-2xl mb-4">A Cash-Flow Market With Real Appreciation</h2>
            <div className="grid sm:grid-cols-2 gap-6 text-sm text-gray-500 leading-relaxed">
              <p>
                St. Louis is one of the few major metros where a $100,000 investment can still generate meaningful monthly cash flow.
                Low acquisition costs, a diversified economy (healthcare, biotech, logistics, education), and a massive renter population
                create a durable environment for buy-and-hold investing.
              </p>
              <p>
                Unlike coastal markets, St. Louis hasn&apos;t experienced speculative price inflation — which means deals still pencil.
                The population density, proximity to major interstates (I-70, I-44, I-55), and low property taxes relative to comparable
                midwestern cities make it a consistently attractive market for out-of-state and local investors alike.
              </p>
            </div>
          </div>

          {/* Neighborhoods */}
          <div>
            <h2 className="font-head text-navy text-2xl mb-6">Active Target Markets</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {NEIGHBORHOODS.map(n => (
                <div key={n.name} className="bg-white rounded-xl border border-gray-100 p-6">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-gold mb-1">{n.type}</div>
                  <h3 className="font-head text-navy text-lg mb-3">{n.name}</h3>
                  <div className="flex gap-6 mb-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Purchase Range</div>
                      <div className="text-navy text-sm font-semibold">{n.priceRange}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Rent Range</div>
                      <div className="text-navy text-sm font-semibold">{n.rentRange}</div>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed">{n.notes}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
