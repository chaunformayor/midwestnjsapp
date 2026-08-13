import { createAdminClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { DEAL_STATUSES } from '@/lib/utils'

const KANBAN_COLS = DEAL_STATUSES.map(s => s.value)

export default async function AdminDealsPage() {
  const supabase = createAdminClient()
  const { data: deals } = await supabase
    .from('deal_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  const grouped = DEAL_STATUSES.reduce((acc, s) => {
    acc[s.value] = (deals || []).filter(d => d.status === s.value)
    return acc
  }, {} as Record<string, typeof deals>)

  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <h1 className="font-head text-navy text-3xl">Deal Pipeline</h1>
        <p className="text-gray-500 text-sm mt-1">{deals?.length ?? 0} total submissions</p>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {DEAL_STATUSES.map(col => (
            <div key={col.value} className="w-64 shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="custom" className={col.color}>{col.label}</Badge>
                <span className="text-xs text-gray-400">({grouped[col.value]?.length ?? 0})</span>
              </div>
              <div className="flex flex-col gap-3">
                {(grouped[col.value] || []).map((d: NonNullable<typeof deals>[0]) => (
                  <div key={d.id} className="bg-white rounded-lg border border-gray-100 p-4 text-sm">
                    <div className="font-medium text-navy text-sm leading-snug mb-1">{d.property_address}</div>
                    <div className="text-xs text-gray-400 mb-2">{d.submitter_name} · {d.submitter_email}</div>
                    <div className="flex flex-wrap gap-3">
                      {d.asking_price && <div className="text-xs"><span className="text-gray-400">Ask:</span> <span className="text-navy font-semibold">${d.asking_price.toLocaleString()}</span></div>}
                      {d.arv && <div className="text-xs"><span className="text-gray-400">ARV:</span> <span className="text-navy font-semibold">${d.arv.toLocaleString()}</span></div>}
                    </div>
                    <div className="text-xs text-gray-300 mt-2">{fmtDate(d.created_at)}</div>
                  </div>
                ))}
                {!grouped[col.value]?.length && (
                  <div className="bg-gray-50 rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-300">
                    No deals
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
