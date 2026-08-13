'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push('/portal')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-8">
      <h1 className="font-head text-navy text-2xl mb-1">Welcome Back</h1>
      <p className="text-gray-500 text-sm mb-6">Sign in to access your investor portal.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <Button type="submit" loading={loading} className="w-full mt-1">
          Sign In
        </Button>
      </form>

      <div className="mt-5 flex flex-col gap-2 text-center text-sm text-gray-500">
        <Link href="/forgot-password" className="hover:text-gold transition">
          Forgot your password?
        </Link>
        <span>
          Need access?{' '}
          <Link href="/signup" className="text-gold font-semibold hover:text-gold-dark transition">
            Request an account
          </Link>
        </span>
      </div>
    </div>
  )
}
