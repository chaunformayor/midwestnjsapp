import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { Post } from '@/types/database'

export const revalidate = 60

export default async function BlogPage() {
  const supabase = createAdminClient()
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, category, published_at, cover_image_url')
    .eq('published', true)
    .order('published_at', { ascending: false })

  return (
    <>
      <section className="bg-navy py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-[11px] uppercase tracking-widest font-semibold text-gold mb-3">Market Updates</div>
          <h1 className="font-head text-white text-4xl sm:text-5xl mb-4">Blog</h1>
          <p className="text-white/65 text-base">St. Louis market intelligence, investing strategies, and portfolio insights from our team.</p>
        </div>
      </section>

      <section className="py-20 bg-off-white">
        <div className="max-w-5xl mx-auto px-6">
          {posts && posts.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post: Partial<Post> & { id: string; title: string; slug: string }) => (
                <Link key={post.id} href={`/blog/${post.slug}`}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:-translate-y-1 hover:shadow-lg hover:border-gold/30 transition-all group">
                  {post.cover_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.cover_image_url} alt={post.title} className="w-full h-44 object-cover" />
                  )}
                  <div className="p-6">
                    {post.category && (
                      <Badge variant="gold" className="mb-3">{post.category}</Badge>
                    )}
                    <h2 className="font-head text-navy text-lg leading-snug mb-2 group-hover:text-gold transition">{post.title}</h2>
                    {post.excerpt && <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">{post.excerpt}</p>}
                    {post.published_at && (
                      <div className="text-xs text-gray-400 mt-3">{fmtDate(post.published_at)}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg font-head text-navy mb-2">No posts yet</p>
              <p className="text-sm">Market updates and articles will appear here soon.</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
