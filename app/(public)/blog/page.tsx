import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { fmtDate } from '@/lib/utils'
import type { Post } from '@/types/database'

export const revalidate = 60

type PostRow = Partial<Post> & { id: string; title: string; slug: string }

export default async function BlogPage() {
  const supabase = createAdminClient()
  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, category, published_at, cover_image_url, read_time')
    .eq('published', true)
    .order('published_at', { ascending: false })

  const [featured, ...rest] = (posts ?? []) as PostRow[]

  return (
    <>
      {/* Hero */}
      <section className="bg-navy py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-white/40 text-sm mb-6">Home / Blog</p>
          <h1 className="font-head text-white text-5xl sm:text-6xl mb-4">Insights &amp; Resources</h1>
          <p className="text-white/65 text-base max-w-xl">
            St. Louis market intelligence, investing strategies, and portfolio insights from our team.
          </p>
        </div>
      </section>

      {/* Featured / Latest Article */}
      {featured && (
        <section className="py-14 bg-white">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-px bg-gold" />
              <span className="text-[11px] uppercase tracking-widest font-semibold text-navy/70">Latest Article</span>
            </div>
            <Link href={`/blog/${featured.slug}`} className="group grid sm:grid-cols-2 gap-10 items-center">
              {featured.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featured.cover_image_url}
                  alt={featured.title}
                  className="w-full h-72 sm:h-80 object-cover rounded-xl"
                />
              )}
              <div>
                {featured.category && (
                  <span className="inline-block text-[11px] uppercase tracking-widest font-semibold text-gold border border-gold/50 rounded-full px-3 py-1 mb-5">
                    {featured.category}
                  </span>
                )}
                <h2 className="font-head text-navy text-3xl sm:text-4xl leading-tight mb-4 group-hover:text-gold transition">
                  {featured.title}
                </h2>
                {featured.excerpt && (
                  <p className="text-gray-500 text-sm leading-relaxed mb-6">{featured.excerpt}</p>
                )}
                <div className="flex items-center gap-5 text-sm text-gray-400">
                  {featured.published_at && <span>{fmtDate(featured.published_at)}</span>}
                  {featured.read_time && <span>{featured.read_time}</span>}
                </div>
                <p className="mt-5 text-gold font-semibold text-sm group-hover:underline">Read Article →</p>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Remaining posts grid */}
      {rest.length > 0 && (
        <section className="py-14 bg-off-white">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="bg-white rounded-xl overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all group"
                >
                  {post.cover_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="w-full h-44 object-cover"
                    />
                  )}
                  <div className="p-6">
                    {post.category && (
                      <span className="inline-block text-[10px] uppercase tracking-widest font-semibold text-gold border border-gold/40 rounded-full px-2.5 py-0.5 mb-3">
                        {post.category}
                      </span>
                    )}
                    <h3 className="font-head text-navy text-lg leading-snug mb-2 group-hover:text-gold transition">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-4">{post.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      {post.published_at && <span>{fmtDate(post.published_at)}</span>}
                      <span className="text-gold font-semibold text-sm">Read →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter CTA */}
      <section className="bg-navy py-16 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="font-head text-white text-2xl sm:text-3xl mb-3">Get Market Updates in Your Inbox</h2>
          <p className="text-white/60 text-sm mb-8">
            Monthly St. Louis market data, investment opportunities, and property management insights — no spam.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-gold text-navy font-bold text-sm px-8 py-3 rounded-lg hover:bg-gold/90 transition"
          >
            Subscribe
          </Link>
        </div>
      </section>
    </>
  )
}
