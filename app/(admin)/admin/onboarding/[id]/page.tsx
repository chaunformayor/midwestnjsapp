import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FolderOpen } from 'lucide-react'
import { ENGAGEMENT_TYPES, FEE_FIELDS, moneyText, householdName } from '@/lib/onboarding/config'
import { getEngagement } from '@/lib/onboarding/server'
import { linkFor } from '@/lib/onboarding/service'
import { folderWebUrl } from '@/lib/nextcloud'
import { fmtDateTime } from '@/lib/utils'
import EngagementActions from '@/components/onboarding/EngagementActions'
import { AgreementChip, Chip, DocsChip, QuestionnaireChip } from '@/components/onboarding/StatusChips'

export const dynamic = 'force-dynamic'

const card = 'bg-white rounded-xl border border-gray-100 p-6'

export default async function EngagementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params
  const sp = await searchParams
  const e = await getEngagement(id)
  if (!e) notFound()
  const link = linkFor(e)
  const signers = e.signers_status ?? []

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link href="/admin/onboarding" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy mb-4"><ArrowLeft className="w-4 h-4" /> All clients</Link>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-dark">{ENGAGEMENT_TYPES[e.engagement_type]?.label}</p>
          <h1 className="font-head text-navy text-3xl mt-1">{householdName(e.client_name, e.spouse_name)}</h1>
          <p className="text-gray-500 text-sm mt-1">{e.client_email}{e.spouse_email ? ` · ${e.spouse_email}` : ''} · created {fmtDateTime(e.created_at)}</p>
        </div>
        {e.nextcloud_folder && (
          <a href={folderWebUrl(e.nextcloud_folder)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-gray-200 bg-white text-navy font-semibold text-sm px-4 py-2.5 rounded hover:border-gold">
            <FolderOpen className="w-4 h-4" /> Open Nextcloud folder
          </a>
        )}
      </div>

      {sp.created && (
        <div className="rounded-md bg-green-50 text-green-800 px-4 py-3 text-sm mb-6">
          Link created{sp.emailed === '1' ? ` and emailed to ${e.client_email}` : sp.emailed === '0' ? ', but the email could not be sent. Copy the link below and send it yourself' : ''}.
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="flex flex-col gap-6">
          <section className={card}>
            <h2 className="font-head text-navy text-xl mb-4">Client link</h2>
            <EngagementActions id={e.id} link={link} status={e.status} email={e.client_email} />
          </section>

          <section className={card}>
            <h2 className="font-head text-navy text-xl mb-4">Progress</h2>
            <div className="divide-y divide-gray-100">
              <div className="py-3 flex flex-wrap justify-between gap-3">
                <div>
                  <div className="font-semibold text-navy text-sm">Agreements</div>
                  <div className="text-xs text-gray-500">
                    {e.signed_at ? `Signed ${fmtDateTime(e.signed_at)}` : e.sent_for_signature_at ? `Sent for signature ${fmtDateTime(e.sent_for_signature_at)}` : 'Not sent yet'}
                  </div>
                </div>
                <AgreementChip e={e} />
              </div>
              {signers.length > 0 && (
                <div className="py-3">
                  <table className="w-full text-sm">
                    <tbody>
                      {signers.map((s, i) => (
                        <tr key={i}>
                          <td className="py-1.5 text-gray-700">{s.name}{s.email ? <span className="text-gray-400"> · {s.email}</span> : ''}</td>
                          <td className="py-1.5 text-right">{s.signed_at ? <Chip tone="ok">Signed {fmtDateTime(s.signed_at)}</Chip> : <Chip tone="wait">Waiting</Chip>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="py-3 flex flex-wrap justify-between gap-3">
                <div>
                  <div className="font-semibold text-navy text-sm">Questionnaire</div>
                  <div className="text-xs text-gray-500">{e.submitted_at ? `Submitted ${fmtDateTime(e.submitted_at)}` : e.questionnaire_part ? 'Started' : 'Not started'}</div>
                </div>
                <QuestionnaireChip e={e} />
              </div>
              <div className="py-3 flex flex-wrap justify-between gap-3">
                <div>
                  <div className="font-semibold text-navy text-sm">Documents</div>
                  <div className="text-xs text-gray-500">Uploaded or marked not applicable</div>
                </div>
                <DocsChip e={e} />
              </div>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className={card}>
            <h2 className="font-head text-navy text-lg mb-3">Fees in the agreement</h2>
            <dl className="flex flex-col gap-2 text-sm">
              {[
                ...FEE_FIELDS.map((f) => [f.label, String(e.fees[f.key] ?? '').trim() ? (f.money ? moneyText(e.fees[f.key]) : e.fees[f.key]) : '—'] as const),
                ['Payment methods', e.pay_methods.join(', ') || '—'] as const,
                ...(e.sign_details?.payOption ? [['Client chose', e.sign_details.payOption] as const] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-gray-500 min-w-0">{label}</dt>
                  <dd className="text-right font-semibold tabular-nums max-w-[55%]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className={card}>
            <h2 className="font-head text-navy text-lg mb-2">Engagement focus</h2>
            <p className="text-sm text-gray-600">{e.focus}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
