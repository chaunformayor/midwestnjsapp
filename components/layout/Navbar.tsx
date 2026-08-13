'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/invest', label: 'Invest With Us' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/track-record', label: 'Track Record' },
  { href: '/submit-deal', label: 'Submit a Deal' },
  { href: '/market', label: 'St. Louis + Midwest' },
  { href: '/blog', label: 'Market Updates' },
  { href: '/contact', label: 'Contact' },
]

const BOOKING_URL = 'https://chaun-missourihandymanservice.zohobookings.com/#/4594161000000711006'

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy/95 backdrop-blur-md border-b border-gold/15 h-[72px]">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex flex-col leading-tight" onClick={() => setOpen(false)}>
          <span className="font-head text-white text-lg leading-tight">Midwest Investor Services</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-gold font-medium">St. Louis · Buy &amp; Hold</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden xl:flex items-center gap-0.5">
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={cn('text-[13px] font-medium px-3 py-2 rounded transition-all',
                pathname.startsWith(l.href)
                  ? 'text-white bg-white/10'
                  : 'text-white/75 hover:text-white hover:bg-white/8'
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden xl:flex items-center gap-3">
          <Link href="/login" className="text-sm font-semibold text-gold border border-gold/40 px-4 py-2 rounded hover:bg-gold/10 transition">
            Investor Login
          </Link>
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold bg-gold text-navy px-4 py-2 rounded hover:bg-gold-dark transition"
          >
            Schedule a Call
          </a>
        </div>

        {/* Hamburger */}
        <button className="xl:hidden text-white p-2" onClick={() => setOpen(o => !o)} aria-label="Menu">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="xl:hidden bg-navy border-t border-gold/15 px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white px-3 py-2.5 rounded hover:bg-white/8 text-sm font-medium transition">
              {l.label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gold/15">
            <Link href="/login" onClick={() => setOpen(false)} className="text-gold border border-gold/40 px-4 py-2.5 rounded text-sm font-semibold text-center hover:bg-gold/10 transition">
              Investor Login
            </Link>
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="bg-gold text-navy px-4 py-2.5 rounded text-sm font-semibold text-center hover:bg-gold-dark transition">
              Schedule a Call
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
