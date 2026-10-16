'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { DEFAULT_WEIGHTS, DIMENSIONS, MAX_WEIGHT, type Weights } from '@/lib/onboarding/review/config'

const btn = 'inline-flex items-center justify-center gap-2 font-semibold text-sm rounded px-4 py-2.5 transition border disabled:opacity-50'

export default function WeightsForm({ initial }: { initial: Weights }) {
  const [w, setW] = useState<Weights>(initial)
  const [saved, setSaved] = useState<Weights>(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const dirty = JSON.stringify(w) !== JSON.stringify(saved)

  async function save(next: Weights = w) {
    setBusy(true); setMsg(''); setErr('')
    try {
      const res = await fetch('/api/admin/onboarding/weights', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weights: next }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.error || 'That did not save.'); return }
      setW(j.weights); setSaved(j.weights); setMsg('Saved. New reviews use these weights.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {DIMENSIONS.map((d) => (
        <div key={d.key} className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor={`w-${d.key}`} className="font-semibold text-navy">{d.label}</label>
              <p className="text-sm text-gray-500 mt-1 max-w-[62ch]">{d.blurb}</p>
              <p className="text-xs text-gray-400 mt-1">Starting weight {DEFAULT_WEIGHTS[d.key]}{d.goals.length ? ' · raised or lowered by the client’s own goal ratings' : ''}</p>
            </div>
            <div className="flex items-center gap-3">
              <input id={`w-${d.key}`} type="range" min={0} max={MAX_WEIGHT} step={0.5} value={w[d.key]}
                onChange={(e) => setW((cur) => ({ ...cur, [d.key]: Number(e.target.value) }))} className="w-40 accent-[#C9A84C]" />
              <span className={cn('w-12 text-right font-semibold tabular-nums', w[d.key] === 0 ? 'text-gray-400' : 'text-navy')}>{w[d.key] === 0 ? 'Off' : w[d.key]}</span>
            </div>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={cn(btn, 'border-gold bg-gold text-navy hover:bg-gold-dark')} disabled={busy || !dirty} onClick={() => save()}>Save weights</button>
        <button type="button" className={cn(btn, 'border-gray-200 text-navy bg-white hover:border-gold')} disabled={busy} onClick={() => { setW(DEFAULT_WEIGHTS) }}>Reset to starting weights</button>
        {msg && <span role="status" className="text-sm text-green-800">{msg}</span>}
        {err && <span role="alert" className="text-sm text-red-700">{err}</span>}
      </div>
      <p className="text-xs text-gray-400">Weights run from 0 (ignore this area) to {MAX_WEIGHT} (most important). Past reviews keep the weights they were run with.</p>
    </div>
  )
}
