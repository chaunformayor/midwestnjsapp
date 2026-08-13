'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Editor from '@/components/admin/Editor'
import { slugify } from '@/lib/utils'
import { POST_CATEGORIES } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewPostPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', category: '', cover_image_url: '',
  })
  const [body, setBody] = useState('')
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const title = e.target.value
    setForm(f => ({ ...f, title, slug: slugify(title) }))
  }

  async function handleSave() {
    setLoading(true)
    setError('')
    const supabase = createBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('posts').insert({
      ...form, body, published,
      author_id: user?.id,
      published_at: published ? new Date().toISOString() : null,
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/admin/blog')
    router.refresh()
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/admin/blog" className="inline-flex items-center gap-2 text-gray-400 hover:text-navy text-sm transition mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Blog
      </Link>
      <h1 className="font-head text-navy text-3xl mb-8">New Post</h1>

      <div className="flex flex-col gap-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Title" value={form.title} onChange={handleTitleChange} required />
          <Input label="Slug" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required hint="URL path: /blog/your-slug" />
        </div>
        <Input label="Excerpt" value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} hint="Short summary shown in listings" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            <option value="">Select category…</option>
            {POST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Input label="Cover Image URL" value={form.cover_image_url} onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))} type="url" />
        </div>

        <div>
          <label className="text-sm font-semibold text-navy block mb-2">Content</label>
          <Editor content={body} onChange={setBody} placeholder="Write your post…" />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)}
              className="rounded border-gray-300 text-gold focus:ring-gold" />
            Publish immediately
          </label>
          <div className="flex gap-3">
            <Link href="/admin/blog" className="border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded hover:bg-gray-50 transition">
              Cancel
            </Link>
            <Button onClick={handleSave} loading={loading}>
              {published ? 'Publish' : 'Save Draft'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
