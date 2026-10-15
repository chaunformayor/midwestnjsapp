'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, FileText, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { URGENCY_LABEL, type ReviewRecord } from '@/lib/onboarding/review/config'

const btn = 'inline-flex items-center justify-center gap-2 font-semibold text-sm rounded px-4 py-2.5 transition border disabled:opacity-50'
const ghost = cn(btn, 'border-gray-200 text-navy bg-white hover:border-gold hover:bg-gold/10')
const primary = cn(btn, 'border-gold bg-gold text-navy hover:bg-gold-dark')

function Chip({ tone, children }: { tone: 'gray' | 'red' | 'amber' | 'green'; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center text-xs font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap',
      tone === 'red' && 'bg-red-100 text-red-800', tone === 'amber' && 'bg-amber-100 text-amber-800',
      tone === 'green' && 'bg-green-100 text-green-800', tone === 'gray' && 'bg-gray-100 text-gray-600')}>
      {children}
    </span>
  )
}

const scoreTone = (n: number | null) => (n == null ? 'gray' : n >= 66 ? 'red' : n >= 33 ? 'amber' : 'green') as 'gray' | 'red' | 'amber' | 'green'
const urgencyTone = { now: 'red', soon: 'amber', later: 'gray' } as const

export default function ReviewPanel({ id, initial, canRun, aiReady, hasFolder, readyNote }: {
  id: string
  initial: ReviewRecord | null
  canRun: boolean
  aiReady: boolean
  hasFolder: boolean
  readyNote: string
}) {
  const [review, setReview] = useState<ReviewRecord | null>(initial)
  const [included, setIncluded] = useState<string[]>(initial?.included ?? [])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [pdfMade, setPdfMade] = useState(Boolean(initial?.client_pdf_at))

  const dirty = useMemo(() => {
    if (!review) return false
    const a = [...included].sort().join('|')
    const b = [...review.included].sort().join('|')
    return a !== b || Object.keys(edits).length > 0
  }, [included, edits, review])

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, init)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'That did not work.')
    }
    return res
  }

  async function run() {
    setBusy('run'); setMsg(''); setErr('')
    try {
      const res = await call(`/api/admin/onboarding/${id}/review`, { method: 'POST' })
      const j = (await res.json()) as { review: ReviewRecord }
      setReview(j.review); setIncluded(j.review.included); setEdits({}); setPdfMade(false)
      setMsg('Review ready.')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  async function save(): Promise<ReviewRecord | null> {
    if (!review) return null
    const res = await call(`/api/admin/onboarding/${id}/review`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_id: review.id, included, edits }),
    })
    const j = (await res.json()) as { review: ReviewRecord }
    setReview(j.review); setIncluded(j.review.included); setEdits({})
    return j.review
  }

  async function onSave() {
    setBusy('save'); setMsg(''); setErr('')
    try { await save(); setMsg('Saved.') } catch (e) { setErr((e as Error).message) } finally { setBusy('') }
  }

  async function onPdf() {
    setBusy('pdf'); setMsg(''); setErr('')
    try {
      if (dirty) await save()
      const res = await call(`/api/admin/onboarding/${id}/review/pdf`, { method: 'POST' })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'MIS Recommendations.pdf'; a.click()
      URL.revokeObjectURL(url)
      setPdfMade(true)
      setMsg('Client PDF created, downloaded, and saved in the client’s Nextcloud folder under Review.')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  const toggle = (rid: string) => setIncluded((cur) => (cur.includes(rid) ? cur.filter((x) => x !== rid) : [...cur, rid]))
  const out = review?.review
  const scores = review?.scores

  return (
    <section className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="font-head text-navy text-xl">Review and recommendations</h2>
          <p className="text-sm text-gray-500 mt-1">Scores each area from the answers using your <Link href="/admin/onboarding/weights" className="underline underline-offset-2 hover:text-gold-dark">weights</Link>, then Claude writes recommendations. For you first; nothing reaches the client unless you make the PDF.</p>
        </div>
        <button type="button" className={primary} disabled={!!busy || !canRun || !aiReady} onClick={run}>
          {busy === 'run' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {busy === 'run' ? 'Reviewing… about a minute' : review ? 'Run a new review' : 'Run review'}
        </button>
      </div>
      {!aiReady && <p className="text-sm text-amber-800 bg-amber-50 rounded px-3 py-2 mt-3">The AI review isn&apos;t set up. Add <code>ANTHROPIC_API_KEY</code> in Vercel, then redeploy.</p>}
      {aiReady && !canRun && <p className="text-sm text-gray-500 mt-3">{readyNote}</p>}
      {msg && <p role="status" className="text-sm text-green-800 mt-3">{msg}</p>}
      {err && <p role="alert" className="text-sm text-red-700 mt-3">{err}</p>}

      {review && out && scores && (
        <div className="flex flex-col gap-7 mt-6">
          <div className="text-xs text-gray-400">Reviewed {new Date(review.created_at).toLocaleString()} · {review.model} · overall attention index {scores.index ?? 'n/a'} of 100 (higher means more needs attention)</div>

          <div>
            <h3 className="font-semibold text-navy text-sm mb-2">Summary</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{out.summary}</p>
          </div>

          <div>
            <h3 className="font-semibold text-navy text-sm mb-2">Weighted scores</h3>
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 bg-gray-50">
                    <th className="px-3 py-2">Area</th>
                    <th className="px-3 py-2">Weight</th>
                    <th className="px-3 py-2">Goal factor</th>
                    {scores.people.map((p) => <th key={p.name} className="px-3 py-2">{p.name.split(' ')[0]}</th>)}
                    <th className="px-3 py-2">Household</th>
                    <th className="px-3 py-2">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scores.rows.map((r) => (
                    <tr key={r.key} className="align-top">
                      <td className="px-3 py-2.5">
                        <details>
                          <summary className="cursor-pointer font-semibold text-navy">{r.label}{r.disagree && <span className="ml-2 text-xs font-normal text-amber-700">they differ</span>}</summary>
                          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-gray-600 list-disc pl-4">
                            {r.notes.length ? r.notes.map((n, i) => <li key={i}>{scores.people.length > 1 && <b>{n.who.split(' ')[0]}: </b>}{n.text}</li>) : <li>Nothing flagged.</li>}
                          </ul>
                        </details>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{r.weight}/5</td>
                      <td className="px-3 py-2.5 tabular-nums">×{r.goalFactor}</td>
                      {r.people.map((p) => <td key={p.name} className="px-3 py-2.5">{p.score == null ? <span className="text-gray-400">n/a</span> : <Chip tone={scoreTone(p.score)}>{p.score}</Chip>}</td>)}
                      <td className="px-3 py-2.5">{r.household == null ? <span className="text-gray-400">n/a</span> : <Chip tone={scoreTone(r.household)}>{r.household}</Chip>}</td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold">{r.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">Priority = household score × weight × goal factor. The goal factor is 1.5, 1, or 0.6 from how High, Medium, or Low the client rated the related goals.</p>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="font-semibold text-navy text-sm">Recommendations</h3>
              <span className="text-xs text-gray-500">Tick the ones to share. You can edit the client wording.</span>
            </div>
            <ol className="flex flex-col gap-3">
              {out.priorities.map((r, i) => (
                <li key={r.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <label className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer">
                      <input type="checkbox" checked={included.includes(r.id)} onChange={() => toggle(r.id)} className="mt-1 h-[18px] w-[18px] accent-[#C9A84C]" aria-label={`Include in client PDF: ${r.title}`} />
                      <span className="font-semibold text-navy text-sm">{i + 1}. {r.title}</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip tone={urgencyTone[r.urgency]}>{URGENCY_LABEL[r.urgency]}</Chip>
                      <Chip tone="gray">{r.owner}</Chip>
                      <Chip tone="gray">{r.confidence} confidence</Chip>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-2"><b className="text-navy">Why:</b> {r.rationale}</p>
                  <p className="text-sm text-gray-700 mt-1"><b className="text-navy">Next step:</b> {r.next_step}</p>
                  <label className="block mt-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Client wording</span>
                    <textarea value={edits[r.id] ?? r.client_text} rows={3}
                      onChange={(e) => setEdits((cur) => ({ ...cur, [r.id]: e.target.value }))}
                      className="mt-1 w-full border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold" />
                  </label>
                </li>
              ))}
            </ol>
          </div>

          {out.couple_notes.length > 0 && (
            <div>
              <h3 className="font-semibold text-navy text-sm mb-2">Where they differ</h3>
              <ul className="flex flex-col gap-2 text-sm text-gray-700">
                {out.couple_notes.map((c, i) => <li key={i} className="border-l-2 border-gold pl-3"><b className="text-navy">{c.topic}.</b> {c.detail} <i className="text-gray-500">Ask: {c.suggested_question}</i></li>)}
              </ul>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {[
              ['Questions for the strategy meeting', out.meeting_questions],
              ['Missing information', out.missing_information],
              ['Be careful about', out.cautions],
            ].map(([title, list]) => (list as string[]).length > 0 && (
              <div key={title as string} className={title === 'Be careful about' ? 'md:col-span-2' : ''}>
                <h3 className="font-semibold text-navy text-sm mb-2">{title as string}</h3>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-sm text-gray-700">{(list as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-gray-100">
            <button type="button" className={ghost} disabled={!!busy || !dirty} onClick={onSave}>{busy === 'save' && <Loader2 className="w-4 h-4 animate-spin" />} Save selections</button>
            <button type="button" className={primary} disabled={!!busy || !hasFolder || included.length === 0} onClick={onPdf}>
              {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Create client PDF ({included.length})
            </button>
            {pdfMade && <a href={`/api/admin/onboarding/${id}/review/pdf`} className={ghost}><Download className="w-4 h-4" /> Download last client PDF</a>}
            {!hasFolder && <span className="text-xs text-gray-500">The client needs a Nextcloud folder first (it is created when they send the agreements).</span>}
          </div>
        </div>
      )}
    </section>
  )
}
