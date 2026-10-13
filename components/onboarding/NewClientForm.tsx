'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  CORE_SECTIONS, EMPTY_FEES, ENGAGEMENT_TYPES, FEE_FIELDS, OPTIONAL_SECTIONS, PAY_METHODS,
  missingFees, missingSettings, moneyText, type EngagementType, type Fees, type MisSettings, type ModuleId,
} from '@/lib/onboarding/config'

const card = 'bg-white rounded-xl border border-gray-100 p-6'

export default function NewClientForm({ initialSettings }: { initialSettings: MisSettings }) {
  const router = useRouter()
  const [client, setClient] = useState({ client_name: '', client_email: '', spouse_name: '', spouse_email: '' })
  const [type, setType] = useState<EngagementType>('estate')
  const [focus, setFocus] = useState(ENGAGEMENT_TYPES.estate.focus)
  const [modules, setModules] = useState<ModuleId[]>(ENGAGEMENT_TYPES.estate.modules)
  const [fees, setFees] = useState<Fees>(EMPTY_FEES)
  const [pay, setPay] = useState<string[]>([])
  const [sendEmail, setSendEmail] = useState(true)
  const [settings, setSettings] = useState<MisSettings>(initialSettings)
  const [settingsSaved, setSettingsSaved] = useState<MisSettings>(initialSettings)
  const [settingsMsg, setSettingsMsg] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(() => missingSettings(initialSettings).length > 0)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const settingsMissing = missingSettings(settingsSaved)
  const settingsDirty = JSON.stringify(settings) !== JSON.stringify(settingsSaved)

  function changeType(t: EngagementType) {
    const wasDefault = !focus.trim() || Object.values(ENGAGEMENT_TYPES).some((x) => x.focus === focus)
    setType(t)
    setModules(ENGAGEMENT_TYPES[t].modules)
    if (wasDefault) setFocus(ENGAGEMENT_TYPES[t].focus)
  }

  async function saveSettings() {
    setSettingsMsg('')
    const res = await fetch('/api/admin/onboarding/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setSettingsMsg(j.error || 'Could not save.'); return }
    setSettingsSaved(j.settings)
    setSettings(j.settings)
    setSettingsMsg('Saved')
  }

  async function create() {
    const m: string[] = []
    const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
    if (!client.client_name.trim()) m.push("Enter the client's name.")
    if (!emailOk(client.client_email)) m.push('Enter a valid client email.')
    if (client.spouse_name.trim() && !emailOk(client.spouse_email)) m.push('Enter a valid email for the spouse or co-owner, or clear their name.')
    if (!focus.trim()) m.push('Enter the engagement focus.')
    const mf = missingFees(fees, pay)
    if (mf.length) m.push(`Fill in: ${mf.join(', ')}.`)
    if (settingsDirty) m.push('Save the MIS business details first.')
    else if (settingsMissing.length) m.push(`Fill in the MIS business details: ${settingsMissing.join(', ')}.`)
    setErrors(m)
    if (m.length) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...client, engagement_type: type, focus, modules, fees, pay_methods: pay, send_email: sendEmail }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErrors([j.error || 'Could not create the link.']); return }
      router.push(`/admin/onboarding/${j.id}?created=1${sendEmail ? `&emailed=${j.emailed ? 1 : 0}` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  const sections = useMemo(
    () => [...CORE_SECTIONS.slice(0, 3).map((c) => c.label), ...OPTIONAL_SECTIONS.filter((o) => modules.includes(o.id)).map((o) => o.label), 'Advisors', 'Review and submit'],
    [modules],
  )
  const fv = (v: string, suffix = '') => (v.trim() ? moneyText(v) + suffix : '—')

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link href="/admin/onboarding" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy mb-4"><ArrowLeft className="w-4 h-4" /> All clients</Link>
      <div className="mb-8">
        <h1 className="font-head text-navy text-3xl">New client</h1>
        <p className="text-gray-500 text-sm mt-1">The fees and sections you set here fill in the agreement and questionnaire the client sees.</p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="flex flex-col gap-6">
          <section className={card}>
            <h2 className="font-head text-navy text-xl">Client</h2>
            <p className="text-gray-500 text-sm mb-5">Who signs the agreements. Add a spouse or co-owner only if they will sign too.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Client full name" required value={client.client_name} onChange={(e) => setClient({ ...client, client_name: e.target.value })} />
              <Input label="Client email" type="email" required value={client.client_email} onChange={(e) => setClient({ ...client, client_email: e.target.value })} />
              <Input label="Spouse or co-owner name" hint="Optional" value={client.spouse_name} onChange={(e) => setClient({ ...client, spouse_name: e.target.value })} />
              <Input label="Spouse or co-owner email" type="email" value={client.spouse_email} onChange={(e) => setClient({ ...client, spouse_email: e.target.value })} />
            </div>
          </section>

          <section className={card}>
            <h2 className="font-head text-navy text-xl">Engagement</h2>
            <p className="text-gray-500 text-sm mb-5">Sets section 1 of the agreement and which questionnaire sections the client sees.</p>
            <div className="flex flex-col gap-4">
              <Select label="Engagement type" value={type} onChange={(e) => changeType(e.target.value as EngagementType)}>
                {Object.entries(ENGAGEMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
              <Textarea label="Engagement focus" rows={2} value={focus} onChange={(e) => setFocus(e.target.value)}
                hint='Finishes the sentence "MIS will provide real estate strategy and investment consulting focused on …"' />
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-navy">Questionnaire sections</span>
                {CORE_SECTIONS.map((c) => (
                  <div key={c.label} className="flex gap-3 items-start px-3 py-2.5 rounded-md bg-gray-50 border border-gray-100">
                    <input type="checkbox" checked disabled aria-label={`${c.label} (always included)`} className="mt-0.5 h-4 w-4 accent-[#C9A84C]" />
                    <span><b className="text-sm font-semibold text-navy block">{c.label}</b><small className="text-xs text-gray-500">Always included · {c.note}</small></span>
                  </div>
                ))}
                {OPTIONAL_SECTIONS.map((o) => (
                  <label key={o.id} htmlFor={`mod-${o.id}`} className="flex gap-3 items-start px-3 py-2.5 rounded-md border border-gray-200 cursor-pointer hover:border-gold">
                    <input id={`mod-${o.id}`} type="checkbox" checked={modules.includes(o.id)} className="mt-0.5 h-4 w-4 accent-[#C9A84C]"
                      onChange={(e) => setModules((ms) => (e.target.checked ? [...ms.filter((x) => x !== o.id), o.id] : ms.filter((x) => x !== o.id)))} />
                    <span><b className="text-sm font-semibold text-navy block">{o.label}</b><small className="text-xs text-gray-500">{o.note}</small></span>
                  </label>
                ))}
                <p className="text-xs text-gray-400">Short-term rental, group housing, and renovation questions appear on their own when the client marks a property for that use.</p>
              </div>
            </div>
          </section>

          <section className={card}>
            <h2 className="font-head text-navy text-xl">Fees</h2>
            <p className="text-gray-500 text-sm mb-5">Fills section 3 of the agreement. Every fee except the retainer is required.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {FEE_FIELDS.map((f) => (
                <div key={f.key} className="relative">
                  <Input label={f.label} required={f.required} hint={f.hint} inputMode={f.money ? 'decimal' : 'numeric'} value={fees[f.key]}
                    className={cn(f.money && 'pl-6')} onChange={(e) => setFees({ ...fees, [f.key]: e.target.value })} />
                  {f.money && <span className="absolute left-3 top-[34px] text-gray-400 text-sm pointer-events-none">$</span>}
                </div>
              ))}
              <fieldset className="sm:col-span-2 flex flex-col gap-2">
                <legend className="text-sm font-semibold text-navy mb-2">Accepted payment methods <span className="text-gold">*</span></legend>
                <div className="flex flex-wrap gap-2">
                  {PAY_METHODS.map((p) => (
                    <label key={p} className="relative inline-flex">
                      <input type="checkbox" className="peer sr-only" checked={pay.includes(p)}
                        onChange={(e) => setPay((cur) => PAY_METHODS.filter((x) => (x === p ? e.target.checked : cur.includes(x))))} />
                      <span className="px-3.5 py-1.5 text-sm rounded-full border border-gray-300 cursor-pointer peer-checked:bg-navy peer-checked:text-white peer-checked:border-navy peer-focus-visible:ring-2 peer-focus-visible:ring-gold">{p}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          <details className={card} open={settingsOpen} onToggle={(e) => setSettingsOpen((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer list-none flex justify-between items-center gap-3">
              <span><span className="font-head text-navy text-xl">MIS business details</span><span className="block text-gray-500 text-sm">Set once; used in every agreement.</span></span>
              <span className={cn('text-xs font-semibold rounded-full px-2.5 py-0.5', settingsMissing.length ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800')}>{settingsMissing.length ? 'Needs details' : 'Complete'}</span>
            </summary>
            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              <Input label="Entity type" placeholder="For example, limited liability company" value={settings.entity_type} onChange={(e) => setSettings({ ...settings, entity_type: e.target.value })} />
              <Input label="Principal office address" value={settings.office_address} onChange={(e) => setSettings({ ...settings, office_address: e.target.value })} />
              <Input label="Signer name" value={settings.signer_name} onChange={(e) => setSettings({ ...settings, signer_name: e.target.value })} />
              <Input label="Signer title" placeholder="For example, Managing Member" value={settings.signer_title} onChange={(e) => setSettings({ ...settings, signer_title: e.target.value })} />
            </div>
            <div className="flex items-center gap-3 mt-4">
              <Button type="button" variant="outline-gold" size="sm" onClick={saveSettings} disabled={!settingsDirty}>Save business details</Button>
              {settingsMsg && <span className="text-sm text-gray-500">{settingsMsg}</span>}
            </div>
          </details>
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
          <section className={card}>
            <h2 className="font-head text-navy text-xl">Create the link</h2>
            <p className="text-gray-500 text-sm mb-4">The client gets a private link to sign, answer the questionnaire, and upload documents.</p>
            {errors.length > 0 && (
              <div role="alert" className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm mb-4">
                {errors.length === 1 ? errors[0] : <ul className="list-disc pl-4">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
              </div>
            )}
            <label className="flex gap-2.5 items-start text-sm text-gray-700 mb-4 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C9A84C]" />
              <span>Email the link to the client now</span>
            </label>
            <Button type="button" className="w-full" onClick={create} loading={busy}>Create client link</Button>
            <p className="text-xs text-gray-400 mt-3">Fees are locked into the agreement once the client sends it for signature.</p>
          </section>
          <section className={card}>
            <h2 className="font-head text-navy text-lg">What the client gets</h2>
            <p className="text-gray-500 text-sm mb-3">{ENGAGEMENT_TYPES[type].label}</p>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Questionnaire sections</h3>
            <ol className="list-decimal pl-5 text-sm text-gray-600 mt-2 flex flex-col gap-0.5">{sections.map((s) => <li key={s}>{s}</li>)}</ol>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-5">Fees in the agreement</h3>
            <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1.5 text-sm mt-2">
              <dt className="text-gray-500">Phase 1 flat fee</dt><dd className="text-right font-semibold tabular-nums">{fv(fees.phase1)}</dd>
              <dt className="text-gray-500">Phase 2 hourly</dt><dd className="text-right font-semibold tabular-nums">{fv(fees.hourly, '/hr')}</dd>
              <dt className="text-gray-500">Retainer</dt><dd className="text-right font-semibold tabular-nums">{fees.retainer.trim() ? fv(fees.retainer) : 'None'}</dd>
              <dt className="text-gray-500">Phase 2 cap</dt><dd className="text-right font-semibold tabular-nums">{fv(fees.cap)}</dd>
              <dt className="text-gray-500">Cancellation</dt><dd className="text-right font-semibold tabular-nums">{fv(fees.cancel)}</dd>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}
