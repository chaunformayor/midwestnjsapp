'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/portal')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-8">
      <h1 className="font-head text-navy text-2xl mb-1">Set New Password</h1>
      <p className="text-gray-500 text-sm mb-6">Choose a strong password for your account.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="New Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" hint="Minimum 8 characters" />
        <Input label="Confirm Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <Button type="submit" loading={loading} className="w-full mt-1">Update Password</Button>
      </form>
    </div>
  )
}
