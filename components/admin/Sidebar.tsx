'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, KanbanSquare, Inbox, Users, FileText,
  Mail, BookOpen, LogOut, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/deals', label: 'Deal Pipeline', icon: KanbanSquare },
  { href: '/admin/leads', label: 'Lead Inbox', icon: Inbox },
  { href: '/admin/investors', label: 'Investors', icon: Users },
  { href: '/admin/blog', label: 'Blog / Content', icon: FileText },
  { href: '/admin/subscribers', label: 'Subscribers', icon: Mail },
  { href: '/admin/resources', label: 'Resources', icon: BookOpen },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(item: typeof NAV[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <aside className="w-64 shrink-0 bg-navy min-h-screen flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gold/15">
        <Link href="/" className="block">
          <div className="font-head text-white text-base leading-tight">Midwest Investor Services</div>
          <div className="text-[10px] text-gold uppercase tracking-widest mt-0.5">Admin Dashboard</div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-white/30 text-[10px] uppercase tracking-widest font-medium px-2 mb-2">Navigation</p>
        <ul className="flex flex-col gap-0.5">
          {NAV.map(item => {
            const active = isActive(item)
            return (
              <li key={item.href}>
                <Link href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                    active
                      ? 'bg-gold text-navy'
                      : 'text-white/65 hover:text-white hover:bg-white/8'
                  )}>
                  <item.icon className={cn('w-4 h-4 shrink-0', active ? 'text-navy' : 'text-white/50 group-hover:text-gold')} />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-navy/60" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-gold/15">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/8 transition"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
