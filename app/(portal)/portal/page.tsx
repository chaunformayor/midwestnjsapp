import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { DEAL_STATUSES } from '@/lib/utils'
import Link from 'next/link'

const BOOKING_URL = 'https://chaun-missourihandymanservice.zohobookings.com/#/4594161000000711006'

export default async function PortalDashboard() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: deals } = await supabase
    .from('deal_submissions')
    .select('id, property_address, status, created_at')
    .eq('submitter_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: resources } = await supabase
    .from('resources')
    .select('id, title, type, file_url')
    .order('created_at', { ascending: false })
    .limit(4)

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-head text-navy text-3xl">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Your investor dashboard — deals, resources, and quick actions.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
          className="bg-gold text-navy rounded-xl p-5 hover:bg-gold-dark transition">
          <div className="font-head text-lg">Schedule a Call</div>
          <p className="text-navy/65 text-xs mt-1">Book time with our team</p>
        </a>
        <Link href="/submit-deal"
          className="bg-navy text-white rounded-xl p-5 hover:bg-navy-light transition">
          <div className="font-head text-lg">Submit a Deal</div>
          <p className="text-white/60 text-xs mt-1">Send us a property to analyze</p>
        </Link>
        <Link href="/portal/resources"
          className="bg-white border border-gray-200 text-navy rounded-xl p-5 hover:border-gold/40 transition">
          <div className="font-head text-lg">Resource Library</div>
          <p className="text-gray-500 text-xs mt-1">Templates, guides, and reports</p>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent deals */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-head text-navy text-lg">My Deals</h2>
            <Link href="/portal/deals" className="text-gold text-xs font-semibold hover:text-gold-dark transition">View all →</Link>
          </div>
          {deals && deals.length > 0 ? (
            <div className="flex flex-col gap-3">
              {deals.map(d => {
                const statusInfo = DEAL_STATUSES.find(s => s.value === d.status)
                return (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-navy">{d.property_address}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{fmtDate(d.created_at)}</div>
                    </div>
                    {statusInfo && (
                      <Badge variant="custom" className={statusInfo.color}>{statusInfo.label}</Badge>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-6">No deals submitted yet.</p>
          )}
        </div>

        {/* Resources */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-head text-navy text-lg">Recent Resources</h2>
            <Link href="/portal/resources" className="text-gold text-xs font-semibold hover:text-gold-dark transition">View all →</Link>
          </div>
          {resources && resources.length > 0 ? (
            <div className="flex flex-col gap-3">
              {resources.map(r => (
                <a key={r.id} href={r.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 hover:text-gold transition">
                  <span className="text-xl">📄</span>
                  <div>
                    <div className="text-sm font-medium text-navy hover:text-gold transition">{r.title}</div>
                    <div className="text-xs text-gray-400">{r.type}</div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-6">Resources will appear here once added.</p>
          )}
        </div>
      </div>
    </div>
  )
}
