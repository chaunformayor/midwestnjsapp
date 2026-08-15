'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Phone, Mail, MapPin, Clock } from 'lucide-react'

const BOOKING_URL = 'https://chaun-missourihandymanservice.zohobookings.com/#/4594161000000711006'

export default function Footer() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, source: 'footer' }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch { setStatus('error') }
  }

  return (
    <footer>
      {/* Subscribe strip */}
      <div className="bg-gold py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="shrink-0">
              <h3 className="text-navy font-head text-xl leading-tight">Join the Investor List</h3>
              <p className="text-navy/65 text-sm mt-0.5">Off-market deals, market reports, and insights — first.</p>
            </div>
            {status === 'done' ? (
              <p className="text-navy font-semibold text-sm">✓ You&apos;re on the list! Check your inbox.</p>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-1 gap-2 flex-wrap min-w-0">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="First name"
                  className="border border-navy/20 rounded px-3 py-2.5 text-sm bg-white/80 focus:outline-none focus:border-navy w-32"
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Your email address"
                  required
                  className="border border-navy/20 rounded px-3 py-2.5 text-sm bg-white/80 focus:outline-none focus:border-navy flex-1 min-w-[180px]"
                />
                <button type="submit" disabled={status === 'loading'}
                  className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold hover:bg-navy-light transition shrink-0">
                  {status === 'loading' ? '…' : 'Join List'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="bg-navy border-t border-gold/15 pt-14 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-10 border-b border-white/6">
            {/* Brand */}
            <div>
              <div className="font-head text-white text-xl leading-tight mb-1">Midwest Investor Services</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-gold font-medium mb-4">Est. 1999 · St. Louis, MO</div>
              <p className="text-white/55 text-sm leading-relaxed">We find it, fix it, and manage it — all under one roof. St. Louis&apos;s only end-to-end buy-and-hold investment partner.</p>
            </div>

            {/* Navigate */}
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Navigate</h4>
              <ul className="flex flex-col gap-2">
                {[['/', 'Home'], ['/invest', 'Invest With Us'], ['/how-it-works', 'How It Works'], ['/track-record', 'Track Record'], ['/submit-deal', 'Submit a Deal'], ['/market', 'St. Louis + Midwest'], ['/blog', 'Market Updates'], ['/contact', 'Contact']].map(([href, label]) => (
                  <li key={href}><Link href={href} className="text-white/55 text-sm hover:text-gold transition">{label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Services</h4>
              <ul className="flex flex-col gap-2">
                {[['Deal Analysis', '/invest#analysis'], ['Deal Sourcing', '/invest#sourcing'], ['Rehab & Construction', '/invest#rehab'], ['Property Management', '/invest#management'], ['Investor Consulting', '/invest#consulting'], ['Investor Education', '/login']].map(([label, href]) => (
                  <li key={label}><Link href={href} className="text-white/55 text-sm hover:text-gold transition">{label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Contact Us</h4>
              <div className="flex flex-col gap-3">
                <a href="tel:6365907698" className="flex gap-3 text-white/55 text-sm hover:text-gold transition">
                  <Phone className="w-4 h-4 text-gold shrink-0 mt-0.5" />636-590-7698
                </a>
                <a href="mailto:info@midwestinvestorservices.com" className="flex gap-3 text-white/55 text-sm hover:text-gold transition break-all">
                  <Mail className="w-4 h-4 text-gold shrink-0 mt-0.5" />info@midwestinvestorservices.com
                </a>
                <div className="flex gap-3 text-white/55 text-sm">
                  <MapPin className="w-4 h-4 text-gold shrink-0 mt-0.5" />St. Louis, Missouri
                </div>
                <div className="flex gap-3 text-white/55 text-sm">
                  <Clock className="w-4 h-4 text-gold shrink-0 mt-0.5" />Mon–Fri 8AM–6PM CT
                </div>
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
                  className="mt-2 bg-gold text-navy text-sm font-semibold px-4 py-2.5 rounded hover:bg-gold-dark transition text-center">
                  Schedule a Call
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 text-xs text-white/35">
            <p>© {new Date().getFullYear()} Midwest Investor Services. All rights reserved.</p>
            <div className="flex gap-5">
              <Link href="/privacy" className="hover:text-gold transition">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-gold transition">Terms of Service</Link>
              <Link href="/login" className="hover:text-gold transition">Investor Portal</Link>
              <Link href="/login" className="hover:text-gold transition">Admin Login</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
