'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { fmtDate } from '@/lib/utils'
import type { Resource } from '@/types/database'

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [form, setForm] = useState({ title: '', description: '', file_url: '', type: 'guide' })
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const supabase = createBrowserClient()

  async function load() {
    const { data } = await supabase.from('resources').select('*').order('created_at', { ascending: false })
    if (data) setResources(data as Resource[])
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('resources').insert(form)
    setForm({ title: '', description: '', file_url: '', type: 'guide' })
    setShowForm(false)
    setLoading(false)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this resource?')) return
    await supabase.from('resources').delete().eq('id', id)
    await load()
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-navy text-3xl">Resources</h1>
          <p className="text-gray-500 text-sm mt-1">{resources.length} resources in the investor library</p>
        </div>
        <Button onClick={() => setShowForm(s => !s)} variant="outline-gold">
          {showForm ? 'Cancel' : '+ Add Resource'}
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gold/30 p-6 mb-6">
          <h2 className="font-head text-navy text-lg mb-4">Add Resource</h2>
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              <Select label="Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {['guide', 'template', 'report', 'spreadsheet', 'video', 'other'].map(t => (
                  <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </Select>
            </div>
            <Input label="File URL" value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} type="url" required />
            <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <Button type="submit" loading={loading} className="self-start">Add Resource</Button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {resources.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Resource</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Type</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-400 font-semibold">Added</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {resources.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4">
                    <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="font-medium text-navy hover:text-gold transition">{r.title}</a>
                    {r.description && <div className="text-xs text-gray-400 mt-0.5">{r.description}</div>}
                  </td>
                  <td className="px-5 py-4 text-gray-500 capitalize">{r.type}</td>
                  <td className="px-5 py-4 text-gray-500">{fmtDate(r.created_at)}</td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600 text-xs font-semibold transition">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-16 text-gray-400 text-sm">No resources yet.</div>
        )}
      </div>
    </div>
  )
}
