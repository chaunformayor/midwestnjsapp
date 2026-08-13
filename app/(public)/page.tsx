import Link from 'next/link'
import { StatCard } from '@/components/ui/Card'
import { ArrowRight, CheckCircle2, Phone } from 'lucide-react'

const BOOKING_URL = 'https://chaun-missourihandymanservice.zohobookings.com/#/4594161000000711006'

const STATS = [
  { value: '25+', label: 'Years Active', sub: 'Investing in St. Louis since 1999' },
  { value: '$40M+', label: 'Assets Managed', sub: 'Residential & mixed-use portfolio' },
  { value: '300+', label: 'Deals Closed', sub: 'BRRRR, Section 8, flips & more' },
  { value: '98%', label: 'Occupancy Rate', sub: 'Across managed properties' },
]

const SERVICES = [
  {
    title: 'Deal Sourcing',
    desc: 'We locate off-market properties before they hit the MLS. First access goes to our investor list.',
    icon: '🔍',
  },
  {
    title: 'Deal Analysis',
    desc: 'Full underwriting on every deal — ARV, rehab costs, cash flow projections, and ROI modeling.',
    icon: '📊',
  },
  {
    title: 'Rehab & Construction',
    desc: 'Our in-house crew handles the full scope of work on time and on budget. No subcontractor surprises.',
    icon: '🔨',
  },
  {
    title: 'Property Management',
    desc: 'Tenant screening, rent collection, maintenance, and reporting. Fully hands-off for you.',
    icon: '🏠',
  },
  {
    title: 'Investor Consulting',
    desc: 'Personalized strategy sessions — whether you\'re buying your first rental or scaling a portfolio.',
    icon: '💼',
  },
  {
    title: 'Investor Education',
    desc: 'Members-only portal with templates, guides, deal breakdowns, and our private deal pipeline.',
    icon: '🎓',
  },
]

const STEPS = [
  { num: '01', title: 'Schedule a Call', body: 'We get to know your goals, risk tolerance, and target returns. No pitch — just a real conversation.' },
  { num: '02', title: 'We Source Your Deal', body: 'You get first access to deals that fit your criteria before they hit the open market.' },
  { num: '03', title: 'We Execute', body: 'From acquisition through rehab to tenant placement — we manage the entire process.' },
  { num: '04', title: 'You Collect', body: 'Monthly distributions, quarterly reports, and a portfolio that grows while you focus on what matters.' },
]

const TESTIMONIALS = [
  {
    quote: 'I\'ve been investing with Midwest Investor Services for eight years. They\'ve consistently delivered double-digit returns and I\'ve never had to worry about property management nightmares.',
    name: 'Robert M.',
    title: 'Portfolio Investor · 12 Properties',
  },
  {
    quote: 'As someone new to real estate, the consulting and education resources were invaluable. I closed my first BRRRR deal within 90 days of joining the investor list.',
    name: 'Priya K.',
    title: 'New Investor · St. Louis',
  },
  {
    quote: 'The construction crew is the real differentiator. On-budget, on-time, and they communicate every step of the way. My last rehab came in $8,000 under estimate.',
    name: 'James T.',
    title: 'Fix & Hold Investor',
  },
]

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative bg-navy overflow-hidden min-h-[90vh] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-light/30 to-navy opacity-90" />
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, #C9A84C 0%, transparent 50%), radial-gradient(circle at 75% 20%, #C9A84C 0%, transparent 40%)' }} />
        <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/25 text-gold text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
              St. Louis&apos;s Buy-and-Hold Specialists
            </div>
            <h1 className="font-head text-white text-4xl sm:text-5xl lg:text-6xl leading-tight mb-6">
              We Find It.<br />We Fix It.<br /><span className="text-gold">We Manage It.</span>
            </h1>
            <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-xl">
              Midwest Investor Services is St. Louis&apos;s only end-to-end buy-and-hold real estate firm. One team handles sourcing, rehab, and management — so your capital works harder with less friction.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
                className="bg-gold text-navy font-semibold px-6 py-3 rounded hover:bg-gold-dark transition flex items-center gap-2">
                Schedule a Call <ArrowRight className="w-4 h-4" />
              </a>
              <Link href="/invest"
                className="border border-white/30 text-white font-semibold px-6 py-3 rounded hover:bg-white/10 transition">
                How We Invest
              </Link>
            </div>
            <div className="flex flex-wrap gap-5 mt-8">
              {['No wholesalers', 'No MLS premium', 'In-house construction', 'Full management'].map(t => (
                <div key={t} className="flex items-center gap-2 text-white/60 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-gold" />{t}
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:grid grid-cols-2 gap-4">
            {STATS.map(s => <StatCard key={s.label} {...s} />)}
          </div>
        </div>
      </section>

      {/* Mobile stats strip */}
      <section className="lg:hidden bg-navy-light py-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 gap-4">
          {STATS.map(s => <StatCard key={s.label} {...s} />)}
        </div>
      </section>

      {/* Services */}
      <section className="py-20 bg-off-white" id="services">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-3">What We Do</div>
            <h2 className="font-head text-navy text-3xl sm:text-4xl mb-4">One Partner. Every Step.</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
              Most real estate investors juggle five vendors to close one deal. We consolidate everything under a single roof so your deal moves faster and your returns stay intact.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map(s => (
              <div key={s.title} className="bg-white rounded-xl p-6 border border-gray-100 hover:-translate-y-1 hover:shadow-lg hover:border-gold/30 transition-all cursor-default">
                <div className="text-3xl mb-4">{s.icon}</div>
                <h3 className="font-head text-navy text-lg mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-3">The Process</div>
            <h2 className="font-head text-navy text-3xl sm:text-4xl mb-4">How It Works</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-gold/20 z-0" />
                )}
                <div className="relative z-10 w-12 h-12 rounded-full bg-gold flex items-center justify-center text-navy font-head font-bold text-sm mb-5">
                  {s.num}
                </div>
                <h3 className="font-head text-navy text-lg mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gold text-navy font-semibold px-7 py-3.5 rounded hover:bg-gold-dark transition">
              Start with a Call <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-navy">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-3">Investor Stories</div>
            <h2 className="font-head text-white text-3xl sm:text-4xl">What Our Investors Say</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-white/5 border border-white/10 rounded-xl p-7">
                <div className="text-gold text-3xl font-head leading-none mb-4">&ldquo;</div>
                <p className="text-white/80 text-sm leading-relaxed mb-6">{t.quote}</p>
                <div>
                  <div className="text-white font-semibold text-sm">{t.name}</div>
                  <div className="text-white/40 text-xs">{t.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gold">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-head text-navy text-3xl sm:text-4xl mb-4">Ready to Put Your Capital to Work?</h2>
          <p className="text-navy/65 text-base mb-8">
            Let&apos;s talk about your goals and how we can build a strategy that fits — whether you&apos;re buying your first deal or scaling an existing portfolio.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
              className="bg-navy text-white font-semibold px-7 py-3.5 rounded hover:bg-navy-light transition flex items-center gap-2">
              Schedule a Call <ArrowRight className="w-4 h-4" />
            </a>
            <a href="tel:6365907698"
              className="border border-navy/30 text-navy font-semibold px-7 py-3.5 rounded hover:bg-navy/8 transition flex items-center gap-2">
              <Phone className="w-4 h-4" />636-590-7698
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
