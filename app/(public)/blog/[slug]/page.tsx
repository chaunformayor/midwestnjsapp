import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fmtDate } from '@/lib/utils'

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data: post } = await supabase.from('posts').select('title, excerpt').eq('slug', slug).single()
  if (!post) return {}
  return { title: post.title, description: post.excerpt }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data: post } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (!post) notFound()

  return (
    <>
      {/* Hero */}
      <section className="bg-navy py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-white/40 text-sm mb-6">
            <Link href="/blog" className="hover:text-gold transition">Blog</Link>
            {' / '}
            <span className="text-white/60">{post.title}</span>
          </p>
          {post.category && (
            <span className="inline-block text-[11px] uppercase tracking-widest font-semibold text-gold border border-gold/50 rounded-full px-3 py-1 mb-5">
              {post.category}
            </span>
          )}
          <h1 className="font-head text-white text-4xl sm:text-5xl leading-tight mb-5">{post.title}</h1>
          <div className="flex items-center gap-5 text-white/40 text-sm">
            {post.published_at && <span>{fmtDate(post.published_at)}</span>}
            {post.read_time && <span>{post.read_time}</span>}
          </div>
        </div>
      </section>

      {/* Cover image */}
      {post.cover_image_url && (
        <div className="max-w-5xl mx-auto px-6 -mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full h-64 sm:h-80 object-cover rounded-xl shadow-xl"
          />
        </div>
      )}

      {/* Body */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div
            className="prose prose-sm max-w-none
              prose-headings:font-head prose-headings:text-navy
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-gray-600 prose-p:leading-relaxed
              prose-li:text-gray-600
              prose-strong:text-navy
              prose-a:text-gold prose-a:no-underline hover:prose-a:underline"
            dangerouslySetInnerHTML={{ __html: post.content ?? '' }}
          />

          {/* Back link */}
          <div className="mt-14 pt-8 border-t border-gray-100">
            <Link href="/blog" className="inline-flex items-center gap-2 text-gold font-semibold text-sm hover:underline">
              ← Back to Blog
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
