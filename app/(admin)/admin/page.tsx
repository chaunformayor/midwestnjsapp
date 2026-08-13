import { createAdminClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui/Card'
import { fmtDate } from '@/lib/utils'
import Link from 'next/link'

export default async function AdminOverviewPage() {
  const supabase = createAdminClient()
  const [{ count: dealCount }, { count: leadCount }, { count: investorCount }, { count: subCount }] = await Promise.all([
    supabase.from('deal_submissions').select('id', { count: 'exact', head: true }),
    supabase.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'investor'),
    supabase.from('subscribers').select('id', { count: 'exact', head: true }),
  ])

  const { data: recentDeals } = await supabase
    .from('deal_submissions')
    .select('id, property_address, submitter_name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: recentLeads } = await supabase
    .from('contact_submissions')
    .select('id, name, email, subject, created_at, status')
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: pendingInvestors } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at')
    .eq('role', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-head text-navy text-3xl">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of leads, deals, and investor activity.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard value={String(dealCount ?? 0)} label="Total Deals" />
        <StatCard value={String(leadCount ?? 0)} label="New Leads" />
        <StatCard value={String(investorCount ?? 0)} label="Active Investors" />
        <StatCard value={String(subCount ?? 0)} label="Subscribers" />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Recent deals */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-head text-navy text-lg">Recent Deals</h2>
            <Link href="/admin/deals" className="text-gold text-xs font-semibold">View all →</Link>
          </div>
          <div className="flex flex-col gap-3">
            {recentDeals?.map(d => (
              <div key={d.id} className="border-b border-gray-50 pb-3 last:border-0">
                <div className="text-sm font-medium text-navy">{d.property_address}</div>
                <div className="text-xs text-gray-400">{d.submitter_name} · {fmtDate(d.created_at)}</div>
              </div>
            ))}
            {!recentDeals?.length && <p className="text-gray-400 text-sm">No deals yet.</p>}
          </div>
        </div>

        {/* Recent leads */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-head text-navy text-lg">Recent Leads</h2>
            <Link href="/admin/leads" className="text-gold text-xs font-semibold">View all →</Link>
          </div>
          <div className="flex flex-col gap-3">
            {recentLeads?.map(l => (
              <div key={l.id} className="border-b border-gray-50 pb-3 last:border-0">
                <div className="text-sm font-medium text-navy">{l.name}</div>
                <div className="text-xs text-gray-400">{l.email} · {fmtDate(l.created_at)}</div>
              </div>
            ))}
            {!recentLeads?.length && <p className="text-gray-400 text-sm">No leads yet.</p>}
          </div>
        </div>

        {/* Pending investors */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-head text-navy text-lg">Pending Investors</h2>
            <Link href="/admin/investors" className="text-gold text-xs font-semibold">View all →</Link>
          </div>
          <div className="flex flex-col gap-3">
            {pendingInvestors?.map(p => (
              <div key={p.id} className="border-b border-gray-50 pb-3 last:border-0">
                <div className="text-sm font-medium text-navy">{p.full_name || 'Unnamed'}</div>
                <div className="text-xs text-gray-400">{p.email} · {fmtDate(p.created_at)}</div>
              </div>
            ))}
            {!pendingInvestors?.length && <p className="text-gray-400 text-sm">No pending approvals.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
