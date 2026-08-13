import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { DEAL_STATUSES } from '@/lib/utils'
import Link from 'next/link'

export default async function PortalDealsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deals } = await supabase
    .from('deal_submissions')
    .select('*')
    .eq('submitter_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-navy text-3xl">My Deals</h1>
          <p className="text-gray-500 text-sm mt-1">Track the status of properties you&apos;ve submitted.</p>
        </div>
        <Link href="/submit-deal" className="bg-gold text-navy text-sm font-semibold px-4 py-2.5 rounded hover:bg-gold-dark transition">
          + Submit Deal
        </Link>
      </div>

      {deals && deals.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Property</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Asking</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Submitted</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deals.map(d => {
                const statusInfo = DEAL_STATUSES.find(s => s.value === d.status)
                return (
                  <tr key={d.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4">
                      <div className="font-medium text-navy">{d.property_address}</div>
                      {d.property_type && <div className="text-xs text-gray-400">{d.property_type}</div>}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {d.asking_price ? `$${d.asking_price.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-gray-500">{fmtDate(d.created_at)}</td>
                    <td className="px-5 py-4">
                      {statusInfo && <Badge variant="custom" className={statusInfo.color}>{statusInfo.label}</Badge>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 text-center py-16">
          <p className="text-gray-400 text-sm mb-4">You haven&apos;t submitted any deals yet.</p>
          <Link href="/submit-deal" className="bg-gold text-navy text-sm font-semibold px-5 py-2.5 rounded hover:bg-gold-dark transition">
            Submit Your First Deal
          </Link>
        </div>
      )}
    </div>
  )
}
