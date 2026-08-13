import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Resource } from '@/types/database'

const TYPE_ICONS: Record<string, string> = {
  template: '📋',
  guide: '📖',
  report: '📊',
  spreadsheet: '📗',
  video: '🎥',
  other: '📄',
}

export default async function PortalResourcesPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: resources } = await supabase
    .from('resources')
    .select('*')
    .order('created_at', { ascending: false })

  const grouped = (resources as Resource[] || []).reduce((acc, r) => {
    const key = r.type || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {} as Record<string, Resource[]>)

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-head text-navy text-3xl">Resource Library</h1>
        <p className="text-gray-500 text-sm mt-1">Templates, guides, reports, and tools — exclusively for investors.</p>
      </div>

      {Object.keys(grouped).length > 0 ? (
        Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="mb-10">
            <h2 className="text-xs uppercase tracking-widest font-semibold text-gold mb-4 capitalize">{type}s</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((r: Resource) => (
                <a key={r.id} href={r.file_url ?? undefined} target="_blank" rel="noopener noreferrer"
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:-translate-y-0.5 hover:shadow-md hover:border-gold/30 transition-all flex gap-4 items-start">
                  <div className="text-3xl shrink-0">{TYPE_ICONS[r.type] || '📄'}</div>
                  <div>
                    <div className="font-medium text-navy text-sm">{r.title}</div>
                    {r.description && <p className="text-gray-500 text-xs mt-1 leading-relaxed">{r.description}</p>}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 text-center py-16">
          <p className="text-gray-400 text-sm">Resources will be added here soon. Check back shortly.</p>
        </div>
      )}
    </div>
  )
}
