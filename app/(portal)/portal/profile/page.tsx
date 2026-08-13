'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Profile } from '@/types/database'

export default function PortalProfilePage() {
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setProfile(data)
        setForm({ full_name: data.full_name || '', phone: data.phone || '' })
      }
    }
    load()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update(form).eq('id', user.id)
    setStatus(error ? 'error' : 'done')
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-head text-navy text-3xl mb-1">My Profile</h1>
      <p className="text-gray-500 text-sm mb-8">Update your name and contact details.</p>

      <div className="bg-white rounded-xl border border-gray-100 p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Account Email</div>
          <div className="text-sm text-navy font-semibold -mt-2 pb-2 border-b border-gray-100">{profile.email || '—'}</div>
          <Input label="Full Name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          <Input label="Phone Number" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          {status === 'done' && <p className="text-green-600 text-sm">Profile updated.</p>}
          {status === 'error' && <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>}
          <Button type="submit" loading={status === 'loading'} className="self-start">Save Changes</Button>
        </form>
      </div>
    </div>
  )
}
