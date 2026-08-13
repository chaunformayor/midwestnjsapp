'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createBrowserClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    })
    setDone(true)
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl shadow-xl p-8 text-center">
        <h2 className="font-head text-navy text-xl mb-2">Check Your Email</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          If an account exists for <strong>{email}</strong>, you&apos;ll receive a password reset link shortly.
        </p>
        <Link href="/login" className="mt-6 inline-block text-gold text-sm font-semibold hover:text-gold-dark transition">
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-8">
      <h1 className="font-head text-navy text-2xl mb-1">Reset Password</h1>
      <p className="text-gray-500 text-sm mb-6">Enter your email and we&apos;ll send you a reset link.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <Button type="submit" loading={loading} className="w-full mt-1">Send Reset Link</Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        <Link href="/login" className="text-gold font-semibold hover:text-gold-dark transition">← Back to sign in</Link>
      </p>
    </div>
  )
}
