import { createAdminClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils'

export default async function AdminSubscribersPage() {
  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('subscribers')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-head text-navy text-3xl">Subscriber List</h1>
        <p className="text-gray-500 text-sm mt-1">{subs?.length ?? 0} subscribers on the investor list</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {subs && subs.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Email</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Name</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Source</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Subscribed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subs.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4 text-navy font-medium">{s.email}</td>
                  <td className="px-5 py-4 text-gray-600">{s.name || '—'}</td>
                  <td className="px-5 py-4 text-gray-500 capitalize">{s.source || '—'}</td>
                  <td className="px-5 py-4 text-gray-500">{fmtDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-16 text-gray-400 text-sm">No subscribers yet.</div>
        )}
      </div>
    </div>
  )
}
