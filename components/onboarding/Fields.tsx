'use client'
import { cn } from '@/lib/utils'
import type { Answers, Field, Group, Section, Val } from '@/lib/onboarding/questionnaire'

export const fid = (key: string) => 'f-' + key.replace(/[^a-zA-Z0-9]+/g, '-')

export const inputCls =
  'w-full min-w-0 border border-gray-300 rounded px-3 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/25 disabled:bg-gray-50 disabled:text-gray-600'
export const labelCls = 'text-sm font-semibold text-navy'
export const eyebrowCls = 'font-body text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500'

type SetVal = (key: string, value: Val) => void

function Label({ htmlFor, children, req }: { htmlFor?: string; children: React.ReactNode; req?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={labelCls}>
      {children}
      {req && <em className="text-gold-dark not-italic ml-0.5">*</em>}
    </label>
  )
}

export function Pills({ name, options, value, onChange, disabled, small, labelledBy, multiple }: {
  name: string; options: string[]; value: string | string[] | undefined; onChange: (v: string, checked: boolean) => void
  disabled?: boolean; small?: boolean; labelledBy?: string; multiple?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2" role={multiple ? 'group' : 'radiogroup'} aria-labelledby={labelledBy}>
      {options.map((o, i) => {
        const checked = multiple ? Array.isArray(value) && value.includes(o) : value === o
        return (
          <label key={o} className="relative inline-flex">
            <input
              type={multiple ? 'checkbox' : 'radio'}
              id={`${name}-${i}`}
              name={name}
              value={o}
              checked={checked}
              disabled={disabled}
              onChange={(e) => onChange(o, e.target.checked)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'inline-block rounded-full border border-gray-300 bg-white text-gray-800 transition cursor-pointer select-none',
                small ? 'px-3 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm',
                'peer-checked:bg-navy peer-checked:border-navy peer-checked:text-white',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-1',
                'peer-disabled:cursor-default peer-disabled:opacity-75',
              )}
            >
              {o}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export function FieldInput({ f, a, set, disabled }: { f: Field; a: Answers; set: SetVal; disabled?: boolean }) {
  const id = fid(f.key)
  const raw = a.v[f.key]
  const sv = typeof raw === 'string' ? raw : ''
  const wrap = (inner: React.ReactNode, withLabel = true) => (
    <div className={cn('flex flex-col gap-1.5 min-w-0', f.full && 'sm:col-span-2')}>
      {withLabel && <Label htmlFor={id} req={f.req}>{f.label}</Label>}
      {inner}
      {f.hint && <span className="text-xs text-gray-500">{f.hint}</span>}
    </div>
  )
  switch (f.kind) {
    case 'text':
      return wrap(
        <input id={id} type={f.type ?? 'text'} inputMode={f.numeric ? 'numeric' : undefined} value={sv} placeholder={f.ph}
          autoComplete="off" disabled={disabled} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />,
      )
    case 'money':
      return wrap(
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">$</span>
          <input id={id} type="text" inputMode="decimal" value={sv} autoComplete="off" disabled={disabled}
            onChange={(e) => set(f.key, e.target.value)} className={cn(inputCls, 'pl-6 tabular-nums')} />
        </div>,
      )
    case 'area':
      return wrap(
        <textarea id={id} rows={f.rows ?? 3} value={sv} disabled={disabled} onChange={(e) => set(f.key, e.target.value)} className={cn(inputCls, 'resize-y leading-relaxed')} />,
      )
    case 'select':
      return wrap(
        <select id={id} value={sv} disabled={disabled} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
          <option value="">Choose…</option>
          {f.options.map((o) => <option key={o}>{o}</option>)}
        </select>,
      )
    case 'pick':
      return (
        <fieldset className={cn('flex flex-col gap-1.5 min-w-0 border-0 p-0 m-0', f.full && 'sm:col-span-2')}>
          <legend id={`${id}-lbl`} className={cn(labelCls, 'mb-1.5')}>{f.label}</legend>
          <Pills name={id} options={f.options} value={sv} small={f.sm} disabled={disabled} labelledBy={`${id}-lbl`}
            onChange={(o, checked) => checked && set(f.key, o)} />
          {f.hint && <span className="text-xs text-gray-500">{f.hint}</span>}
        </fieldset>
      )
    case 'multi': {
      const arr = Array.isArray(raw) ? raw : []
      return (
        <fieldset className={cn('flex flex-col gap-1.5 min-w-0 border-0 p-0 m-0', f.full !== false && 'sm:col-span-2')}>
          <legend id={`${id}-lbl`} className={cn(labelCls, 'mb-1.5')}>{f.label}</legend>
          <Pills name={id} options={f.options} value={arr} multiple disabled={disabled} labelledBy={`${id}-lbl`}
            onChange={(o, checked) => set(f.key, checked ? [...arr.filter((x) => x !== o), o] : arr.filter((x) => x !== o))} />
          {f.hint && <span className="text-xs text-gray-500">{f.hint}</span>}
        </fieldset>
      )
    }
    case 'check':
      return (
        <label htmlFor={id} className={cn('flex gap-3 items-start text-sm text-gray-800 cursor-pointer', f.full && 'sm:col-span-2')}>
          <input id={id} type="checkbox" checked={raw === true} disabled={disabled} onChange={(e) => set(f.key, e.target.checked)}
            className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#C9A84C]" />
          <span>{f.label}</span>
        </label>
      )
  }
}

export function GroupView({ g, a, set, disabled }: { g: Group; a: Answers; set: SetVal; disabled?: boolean }) {
  return (
    <section className="flex flex-col gap-3">
      {g.title && <h4 className={eyebrowCls}>{g.title}</h4>}
      <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
        {g.fields.map((f) => <FieldInput key={f.key} f={f} a={a} set={set} disabled={disabled} />)}
      </div>
    </section>
  )
}

export function SectionView({ s, a, set, disabled, props }: {
  s: Section; a: Answers; set: SetVal; disabled?: boolean
  props: { open: Record<string, boolean>; setOpen: (pid: string, open: boolean) => void; onAdd: () => void; onRemove: (pid: string) => void; confirmRemove: string; setConfirmRemove: (pid: string) => void }
}) {
  switch (s.type) {
    case 'group':
      return <GroupView g={s} a={a} set={set} disabled={disabled} />
    case 'lede':
      return <p className="text-gray-600 max-w-[66ch]">{s.text}</p>
    case 'note':
      return (
        <div className="rounded-md bg-[#F3F1EB] px-4 py-3 text-sm text-gray-700">
          {s.text}{' '}
          {s.link && <a href={s.link.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-dark underline underline-offset-2">{s.link.label}</a>}
        </div>
      )
    case 'columns':
      return (
        <div className={cn('grid gap-5', s.cols.length > 1 ? 'md:grid-cols-2' : 'max-w-xl')}>
          {s.cols.map((c) => (
            <div key={c.title} className="border border-gray-200 rounded-xl p-5 min-w-0 flex flex-col gap-4">
              <h4 className={eyebrowCls}>{c.title}</h4>
              {c.fields.map((f) => <FieldInput key={f.key} f={f} a={a} set={set} disabled={disabled} />)}
            </div>
          ))}
        </div>
      )
    case 'priorities':
      return (
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-200">
          {s.items.map((it) => {
            const id = fid(it.key)
            const v = a.v[it.key]
            return (
              <div key={it.key} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3">
                <span id={`${id}-lbl`} className="text-sm text-gray-800 min-w-0 flex-[1_1_280px]">{it.label}</span>
                <Pills name={id} options={s.options} value={typeof v === 'string' ? v : ''} small disabled={disabled} labelledBy={`${id}-lbl`}
                  onChange={(o, checked) => checked && set(it.key, o)} />
              </div>
            )
          })}
        </div>
      )
    case 'rows':
      return (
        <section className="flex flex-col gap-3">
          {s.title && <h4 className={eyebrowCls}>{s.title}</h4>}
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-200">
            {s.rows.map((r) => (
              <div key={r.title} className="grid md:grid-cols-[1.3fr_1fr_1fr] gap-4 p-4 items-start">
                <div className="flex flex-col gap-2 min-w-0">
                  <h5 className="font-body text-sm font-semibold text-navy">{r.title}</h5>
                  {r.fields[0] && <FieldInput f={r.fields[0]} a={a} set={set} disabled={disabled} />}
                </div>
                {r.fields.slice(1).map((f) => <FieldInput key={f.key} f={f} a={a} set={set} disabled={disabled} />)}
              </div>
            ))}
          </div>
        </section>
      )
    case 'properties':
      return (
        <div className="flex flex-col gap-3">
          {s.cards.length === 0 && (
            <div className="border-[1.5px] border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500">No properties added yet.</div>
          )}
          {s.cards.map((c) => (
            <details key={c.pid} open={!!props.open[c.pid]} onToggle={(e) => props.setOpen(c.pid, (e.target as HTMLDetailsElement).open)}
              className="group border border-gray-200 rounded-xl bg-white open:border-gray-300">
              <summary className="flex items-center gap-3.5 px-4 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="w-8 h-8 rounded-full bg-gold/15 text-gold-dark grid place-items-center text-sm font-bold shrink-0">{c.index + 1}</span>
                <span className="flex flex-col min-w-0 flex-1">
                  <b className="font-semibold text-navy break-words">{c.title}</b>
                  <small className="text-[12.5px] text-gray-500">{c.meta}</small>
                </span>
                <span aria-hidden className="w-2.5 h-2.5 border-r-2 border-b-2 border-gray-400 rotate-45 group-open:-rotate-[135deg] transition-transform shrink-0 mr-1" />
              </summary>
              <div className="px-4 pb-5 pt-1 flex flex-col gap-6 border-t border-gray-200">
                {c.groups.map((g) => <div key={g.title} className="pt-4"><GroupView g={g} a={a} set={set} disabled={disabled} /></div>)}
                {!disabled && (
                  <div className="flex justify-end">
                    <button type="button" className="text-sm font-semibold text-red-700 underline underline-offset-2"
                      onClick={() => (props.confirmRemove === c.pid ? props.onRemove(c.pid) : props.setConfirmRemove(c.pid))}>
                      {props.confirmRemove === c.pid ? 'Click again to remove this property' : 'Remove this property'}
                    </button>
                  </div>
                )}
              </div>
            </details>
          ))}
          {!disabled && (
            <div>
              <button type="button" onClick={props.onAdd}
                className="inline-flex items-center gap-2 font-semibold text-sm px-4 py-2.5 rounded border border-gray-300 text-navy hover:border-gold hover:bg-gold/10 transition">
                + Add a property
              </button>
            </div>
          )}
        </div>
      )
  }
}
