import { createAdminClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

export default async function AdminBlogPage() {
  const supabase = createAdminClient()
  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, slug, category, published, published_at, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-navy text-3xl">Blog / Content</h1>
          <p className="text-gray-500 text-sm mt-1">{posts?.length ?? 0} posts</p>
        </div>
        <Link href="/admin/blog/new" className="bg-gold text-navy text-sm font-semibold px-4 py-2.5 rounded hover:bg-gold-dark transition">
          + New Post
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {posts && posts.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Title</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Category</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Status</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {posts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4">
                    <div className="font-medium text-navy">{p.title}</div>
                    <div className="text-xs text-gray-400">/{p.slug}</div>
                  </td>
                  <td className="px-5 py-4">
                    {p.category && <Badge variant="gold">{p.category}</Badge>}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={p.published ? 'green' : 'gray'}>
                      {p.published ? 'Published' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {p.published_at ? fmtDate(p.published_at) : fmtDate(p.created_at)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/admin/blog/${p.id}`} className="text-gold text-xs font-semibold hover:text-gold-dark">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-16 text-gray-400 text-sm">
            No posts yet.{' '}
            <Link href="/admin/blog/new" className="text-gold font-semibold">Create your first post →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
