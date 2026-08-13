'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', confirm: '', full_name: '', phone: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    const supabase = createBrowserClient()
    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, phone: form.phone } },
    })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl shadow-xl p-8 text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="font-head text-navy text-xl mb-2">Request Received</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your account request has been submitted. Our team reviews new investor applications within 24–48 hours.
          You&apos;ll receive an email once your account is approved.
        </p>
        <Link href="/" className="mt-6 inline-block text-gold text-sm font-semibold hover:text-gold-dark transition">
          ← Back to main site
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-8">
      <h1 className="font-head text-navy text-2xl mb-1">Request Access</h1>
      <p className="text-gray-500 text-sm mb-6">Investor accounts are reviewed manually and approved within 24–48 hours.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Full Name" type="text" value={form.full_name} onChange={set('full_name')} required />
        <Input label="Email Address" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
        <Input label="Phone Number" type="tel" value={form.phone} onChange={set('phone')} />
        <Input label="Password" type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" hint="Minimum 8 characters" />
        <Input label="Confirm Password" type="password" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <Button type="submit" loading={loading} className="w-full mt-1">
          Submit Request
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        Already have access?{' '}
        <Link href="/login" className="text-gold font-semibold hover:text-gold-dark transition">Sign in</Link>
      </p>
    </div>
  )
}
