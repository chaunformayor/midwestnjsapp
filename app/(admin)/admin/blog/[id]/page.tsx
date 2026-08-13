'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Editor from '@/components/admin/Editor'
import { slugify } from '@/lib/utils'
import { POST_CATEGORIES } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function EditPostPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [form, setForm] = useState({ title: '', slug: '', excerpt: '', category: '', cover_image_url: '' })
  const [body, setBody] = useState('')
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const supabase = createBrowserClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('posts').select('*').eq('id', id).single()
      if (data) {
        setForm({ title: data.title, slug: data.slug, excerpt: data.excerpt || '', category: data.category || '', cover_image_url: data.cover_image_url || '' })
        setBody(data.body || '')
        setPublished(data.published || false)
      }
    }
    load()
  }, [id, supabase])

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const title = e.target.value
    setForm(f => ({ ...f, title, slug: slugify(title) }))
  }

  async function handleSave() {
    setLoading(true); setError('')
    const updates: Record<string, unknown> = { ...form, body, published }
    if (published) updates.published_at = new Date().toISOString()
    const { error: err } = await supabase.from('posts').update(updates).eq('id', id)
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/admin/blog'); router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this post permanently?')) return
    setDeleting(true)
    await supabase.from('posts').delete().eq('id', id)
    router.push('/admin/blog'); router.refresh()
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/admin/blog" className="inline-flex items-center gap-2 text-gray-400 hover:text-navy text-sm transition mb-6">
        <ArrowLeft className="w-4 h-4" />Back to Blog
      </Link>
      <h1 className="font-head text-navy text-3xl mb-8">Edit Post</h1>

      <div className="flex flex-col gap-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Title" value={form.title} onChange={handleTitleChange} required />
          <Input label="Slug" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required hint="URL path: /blog/your-slug" />
        </div>
        <Input label="Excerpt" value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            <option value="">Select category…</option>
            {POST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Input label="Cover Image URL" value={form.cover_image_url} onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))} type="url" />
        </div>

        <div>
          <label className="text-sm font-semibold text-navy block mb-2">Content</label>
          {body !== undefined && <Editor content={body} onChange={setBody} />}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)}
                className="rounded border-gray-300 text-gold focus:ring-gold" />
              Published
            </label>
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>Delete</Button>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/blog" className="border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded hover:bg-gray-50 transition">
              Cancel
            </Link>
            <Button onClick={handleSave} loading={loading}>Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
