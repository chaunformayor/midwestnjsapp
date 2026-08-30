import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { ArrowLeft } from 'lucide-react'

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
      <section className="bg-navy py-20">
        <div className="max-w-3xl mx-auto px-6">
          <Link href="/blog" className="inline-flex items-center gap-2 text-white/50 hover:text-gold text-sm transition mb-6">
            <ArrowLeft className="w-4 h-4" />Back to Blog
          </Link>
          {post.category && <Badge variant="gold" className="mb-4">{post.category}</Badge>}
          <h1 className="font-head text-white text-4xl sm:text-5xl leading-tight mb-4">{post.title}</h1>
          {post.published_at && (
            <div className="text-white/45 text-sm">{fmtDate(post.published_at)}</div>
          )}
        </div>
      </section>

      {post.cover_image_url && (
        <div className="max-w-5xl mx-auto px-6 -mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.cover_image_url} alt={post.title} className="w-full h-64 sm:h-80 object-cover rounded-xl shadow-xl" />
        </div>
      )}

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6">
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content ?? '' }}
          />
        </div>
      </section>
    </>
  )
}
