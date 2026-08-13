'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function ApproveButton({ userId, email, name }: { userId: string; email: string; name?: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleApprove() {
    setLoading(true)
    await fetch('/api/admin/approve-investor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, name }),
    })
    router.refresh()
  }

  return (
    <Button size="sm" onClick={handleApprove} loading={loading}>
      Approve
    </Button>
  )
}
