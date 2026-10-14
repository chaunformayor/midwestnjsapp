'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ENGAGEMENT_TYPES, MIS_CONTACT, PAY_OPTIONS, firstName, householdName } from '@/lib/onboarding/config'
import { engagementAgreement, ndaAgreement } from '@/lib/onboarding/agreements'
import { answeredCount, buildParts, docItems, docsDone, validatePart, type Answers, type DocState, type Val } from '@/lib/onboarding/questionnaire'
import type { ClientView } from '@/lib/onboarding/service'
import AgreementView from './AgreementView'
import { Pills, SectionView, eyebrowCls, fid, inputCls, labelCls } from './Fields'

const CHUNK_BYTES = 4 * 1024 * 1024
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
const STEPS = ['Welcome', 'Agreements', 'Questionnaire', 'Documents', 'Finish']

const btn = 'inline-flex items-center justify-center gap-2 font-semibold text-sm rounded px-5 py-3 transition disabled:opacity-50 disabled:cursor-not-allowed'
const btnPrimary = cn(btn, 'bg-gold text-navy hover:bg-gold-light')
const btnGhost = cn(btn, 'border border-gray-300 text-navy bg-white hover:border-gold hover:bg-gold/10')
const card = 'bg-white border border-gray-200 rounded-xl p-5 sm:p-7'
const kicker = 'text-[11px] font-bold uppercase tracking-[0.14em] text-gold-dark'

function initialStep(v: ClientView) {
  if (v.status === 'submitted') return 3
  if (v.status === 'signed') return 2
  if (v.status === 'signing') return 1
  return 0
}

function Chip({ tone = 'gray', children }: { tone?: 'gray' | 'ok' | 'wait'; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap',
      tone === 'ok' && 'bg-green-100 text-green-800', tone === 'wait' && 'bg-amber-100 text-amber-800', tone === 'gray' && 'bg-gray-100 text-gray-600')}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  )
}

function Errors({ list }: { list: string[] }) {
  if (!list.length) return null
  return (
    <div role="alert" className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">
      {list.length === 1 ? list[0] : (<>Please fix these:<ul className="list-disc pl-5 mt-1">{list.map((m) => <li key={m}>{m}</li>)}</ul></>)}
    </div>
  )
}

export default function ClientApp({ token, initial }: { token: string; initial: ClientView }) {
  const [view, setView] = useState(initial)
  const [step, setStep] = useState(() => initialStep(initial))
  const [answers, setAnswers] = useState<Answers>(initial.answers)
  const [docs, setDocs] = useState<DocState>(initial.docs)
  const [partId, setPartId] = useState(initial.part && initial.part !== 'final' ? initial.part : 'about')
  const [visited, setVisited] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [docTab, setDocTab] = useState<'eng' | 'nda'>('eng')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [confirmRemove, setConfirmRemove] = useState('')
  const [uploading, setUploading] = useState<Record<string, string>>({})
  const [docErrors, setDocErrors] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')
  const [notice, setNotice] = useState('')
  const [sign, setSign] = useState({
    name1: initial.client_name, email1: initial.client_email,
    name2: initial.spouse_name ?? '', email2: initial.spouse_email ?? '',
    address: '', payOption: '', read: false,
  })
  const topRef = useRef<HTMLDivElement>(null)
  const api = `/api/onboarding/${encodeURIComponent(token)}`

  const signed = view.status === 'signed' || view.status === 'submitted'
  const submitted = view.status === 'submitted'
  const parts = useMemo(() => buildParts(view.modules, answers), [view.modules, answers])
  const partIndex = Math.max(0, parts.findIndex((p) => p.id === partId))
  const part = parts[partIndex]
  const items = useMemo(() => docItems(view.modules, answers), [view.modules, answers])
  const handled = docsDone(items, docs)

  // Mark parts before the saved one as visited when the page first loads.
  useEffect(() => {
    if (initial.part) {
      const ps = buildParts(initial.modules, initial.answers)
      const i = initial.part === 'final' ? ps.length : ps.findIndex((p) => p.id === initial.part)
      setVisited(ps.slice(0, Math.max(0, i)).map((p) => p.id))
    }
  }, [initial])

  const showToast = useCallback((m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(''), 2400)
  }, [])

  const toTop = () => {
    const el = topRef.current
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' })
  }

  // ------------------------------------------------------------ saving answers
  const latest = useRef({ answers, partId })
  latest.current = { answers, partId }

  const save = useCallback(async () => {
    setSaveState('saving')
    try {
      const res = await fetch(`${api}/answers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: latest.current.answers, part: latest.current.partId }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed')
      setSaveState('saved')
      setSavedAt(new Date())
      setDirty(false)
      return true
    } catch {
      setSaveState('error')
      return false
    }
  }, [api])

  useEffect(() => {
    if (!dirty || !signed || submitted) return
    const t = window.setTimeout(() => { void save() }, 2500)
    return () => window.clearTimeout(t)
  }, [dirty, answers, signed, submitted, save])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const setVal = useCallback((key: string, value: Val) => {
    setAnswers((a) => ({ ...a, v: { ...a.v, [key]: value } }))
    setDirty(true)
    setConfirmRemove('')
  }, [])

  // ------------------------------------------------------------ signing status
  useEffect(() => {
    if (view.status !== 'signing') return
    const t = window.setInterval(async () => {
      if (document.hidden) return
      try {
        const res = await fetch(api, { cache: 'no-store' })
        if (!res.ok) return
        const v = (await res.json()) as ClientView
        setView(v)
        if (v.status === 'signed') showToast('Agreements signed')
      } catch { /* try again next time */ }
    }, 8000)
    return () => window.clearInterval(t)
  }, [view.status, api, showToast])

  // ------------------------------------------------------------ navigation
  async function goStep(n: number) {
    if (n >= 2 && !signed) return
    if (n === 4 && !submitted) return
    if (dirty && signed && !submitted) await save()
    setErrors([])
    setStep(n)
    toTop()
  }

  async function nextPart() {
    const m = validatePart(part.id, answers)
    if (m.length) { setErrors(m); return }
    setErrors([])
    setVisited((v) => (v.includes(part.id) ? v : [...v, part.id]))
    const next = parts[Math.min(partIndex + 1, parts.length - 1)]
    latest.current = { answers, partId: next.id }
    setPartId(next.id)
    if (!submitted) await save()
    toTop()
  }

  function prevPart() {
    setErrors([])
    if (partIndex > 0) setPartId(parts[partIndex - 1].id)
    else void goStep(1)
    toTop()
  }

  // ------------------------------------------------------------ actions
  async function sendForSignature() {
    const m: string[] = []
    const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
    if (!sign.name1.trim()) m.push('Enter your full legal name.')
    if (!emailOk(sign.email1)) m.push('Enter a valid email.')
    if (view.spouse_name) {
      if (!sign.name2.trim()) m.push("Enter the spouse or co-owner's legal name.")
      if (!emailOk(sign.email2)) m.push('Enter a valid email for the spouse or co-owner.')
    }
    if (!sign.address.trim()) m.push('Enter your home address.')
    if (!sign.payOption) m.push('Choose a Phase 1 payment option.')
    if (!sign.read) m.push('Confirm you have read both agreements.')
    if (m.length) { setErrors(m); return }
    setErrors([])
    setBusy(true)
    try {
      const res = await fetch(`${api}/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sign) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErrors([j.error || 'Something went wrong. Please try again.']); return }
      setView(j as ClientView)
      setAnswers((a) => {
        const v = { ...a.v }
        if (v['p1.name'] == null) v['p1.name'] = sign.name1
        if (v['p1.email'] == null) v['p1.email'] = sign.email1
        if (v['hh.address'] == null) v['hh.address'] = sign.address
        if (view.spouse_name) {
          if (v['hh.spouse'] == null) v['hh.spouse'] = 'Yes'
          if (v['p2.name'] == null) v['p2.name'] = sign.name2
          if (v['p2.email'] == null) v['p2.email'] = sign.email2
        } else if (v['hh.spouse'] == null) v['hh.spouse'] = 'No'
        return { ...a, v }
      })
      toTop()
    } catch {
      setErrors(["We couldn't reach the server. Check your connection and try again."])
    } finally {
      setBusy(false)
    }
  }

  async function checkNow() {
    setBusy(true)
    try {
      const res = await fetch(api, { cache: 'no-store' })
      if (res.ok) {
        const v = (await res.json()) as ClientView
        setView(v)
        showToast(v.status === 'signed' ? 'Agreements signed' : 'Still waiting on a signature')
      }
    } finally {
      setBusy(false)
    }
  }

  async function resendSigningEmail() {
    setBusy(true); setErrors([]); setNotice('')
    try {
      const res = await fetch(`${api}/remind`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (res.status === 429 && j.error) { setNotice(j.error); return }
      if (!res.ok) { setErrors([j.error || 'Something went wrong. Please try again.']); return }
      const r = j as { sentTo: string[]; view: ClientView }
      setView(r.view)
      setNotice(r.sentTo.length
        ? `Sent again to ${r.sentTo.join(' and ')}. It comes from our Nextcloud system and can take a few minutes. Check spam too.`
        : 'Everyone has signed.')
    } catch {
      setErrors(["We couldn't reach the server. Check your connection and try again."])
    } finally {
      setBusy(false)
    }
  }

  async function submitQuestionnaire() {
    const all = parts.flatMap((p) => validatePart(p.id, answers))
    if (all.length) { setErrors(all); return }
    setErrors([])
    setBusy(true)
    try {
      const res = await fetch(`${api}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErrors([j.error || 'Something went wrong. Please try again.']); return }
      setView(j as ClientView)
      setDirty(false)
      setVisited(parts.map((p) => p.id))
      setStep(3)
      showToast('Questionnaire submitted')
      toTop()
    } catch {
      setErrors(["We couldn't reach the server. Your answers are still on this page; try again in a minute."])
    } finally {
      setBusy(false)
    }
  }

  function addProperty() {
    const nums = answers.props.map((p) => Number(p.slice(1))).filter((n) => !Number.isNaN(n))
    const pid = `p${(nums.length ? Math.max(...nums) : 0) + 1}`
    setAnswers((a) => ({ ...a, props: [...a.props, pid] }))
    setOpen({ [pid]: true })
    setDirty(true)
    window.setTimeout(() => {
      const el = document.getElementById(fid(`prop.${pid}.address`)) as HTMLInputElement | null
      el?.focus()
      el?.scrollIntoView({ block: 'center' })
    }, 50)
  }

  function removeProperty(pid: string) {
    setAnswers((a) => {
      const v = Object.fromEntries(Object.entries(a.v).filter(([k]) => !k.includes(`.${pid}.`)))
      return { v, props: a.props.filter((p) => p !== pid) }
    })
    setConfirmRemove('')
    setDirty(true)
    showToast('Property removed')
  }

  async function setNA(doc: string, na: boolean) {
    setDocErrors((d) => ({ ...d, [doc]: '' }))
    if (dirty) await save()
    const res = await fetch(`${api}/docs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc, na }) })
    const j = await res.json().catch(() => ({}))
    if (res.ok) setDocs(j.docs)
    else setDocErrors((d) => ({ ...d, [doc]: j.error || 'That did not save. Try again.' }))
  }

  async function uploadFiles(doc: string, list: FileList | null) {
    if (!list?.length) return
    if (dirty) await save()
    setDocErrors((d) => ({ ...d, [doc]: '' }))
    for (const file of Array.from(list)) {
      if (file.size === 0) { setDocErrors((d) => ({ ...d, [doc]: `${file.name} is empty.` })); continue }
      if (file.size > MAX_UPLOAD_BYTES) { setDocErrors((d) => ({ ...d, [doc]: `${file.name} is larger than 50 MB. Email it to us or call us instead.` })); continue }
      const total = Math.max(1, Math.ceil(file.size / CHUNK_BYTES))
      const upload = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
      try {
        for (let i = 1; i <= total; i++) {
          setUploading((u) => ({ ...u, [doc]: total > 1 ? `Uploading ${file.name}… ${Math.round(((i - 1) / total) * 100)}%` : `Uploading ${file.name}…` }))
          const qs = new URLSearchParams({ doc, name: file.name, upload, index: String(i), total: String(total), size: String(file.size) })
          const res = await fetch(`${api}/upload?${qs}`, {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream' },
            body: file.slice((i - 1) * CHUNK_BYTES, i * CHUNK_BYTES),
          })
          const j = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(j.error || 'Upload failed.')
          if (j.done && j.docs) setDocs(j.docs)
        }
      } catch (err) {
        setDocErrors((d) => ({ ...d, [doc]: `${file.name}: ${(err as Error).message}` }))
      }
    }
    setUploading((u) => ({ ...u, [doc]: '' }))
  }

  // ------------------------------------------------------------ pieces
  const savedText = saveState === 'saving' ? 'Saving…'
    : saveState === 'error' ? 'Not saved. Check your connection.'
    : savedAt ? `Saved · ${format(savedAt, 'h:mm a')}`
    : submitted ? 'Submitted' : signed ? 'Your answers save as you go' : ''

  function stepInfo(i: number) {
    if (i === 0) return { lock: false, done: step > 0, note: 'Start here' }
    if (i === 1) return { lock: false, done: signed, note: signed ? `Signed ${view.signed_at ? format(new Date(view.signed_at), 'MMM d') : ''}` : view.status === 'signing' ? 'Awaiting signature' : 'Review and sign' }
    if (i === 2) return { lock: !signed, done: submitted, note: !signed ? 'Unlocks after signing' : submitted ? 'Submitted' : `Part ${partIndex + 1} of ${parts.length}` }
    if (i === 3) return { lock: !signed, done: signed && items.length > 0 && handled === items.length, note: !signed ? 'Unlocks after signing' : `${handled} of ${items.length} items` }
    return { lock: !submitted, done: false, note: submitted ? 'Wrap up' : 'After you submit' }
  }

  const rail = (
    <nav aria-label="Onboarding steps" className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:sticky md:top-4">
      {STEPS.map((t, i) => {
        const s = stepInfo(i)
        const cur = step === i
        return (
          <div key={t} className="shrink-0">
            <button type="button" disabled={s.lock} aria-current={cur ? 'step' : undefined} onClick={() => goStep(i)}
              className={cn('w-full grid grid-cols-[28px_auto] md:grid-cols-[28px_minmax(0,1fr)] gap-x-3 items-center text-left rounded-md px-2.5 py-2 md:py-2.5 transition whitespace-nowrap md:whitespace-normal',
                cur ? 'bg-white ring-1 ring-gray-200' : 'hover:bg-gray-100', s.lock && 'opacity-50 cursor-not-allowed hover:bg-transparent')}>
              <span className={cn('row-span-2 w-7 h-7 rounded-full grid place-items-center text-[13px] font-bold border-[1.5px] tabular-nums',
                cur ? 'bg-gold border-gold text-navy' : s.done ? 'bg-navy border-navy text-white' : 'border-gray-300 text-gray-500')}>
                {s.done && !cur ? '✓' : i + 1}
              </span>
              <span className="text-sm font-semibold text-navy">{t}</span>
              <span className="hidden md:block text-xs text-gray-500">{s.note}</span>
            </button>
            {i === 2 && cur && (
              <ul className="hidden md:flex flex-col ml-6 pl-4 my-1 border-l-[1.5px] border-gray-200">
                {parts.map((p, j) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => { setErrors([]); setPartId(p.id); toTop() }} aria-current={j === partIndex ? 'true' : undefined}
                      className={cn('w-full text-left text-[13px] px-2 py-1.5 rounded flex gap-2 items-baseline hover:bg-gray-100', j === partIndex ? 'text-navy font-semibold' : 'text-gray-600')}>
                      <span className="w-3 shrink-0 text-green-700 text-[11px]">{visited.includes(p.id) || submitted ? '✓' : ''}</span>
                      <span>{p.short}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )

  // ------------------------------------------------------------ steps
  function Welcome() {
    return (
      <section className={card}>
        <p className={kicker}>Step 1 of 5</p>
        <h2 className="font-head text-navy text-2xl mt-1.5">How this works</h2>
        <p className="text-gray-600 mt-3 max-w-[66ch]">Thank you for choosing Midwest Investor Services. This onboarding gives us what we need to recommend a plan that fits your goals and properties. It takes about 30–45 minutes, and it saves as you go so you can stop and come back with the same link.</p>
        <div className="grid sm:grid-cols-2 gap-6 mt-6">
          <div>
            <h4 className={eyebrowCls}>What we will do</h4>
            <ul className="list-disc pl-5 mt-2 text-sm text-gray-700 flex flex-col gap-1.5">
              <li>Review each of your properties: title, debt, insurance, condition, and planned use.</li>
              <li>Clarify your goals for protection, income, taxes, and the future.</li>
              <li>Recommend a practical plan and give you a written summary for your attorney and CPA.</li>
              <li>Coordinate with your advisors if you want help carrying it out.</li>
            </ul>
          </div>
          <div>
            <h4 className={eyebrowCls}>What we do not do</h4>
            <ul className="list-disc pl-5 mt-2 text-sm text-gray-700 flex flex-col gap-1.5">
              <li>We are not a law firm, accounting firm, or registered investment adviser.</li>
              <li>We don&apos;t draft legal documents or give legal or tax opinions.</li>
              <li>We don&apos;t advise on stocks, bonds, or other securities.</li>
              <li>Our conversations are not covered by attorney-client privilege.</li>
            </ul>
          </div>
        </div>
        <div className="rounded-md bg-[#F3F1EB] px-4 py-3 text-sm text-gray-700 mt-6">MIS is affiliated with Missouri Construction Service and Luxe Property Solutions. If we ever suggest either one, we will tell you about the relationship in writing first. You are never required to use them.</div>
        <h4 className={cn(eyebrowCls, 'mt-6')}>Questions?</h4>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mt-2">
          <span className="font-semibold select-all">{MIS_CONTACT.phone}</span>
          <span className="font-semibold select-all">{MIS_CONTACT.email}</span>
          <span className="text-gray-500">{MIS_CONTACT.hours}</span>
        </div>
        <div className="flex justify-end mt-8 pt-5 border-t border-gray-200">
          <button type="button" className={btnPrimary} onClick={() => goStep(1)}>Start with the agreements</button>
        </div>
      </section>
    )
  }

  function Agreements() {
    const d = view.sign_details
    const ctx = {
      date: d?.date ?? format(new Date(), 'MMMM d, yyyy'),
      mis: view.mis,
      signers: [{ name: d?.name1 ?? sign.name1 }, ...(view.spouse_name ? [{ name: d?.name2 ?? sign.name2 }] : [])],
      clientAddress: d?.address ?? sign.address,
      payOption: d?.payOption ?? sign.payOption,
      focus: view.focus,
      fees: view.fees,
      payMethods: view.pay_methods,
    }
    const blocks = docTab === 'eng' ? engagementAgreement(ctx) : ndaAgreement(ctx)
    const field = (key: keyof typeof sign, label: string, type = 'text') => (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`sig-${key}`} className={labelCls}>{label} <em className="text-gold-dark not-italic">*</em></label>
        <input id={`sig-${key}`} type={type} value={String(sign[key])} autoComplete="off" onChange={(e) => setSign((s) => ({ ...s, [key]: e.target.value }))} className={inputCls} />
      </div>
    )
    const clientSigners = view.signers
    return (
      <div>
        <p className={kicker}>Step 2 of 5</p>
        <h2 className="font-head text-navy text-2xl mt-1.5 mb-4">Review and sign the agreements</h2>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div className="min-w-0">
            <div role="tablist" className="flex gap-1 border-b border-gray-200 overflow-x-auto">
              {([['eng', 'Engagement Agreement'], ['nda', 'Confidentiality (NDA)']] as const).map(([k, l]) => (
                <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={docTab === k} aria-controls="doc-pane" onClick={() => setDocTab(k)}
                  className={cn('px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px', docTab === k ? 'text-navy border-gold' : 'text-gray-500 border-transparent')}>
                  {l}
                </button>
              ))}
            </div>
            <div id="doc-pane" role="tabpanel" aria-labelledby={`tab-${docTab}`} tabIndex={0}
              className="max-h-[62vh] overflow-auto border border-t-0 border-gray-200 rounded-b-md bg-[#F7F5EF] px-5 sm:px-7 py-6">
              <AgreementView blocks={blocks} />
            </div>
          </div>

          {view.status === 'invited' && (
            <section className={cn(card, 'flex flex-col gap-4')}>
              <div>
                <h3 className="font-head text-navy text-xl">Before you sign</h3>
                <p className="text-[13px] text-gray-500 mt-1">These details go into both agreements. We&apos;ll send the signing link to the emails below.</p>
              </div>
              <Errors list={errors} />
              {field('name1', 'Your full legal name')}
              {field('email1', 'Your email', 'email')}
              {view.spouse_name && field('name2', 'Spouse or co-owner legal name')}
              {view.spouse_name && field('email2', 'Spouse or co-owner email', 'email')}
              {field('address', 'Home address')}
              <fieldset className="flex flex-col gap-1.5 border-0 p-0 m-0">
                <legend id="sig-pay-lbl" className={cn(labelCls, 'mb-1.5')}>Phase 1 payment option</legend>
                <Pills name="sig-pay" options={[...PAY_OPTIONS]} value={sign.payOption} labelledBy="sig-pay-lbl" onChange={(o, c) => c && setSign((s) => ({ ...s, payOption: o }))} />
              </fieldset>
              <label htmlFor="sig-read" className="flex gap-3 items-start text-sm text-gray-800 cursor-pointer">
                <input id="sig-read" type="checkbox" checked={sign.read} onChange={(e) => setSign((s) => ({ ...s, read: e.target.checked }))} className="mt-0.5 h-[18px] w-[18px] accent-[#C9A84C]" />
                <span>I have read both agreements.</span>
              </label>
              <button type="button" className={btnPrimary} onClick={sendForSignature} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} {busy ? 'Preparing your agreements…' : 'Send me the signing link'}
              </button>
              <p className="text-xs text-gray-500">You&apos;ll sign both agreements in LibreSign, our secure signing system. It takes about two minutes.</p>
            </section>
          )}

          {view.status === 'signing' && (
            <section className={cn(card, 'flex flex-col gap-4')}>
              <div>
                <h3 className="font-head text-navy text-xl">Sign in LibreSign</h3>
                <p className="text-[13px] text-gray-500 mt-1">
                  LibreSign, our secure signing system, emailed a signing link to each person below. Open that email, click the link, and enter the short code LibreSign sends to confirm it&apos;s you. This page updates on its own once everyone signs.
                </p>
              </div>
              <Errors list={errors} />
              <div className="flex flex-col gap-2.5">
                {clientSigners.map((s) => (
                  <div key={s.name + s.email} className="flex items-center justify-between gap-3 border border-gray-200 rounded-md px-3 py-2.5">
                    <span className="min-w-0">
                      <b className="font-semibold text-sm text-navy block truncate">{s.name}</b>
                      {s.email && <small className="text-xs text-gray-500 block break-all">{s.signed_at ? s.email : `Link sent to ${s.email}`}</small>}
                    </span>
                    {s.signed_at ? <Chip tone="ok">Signed</Chip> : s.signUrl
                      ? <a href={s.signUrl} target="_blank" rel="noopener noreferrer" className={cn(btn, 'px-3.5 py-2 bg-gold text-navy hover:bg-gold-light')}>Sign now</a>
                      : <Chip tone="wait">Check email</Chip>}
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border border-gray-200 rounded-md px-3 py-2.5">
                  <span><b className="font-semibold text-sm text-navy block">{view.mis.signer_name || 'Midwest Investor Services'}</b><small className="text-xs text-gray-500">Midwest Investor Services · signs after you</small></span>
                  <Chip>Next</Chip>
                </div>
              </div>
              {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
              <button type="button" className={btnGhost} onClick={checkNow} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} I&apos;ve signed — check now</button>
              {clientSigners.some((s) => !s.signed_at) && (
                <div className="text-xs text-gray-500 flex flex-col gap-1.5">
                  <p>No email? Check your spam or junk folder for a message from Nextcloud or LibreSign.</p>
                  <button type="button" onClick={resendSigningEmail} disabled={busy} className="self-start font-semibold text-navy underline underline-offset-2 hover:text-gold disabled:opacity-50">Send the signing email again</button>
                  <p>Wrong email address above? Call us at {MIS_CONTACT.phone} and we&apos;ll fix it.</p>
                </div>
              )}
            </section>
          )}

          {signed && (
            <section className={cn(card, 'flex flex-col gap-4')}>
              <div>
                <h3 className="font-head text-navy text-xl">Agreements signed</h3>
                <p className="text-[13px] text-gray-500 mt-1">{view.signed_at ? `Signed ${format(new Date(view.signed_at), 'MMMM d, yyyy')}. ` : ''}Keep a copy of the signed PDF for your records.</p>
              </div>
              <a href={`${api}/signed`} className={btnGhost}>Download signed agreements (PDF)</a>
              <button type="button" className={btnPrimary} onClick={() => goStep(2)}>{submitted ? 'View the questionnaire' : 'Continue to the questionnaire'}</button>
            </section>
          )}
        </div>
      </div>
    )
  }

  function Questionnaire() {
    const pct = parts.length > 1 ? Math.round((partIndex / (parts.length - 1)) * 100) : 100
    return (
      <section className={card}>
        <div className="flex flex-col gap-2.5 mb-5">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <span className={kicker}>Questionnaire · Part {partIndex + 1} of {parts.length}</span>
            <select aria-label="Go to part" value={part.id} onChange={(e) => { setErrors([]); setPartId(e.target.value) }} className={cn(inputCls, 'md:hidden w-auto max-w-full py-1.5')}>
              {parts.map((p, j) => <option key={p.id} value={p.id}>{j + 1}. {p.short}</option>)}
            </select>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Questionnaire progress">
            <i className="block h-full bg-gold rounded-full transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <h2 className="font-head text-navy text-2xl">{part.title}</h2>
        {submitted && <p className="text-sm text-gray-500 mt-2">You submitted this questionnaire. To change an answer, call or email us.</p>}
        {part.id === 'final' && !submitted && (
          <p className="text-gray-600 mt-3">You answered {answeredCount(answers)} questions across {parts.length - 1} parts. You can go back to any part before you submit.</p>
        )}
        <div className="mt-4"><Errors list={errors} /></div>
        <fieldset disabled={submitted} className="flex flex-col gap-7 mt-5 border-0 p-0 m-0 min-w-0">
          {part.sections.map((s, i) => (
            <SectionView key={`${part.id}-${i}`} s={s} a={answers} set={setVal} disabled={submitted}
              props={{ open, setOpen: (pid, o) => setOpen((x) => ({ ...x, [pid]: o })), onAdd: addProperty, onRemove: removeProperty, confirmRemove, setConfirmRemove }} />
          ))}
        </fieldset>
        <div className="flex justify-between gap-3 flex-wrap mt-8 pt-5 border-t border-gray-200">
          <button type="button" className={btnGhost} onClick={prevPart}>Back</button>
          {part.id === 'final'
            ? (submitted
              ? <button type="button" className={btnPrimary} onClick={() => goStep(3)}>Go to documents</button>
              : <button type="button" className={btnPrimary} onClick={submitQuestionnaire} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Submit questionnaire</button>)
            : <button type="button" className={btnPrimary} onClick={nextPart}>{submitted ? 'Next' : 'Save and continue'}</button>}
        </div>
      </section>
    )
  }

  function Documents() {
    const groups: { g: string; list: typeof items }[] = []
    for (const it of items) {
      let g = groups.find((x) => x.g === it.group)
      if (!g) { g = { g: it.group, list: [] }; groups.push(g) }
      g.list.push(it)
    }
    const pct = items.length ? Math.round((handled / items.length) * 100) : 100
    return (
      <section className={card}>
        <p className={kicker}>Step 4 of 5</p>
        <h2 className="font-head text-navy text-2xl mt-1.5">Upload your documents</h2>
        <p className="text-gray-600 mt-3 max-w-[66ch]">Upload what you have now; you can add the rest later from this same link. Phone photos are fine. Black out Social Security numbers and full account numbers first.</p>
        <div className="flex flex-col gap-2 mt-5">
          <span className="text-sm text-gray-500">{handled} of {items.length} items uploaded or marked not applicable</span>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><i className="block h-full bg-gold rounded-full" style={{ width: `${pct}%` }} /></div>
        </div>
        {groups.map((g) => (
          <div key={g.g} className="mt-6">
            <h4 className={eyebrowCls}>{g.g}</h4>
            <div className="divide-y divide-gray-200">
              {g.list.map((x) => {
                const d = docs[x.id] ?? { files: [], na: false }
                const up = uploading[x.id]
                return (
                  <div key={x.id} className="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 items-center py-3">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-900">{x.title}</div>
                      {d.files.length > 0 && <div className="text-[12.5px] text-green-800 mt-0.5 break-words">{d.files.join(', ')}</div>}
                      {up && <div className="text-[12.5px] text-gray-500 mt-0.5 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{up}</div>}
                      {docErrors[x.id] && <div className="text-[12.5px] text-red-700 mt-0.5">{docErrors[x.id]}</div>}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap sm:justify-end">
                      {d.na ? <Chip>Not applicable</Chip> : d.files.length > 0 ? <Chip tone="ok">{d.files.length} file{d.files.length > 1 ? 's' : ''}</Chip> : null}
                      {d.na ? (
                        <button type="button" className="text-[13px] font-semibold text-gold-dark underline underline-offset-2" onClick={() => setNA(x.id, false)}>Undo</button>
                      ) : (
                        <>
                          <label className={cn(btnGhost, 'relative px-3.5 py-2 focus-within:ring-2 focus-within:ring-gold', up && 'opacity-50 pointer-events-none')}>
                            {d.files.length ? 'Add more' : 'Upload'}
                            <input type="file" multiple aria-label={`Upload: ${x.title}`} className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => { const f = e.target.files; void uploadFiles(x.id, f).then(() => { e.target.value = '' }) }} />
                          </label>
                          {d.files.length === 0 && <button type="button" className="text-[13px] font-semibold text-gold-dark underline underline-offset-2" onClick={() => setNA(x.id, true)}>Not applicable</button>}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div className="flex justify-between gap-3 flex-wrap mt-8 pt-5 border-t border-gray-200">
          <button type="button" className={btnGhost} onClick={() => goStep(2)}>Back to questionnaire</button>
          <button type="button" className={btnPrimary} onClick={() => goStep(4)} disabled={!submitted}>{submitted ? 'Finish' : 'Submit the questionnaire first'}</button>
        </div>
      </section>
    )
  }

  function Finish() {
    const f = view.fees
    return (
      <section className={card}>
        <p className={kicker}>Step 5 of 5</p>
        <h2 className="font-head text-navy text-2xl mt-1.5">You&apos;re all set, {firstName(view.sign_details?.name1 ?? view.client_name) || 'thank you'}</h2>
        <p className="text-gray-600 mt-3 max-w-[66ch]">
          We have your signed agreements and questionnaire{handled < items.length ? `, plus ${handled} of ${items.length} documents. You can upload the rest anytime from this same link.` : ' and documents.'}
        </p>
        <h4 className={cn(eyebrowCls, 'mt-6')}>What happens next</h4>
        <ol className="mt-3 flex flex-col gap-3.5">
          {[
            ['We review everything', 'within two business days and reach out if anything is missing.'],
            ['Strategy meeting.', `We walk through what we found and a recommended plan${f.meetingHours ? ` (up to ${f.meetingHours} hours)` : ''}.`],
            ['Written report', `with a step-by-step action plan${f.deliveryDays ? `, within ${f.deliveryDays} business days` : ''}, ready for your attorney and CPA.`],
          ].map(([b, t], i) => (
            <li key={b} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 items-start">
              <span className="w-7 h-7 rounded-full bg-gold/15 text-gold-dark grid place-items-center text-[13px] font-bold">{i + 1}</span>
              <span className="text-sm text-gray-700 pt-1"><b className="text-navy">{b}</b> {t}</span>
            </li>
          ))}
        </ol>
        <h4 className={cn(eyebrowCls, 'mt-6')}>Questions?</h4>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mt-2">
          <span className="font-semibold select-all">{MIS_CONTACT.phone}</span>
          <span className="font-semibold select-all">{MIS_CONTACT.email}</span>
        </div>
        <div className="flex flex-wrap gap-3 mt-8 pt-5 border-t border-gray-200">
          <button type="button" className={btnGhost} onClick={() => goStep(3)}>Back to documents</button>
          <a href={`${api}/signed`} className={btnGhost}>Download signed agreements (PDF)</a>
        </div>
      </section>
    )
  }

  return (
    <div ref={topRef} className="scroll-mt-4">
      <div className="flex justify-between items-end gap-3 flex-wrap mb-5">
        <div>
          <p className={kicker}>{ENGAGEMENT_TYPES[view.engagement_type]?.label}</p>
          <h1 className="font-head text-navy text-[28px] sm:text-[34px] leading-tight mt-1">Welcome, {householdName(view.client_name, view.spouse_name)}</h1>
        </div>
        {savedText && (
          <span className={cn('text-[12.5px] flex items-center gap-2', saveState === 'error' ? 'text-red-700' : 'text-gray-500')}>
            <span className={cn('w-[7px] h-[7px] rounded-full', saveState === 'error' ? 'bg-red-600' : 'bg-green-700')} />
            {savedText}
          </span>
        )}
      </div>
      {view.storageError && (
        <div role="alert" className="rounded-md bg-amber-50 text-amber-900 px-4 py-3 text-sm mb-5">We couldn&apos;t load your saved answers just now. Please refresh in a minute before making changes.</div>
      )}
      <div className="grid md:grid-cols-[230px_minmax(0,1fr)] gap-4 md:gap-7 items-start">
        {rail}
        <div className="min-w-0">
          {step === 0 && Welcome()}
          {step === 1 && Agreements()}
          {step === 2 && Questionnaire()}
          {step === 3 && Documents()}
          {step === 4 && Finish()}
        </div>
      </div>
      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-5 bg-navy text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg z-50">{toast}</div>
      )}
    </div>
  )
}
