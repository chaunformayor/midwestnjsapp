import { cn } from '@/lib/utils'
import type { Engagement } from '@/lib/onboarding/server'

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

export function QuestionnaireChip({ e }: { e: Pick<Engagement, 'status' | 'questionnaire_part'> }) {
  if (e.status === 'submitted') return <Chip tone="ok">Submitted</Chip>
  if (e.status === 'signed') return e.questionnaire_part ? <Chip tone="wait">In progress</Chip> : <Chip>Not started</Chip>
  return <Chip>—</Chip>
}

export function DocsChip({ e }: { e: Pick<Engagement, 'status' | 'docs_done' | 'docs_total'> }) {
  if (e.status !== 'signed' && e.status !== 'submitted') return <Chip>—</Chip>
  if (!e.docs_total) return <Chip>Not started</Chip>
  return <Chip tone={e.docs_done >= e.docs_total ? 'ok' : 'wait'}>{e.docs_done} of {e.docs_total}</Chip>
}
