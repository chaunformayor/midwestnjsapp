import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Resource } from '@/types/database'

const TYPE_ICONS: Record<string, string> = {
  template:  '📋',
  guide:     '📖',
  report:    '📊',
  reference: '📄',
  video:     '🎥',
}

const TYPE_LABELS: Record<string, string> = {
  template: 'Templates', guide: 'Guides', report: 'Reports', reference: 'Reference', video: 'Videos',
}

export default async function PortalResourcesPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use admin client so RLS doesn't block — we gate access via Next.js auth above
  const admin = createAdminClient()
  const { data: resources } = await admin
    .from('resources')
    .select('*')
    .eq('published', true)
    .order('order_index', { ascending: true })

  const grouped = (resources as Resource[] ?? []).reduce((acc, r) => {
    const key = r.type ?? 'reference'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {} as Record<string, Resource[]>)

  const typeOrder = ['guide', 'template', 'report', 'reference', 'video']
  const sortedGroups = Object.entries(grouped).sort(
    ([a], [b]) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="font-head text-navy text-3xl">Resource Library</h1>
        <p className="text-gray-500 text-sm mt-1">
          Templates, guides, reports, and tools — exclusively for investors.
        </p>
      </div>

      {sortedGroups.length > 0 ? (
        <div className="flex flex-col gap-10">
          {sortedGroups.map(([type, items]) => (
            <div key={type}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-px bg-gold" />
                <h2 className="text-[11px] uppercase tracking-widest font-semibold text-navy/60">
                  {TYPE_LABELS[type] ?? type}
                </h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((r: Resource) => (
                  <a
                    key={r.id}
                    href={r.file_url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`bg-white rounded-xl border border-gray-100 p-5
                      hover:-translate-y-0.5 hover:shadow-md hover:border-gold/30
                      transition-all flex gap-4 items-start group
                      ${!r.file_url ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <div className="text-2xl shrink-0 mt-0.5">
                      {TYPE_ICONS[r.type ?? ''] ?? '📄'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-navy text-sm group-hover:text-gold transition leading-snug">
                        {r.title}
                      </div>
                      {r.description && (
                        <p className="text-gray-500 text-xs mt-1.5 leading-relaxed line-clamp-2">
                          {r.description}
                        </p>
                      )}
                      {r.file_url && (
                        <p className="text-gold text-xs font-semibold mt-2">Download →</p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 text-center py-20">
          <div className="text-4xl mb-3">📂</div>
          <p className="font-head text-navy text-lg mb-1">Coming Soon</p>
          <p className="text-gray-400 text-sm">Resources are being prepared for your library. Check back shortly.</p>
        </div>
      )}
    </div>
  )
}
