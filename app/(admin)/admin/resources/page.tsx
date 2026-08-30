'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { fmtDate } from '@/lib/utils'
import type { Resource } from '@/types/database'

const TYPES = ['guide', 'template', 'report', 'reference', 'video'] as const

const TYPE_LABELS: Record<string, string> = {
  guide: 'Guide', template: 'Template', report: 'Report', reference: 'Reference', video: 'Video',
}

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [form, setForm] = useState({ title: '', description: '', file_url: '', type: 'guide', published: true })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [uploadedName, setUploadedName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createBrowserClient()

  async function load() {
    const { data } = await supabase
      .from('resources')
      .select('*')
      .order('order_index', { ascending: true })
    if (data) setResources(data as Resource[])
  }

  useEffect(() => { load() }, [])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadedName('')
    const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '')
    const path = `${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from('resources').upload(path, file)
    if (error) {
      alert('Upload failed: ' + error.message)
    } else {
      const { data: urlData } = supabase.storage.from('resources').getPublicUrl(path)
      setForm(f => ({ ...f, file_url: urlData.publicUrl }))
      setUploadedName(file.name)
    }
    setUploading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.file_url) return
    setLoading(true)
    await supabase.from('resources').insert({
      title: form.title,
      description: form.description || null,
      file_url: form.file_url,
      type: form.type,
      published: form.published,
      order_index: resources.length,
    })
    setForm({ title: '', description: '', file_url: '', type: 'guide', published: true })
    setUploadedName('')
    if (fileRef.current) fileRef.current.value = ''
    setShowForm(false)
    setLoading(false)
    await load()
  }

  async function togglePublished(id: string, current: boolean) {
    await supabase.from('resources').update({ published: !current }).eq('id', id)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this resource?')) return
    await supabase.from('resources').delete().eq('id', id)
    await load()
  }

  const published = resources.filter(r => r.published)
  const drafts = resources.filter(r => !r.published)

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-navy text-3xl">Resources</h1>
          <p className="text-gray-500 text-sm mt-1">
            {published.length} published · {drafts.length} draft
          </p>
        </div>
        <Button onClick={() => setShowForm(s => !s)} variant="outline-gold">
          {showForm ? 'Cancel' : '+ Add Resource'}
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gold/30 p-6 mb-6">
          <h2 className="font-head text-navy text-lg mb-5">Add Resource</h2>
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
              <Select
                label="Type"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                {TYPES.map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </Select>
            </div>
            <Input
              label="Description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description visible to investors"
            />

            {/* File upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Upload File
              </label>
              <input
                ref={fileRef}
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.xlsx,.xls,.csv,.docx,.pptx,.mp4,.mov"
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                  file:text-sm file:font-semibold file:bg-gold/10 file:text-gold
                  hover:file:bg-gold/20 cursor-pointer"
              />
              {uploading && (
                <p className="text-xs text-gray-400 mt-1.5">Uploading...</p>
              )}
              {uploadedName && !uploading && (
                <p className="text-xs text-green-600 mt-1.5">✓ {uploadedName} uploaded</p>
              )}
            </div>

            {/* Or external URL */}
            <div>
              <Input
                label="Or paste external URL"
                value={form.file_url}
                onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
                type="url"
                placeholder="https://docs.google.com/..."
              />
            </div>

            <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.published}
                onChange={e => setForm(f => ({ ...f, published: e.target.checked }))}
                className="rounded border-gray-300 accent-gold"
              />
              Publish immediately (visible to investors)
            </label>

            <Button
              type="submit"
              loading={loading}
              disabled={!form.title || !form.file_url || uploading}
              className="self-start"
            >
              Add Resource
            </Button>
          </form>
        </div>
      )}

      {resources.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Resource</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Type</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Status</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Added</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {resources.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4">
                    {r.file_url ? (
                      <a href={r.file_url} target="_blank" rel="noopener noreferrer"
                        className="font-medium text-navy hover:text-gold transition">
                        {r.title}
                      </a>
                    ) : (
                      <span className="font-medium text-navy/60">{r.title}</span>
                    )}
                    {r.description && (
                      <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{r.description}</div>
                    )}
                    {!r.file_url && (
                      <div className="text-xs text-amber-500 mt-0.5">No file uploaded yet</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-gray-500">{TYPE_LABELS[r.type ?? ''] ?? r.type}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => togglePublished(r.id, r.published)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${
                        r.published
                          ? 'bg-green-50 text-green-600 hover:bg-red-50 hover:text-red-500'
                          : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'
                      }`}
                    >
                      {r.published ? 'Published' : 'Draft'}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-red-400 hover:text-red-600 text-xs font-semibold transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 text-center py-16 text-gray-400 text-sm">
          No resources yet. Add your first one above.
        </div>
      )}
    </div>
  )
}
