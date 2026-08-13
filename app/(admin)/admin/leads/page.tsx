import { createAdminClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { CONTACT_STATUSES } from '@/lib/utils'

export default async function AdminLeadsPage() {
  const supabase = createAdminClient()
  const { data: leads } = await supabase
    .from('contact_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-head text-navy text-3xl">Lead Inbox</h1>
        <p className="text-gray-500 text-sm mt-1">{leads?.length ?? 0} contact submissions</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {leads && leads.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {leads.map(l => {
              const statusInfo = CONTACT_STATUSES.find(s => s.value === l.status)
              return (
                <div key={l.id} className="p-5 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-medium text-navy">{l.name}</div>
                      <div className="text-sm text-gray-500">{l.email}{l.phone ? ` · ${l.phone}` : ''}</div>
                      {l.subject && <div className="text-sm font-medium text-navy mt-1">{l.subject}</div>}
                      {l.message && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{l.message}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {statusInfo && <Badge variant="custom" className={statusInfo.color}>{statusInfo.label}</Badge>}
                      <div className="text-xs text-gray-400">{fmtDate(l.created_at)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400 text-sm">No contact submissions yet.</div>
        )}
      </div>
    </div>
  )
}
