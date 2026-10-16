import { cn } from '@/lib/utils'
import type { Engagement, Person } from '@/lib/onboarding/server'

export function Chip({ tone = 'gray', children }: { tone?: 'gray' | 'ok' | 'wait' | 'off'; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap',
      tone === 'ok' && 'bg-green-100 text-green-800', tone === 'wait' && 'bg-amber-100 text-amber-800',
      tone === 'gray' && 'bg-gray-100 text-gray-600', tone === 'off' && 'bg-gray-100 text-gray-400 line-through')}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  )
}

export function AgreementChip({ e }: { e: Pick<Engagement, 'status'> }) {
  if (e.status === 'canceled') return <Chip tone="off">Canceled</Chip>
  if (e.status === 'signed' || e.status === 'submitted') return <Chip tone="ok">Signed</Chip>
  if (e.status === 'signing') return <Chip tone="wait">Awaiting signature</Chip>
  return <Chip>Not signed</Chip>
}

export function QuestionnaireChip({ e }: { e: Pick<Engagement, 'status' | 'questionnaire_part' | 'people'> }) {
  const people = e.people ?? []
  if (people.length > 1 && (e.status === 'signed' || e.status === 'submitted')) {
    const n = people.filter((p) => p.submitted_at).length
    if (n === people.length) return <Chip tone="ok">All {n} submitted</Chip>
    return n || people.some((p) => p.questionnaire_part) ? <Chip tone="wait">{n} of {people.length} submitted</Chip> : <Chip>Not started</Chip>
  }
  if (e.status === 'submitted') return <Chip tone="ok">Submitted</Chip>
  if (e.status === 'signed') return e.questionnaire_part ? <Chip tone="wait">In progress</Chip> : <Chip>Not started</Chip>
  return <Chip>—</Chip>
}

/** One person's own progress, for the admin detail page. */
export function PersonQuestionnaireChip({ p, signed }: { p: Pick<Person, 'submitted_at' | 'questionnaire_part'>; signed: boolean }) {
  if (p.submitted_at) return <Chip tone="ok">Submitted</Chip>
  if (!signed) return <Chip>—</Chip>
  return p.questionnaire_part ? <Chip tone="wait">In progress</Chip> : <Chip>Not started</Chip>
}

export function PersonDocsChip({ p, signed }: { p: Pick<Person, 'docs_done' | 'docs_total'>; signed: boolean }) {
  if (!signed) return <Chip>—</Chip>
  if (!p.docs_total) return <Chip>Not started</Chip>
  return <Chip tone={p.docs_done >= p.docs_total ? 'ok' : 'wait'}>{p.docs_done} of {p.docs_total}</Chip>
}

export function DocsChip({ e }: { e: Pick<Engagement, 'status' | 'docs_done' | 'docs_total'> }) {
  if (e.status !== 'signed' && e.status !== 'submitted') return <Chip>—</Chip>
  if (!e.docs_total) return <Chip>Not started</Chip>
  return <Chip tone={e.docs_done >= e.docs_total ? 'ok' : 'wait'}>{e.docs_done} of {e.docs_total}</Chip>
}
