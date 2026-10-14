'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, ExternalLink, Mail, MailCheck, RefreshCw, RotateCcw, XCircle, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EngagementStatus } from '@/lib/onboarding/config'

const btn = 'inline-flex items-center justify-center gap-2 font-semibold text-sm rounded px-4 py-2.5 transition border disabled:opacity-50'
const ghost = cn(btn, 'border-gray-200 text-navy bg-white hover:border-gold hover:bg-gold/10')

export default function EngagementActions({ id, link, status, email, person = 'client', submitted = false }: { id: string; link: string | null; status: EngagementStatus; email: string; person?: 'client' | 'spouse'; submitted?: boolean }) {
  const isMain = person === 'client'
  const router = useRouter()
  const [current, setCurrent] = useState(link)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState('')

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setMsg(''); setErr('')
    try {
      const res = await fetch(`/api/admin/onboarding/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, person, ...extra }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.error || 'That did not work.'); return }
      if (j.link) setCurrent(j.link)
      setMsg(j.message || 'Done.')
      setConfirm('')
      router.refresh()
    } finally {
      setBusy('')
    }
  }

  async function copy() {
    if (!current) return
    try {
      await navigator.clipboard.writeText(current)
      setMsg('Link copied.')
    } catch {
      const el = document.getElementById(`link-${person}`) as HTMLInputElement | null
      el?.focus(); el?.select()
      setMsg('Press Ctrl+C to copy.')
    }
  }

  const closed = status === 'canceled'
  return (
    <div className="flex flex-col gap-4">
      {current && !closed ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <input id={`link-${person}`} readOnly value={current} aria-label={isMain ? 'Client link' : 'Spouse or co-owner link'} className="flex-1 min-w-0 border border-gray-200 rounded px-3 py-2.5 text-xs font-mono bg-gray-50 text-gray-700" />
          <button type="button" className={ghost} onClick={copy}><Copy className="w-4 h-4" /> Copy</button>
          <a href={current} target="_blank" rel="noopener noreferrer" className={ghost}><ExternalLink className="w-4 h-4" /> Open as client</a>
        </div>
      ) : !closed ? (
        <p className="text-sm text-gray-500">This link can&apos;t be shown. Make a new link to get one.</p>
      ) : null}
      {!closed && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ghost} disabled={!!busy || !current} onClick={() => act('resend')}><Mail className="w-4 h-4" /> Email onboarding link to {email}</button>
          {confirm === 'new-link'
            ? <button type="button" className={cn(btn, 'border-amber-300 bg-amber-50 text-amber-900')} disabled={!!busy} onClick={() => act('new-link', { send: true })}><Link2 className="w-4 h-4" /> Confirm: replace and email new link</button>
            : <button type="button" className={ghost} disabled={!!busy} onClick={() => setConfirm('new-link')}><Link2 className="w-4 h-4" /> Make a new link</button>}
          {submitted && <button type="button" className={ghost} disabled={!!busy} onClick={() => act('rebuild-pdf')}><RefreshCw className={cn('w-4 h-4', busy === 'rebuild-pdf' && 'animate-spin')} /> Rebuild answers PDF</button>}
          {isMain && status === 'signing' && <button type="button" className={ghost} disabled={!!busy} onClick={() => act('remind')}><MailCheck className="w-4 h-4" /> Resend signing email</button>}
          {isMain && status === 'signing' && <button type="button" className={ghost} disabled={!!busy} onClick={() => act('refresh')}><RefreshCw className={cn('w-4 h-4', busy === 'refresh' && 'animate-spin')} /> Check LibreSign now</button>}
          {isMain && status === 'signing' && (confirm === 'reset'
            ? <button type="button" className={cn(btn, 'border-amber-300 bg-amber-50 text-amber-900')} disabled={!!busy} onClick={() => act('reset-signing')}><RotateCcw className="w-4 h-4" /> Confirm reset</button>
            : <button type="button" className={ghost} disabled={!!busy} onClick={() => setConfirm('reset')}><RotateCcw className="w-4 h-4" /> Reset signing</button>)}
          {isMain && (confirm === 'cancel'
            ? <button type="button" className={cn(btn, 'border-red-300 bg-red-50 text-red-700')} disabled={!!busy} onClick={() => act('cancel')}><XCircle className="w-4 h-4" /> Confirm: turn off this link</button>
            : <button type="button" className={cn(ghost, 'text-red-700')} disabled={!!busy} onClick={() => setConfirm('cancel')}><XCircle className="w-4 h-4" /> Cancel onboarding</button>)}
        </div>
      )}
      {confirm === 'new-link' && <p className="text-xs text-gray-500">The old link stops working, and the new one is emailed to the client.</p>}
      {confirm === 'reset' && <p className="text-xs text-gray-500">Use this if a signer&apos;s email was wrong. The client sends the agreements again; cancel the old request in LibreSign.</p>}
      {msg && <p role="status" className="text-sm text-green-800">{msg}</p>}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
    </div>
  )
}
