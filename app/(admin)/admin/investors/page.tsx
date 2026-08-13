import { createAdminClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import ApproveButton from './ApproveButton'

export default async function AdminInvestorsPage() {
  const supabase = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const roleVariant: Record<string, 'gold' | 'green' | 'navy' | 'gray'> = {
    admin: 'navy', investor: 'green', pending: 'gold'
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-head text-navy text-3xl">Investor Management</h1>
        <p className="text-gray-500 text-sm mt-1">{profiles?.length ?? 0} registered accounts</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">User</th>
              <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Role</th>
              <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Joined</th>
              <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {profiles?.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition">
                <td className="px-5 py-4">
                  <div className="font-medium text-navy">{p.full_name || 'No name'}</div>
                  <div className="text-xs text-gray-400">{p.email}</div>
                  {p.phone && <div className="text-xs text-gray-400">{p.phone}</div>}
                </td>
                <td className="px-5 py-4">
                  <Badge variant={roleVariant[p.role] || 'gray'} className="capitalize">{p.role}</Badge>
                </td>
                <td className="px-5 py-4 text-gray-500">{fmtDate(p.created_at)}</td>
                <td className="px-5 py-4">
                  {p.role === 'pending' && <ApproveButton userId={p.id} email={p.email} name={p.full_name} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!profiles?.length && (
          <div className="text-center py-16 text-gray-400 text-sm">No users yet.</div>
        )}
      </div>
    </div>
  )
}
