import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FolderOpen } from 'lucide-react'
import { ENGAGEMENT_TYPES, FEE_FIELDS, moneyText, householdName } from '@/lib/onboarding/config'
import { ensurePeople, getEngagement, personLink } from '@/lib/onboarding/server'
import { folderWebUrl, validationPageUrl } from '@/lib/nextcloud'
import { fmtDateTime } from '@/lib/utils'
import EngagementActions from '@/components/onboarding/EngagementActions'
import ReviewPanel from '@/components/onboarding/ReviewPanel'
import { latestReview } from '@/lib/onboarding/review/service'
import { AgreementChip, Chip, PersonDocsChip, PersonQuestionnaireChip } from '@/components/onboarding/StatusChips'

export const dynamic = 'force-dynamic'

const card = 'bg-white rounded-xl border border-gray-100 p-6'

export default async function EngagementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params
  const sp = await searchParams
  const e = await getEngagement(id)
  if (!e) notFound()
  const people = await ensurePeople(e)
  const signers = e.signers_status ?? []
  const signed = e.status === 'signed' || e.status === 'submitted'
  const review = await latestReview(e.id).catch(() => null)
  const anySubmitted = people.some((p) => p.submitted_at)
  let verifyUrl: string | null = null
  try {
    if (signed && e.libresign_uuid) verifyUrl = validationPageUrl(e.libresign_uuid)
  } catch {
    /* Nextcloud not configured here */
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link href="/admin/onboarding" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy mb-4"><ArrowLeft className="w-4 h-4" /> All clients</Link>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-dark">{ENGAGEMENT_TYPES[e.engagement_type]?.label}</p>
          <h1 className="font-head text-navy text-3xl mt-1">{householdName(e.client_name, e.spouse_name)}</h1>
          <p className="text-gray-500 text-sm mt-1">{e.client_email}{e.spouse_email ? ` · ${e.spouse_email}` : ''} · created {fmtDateTime(e.created_at)}</p>
          <p className="text-gray-400 text-xs mt-1">Each person has their own link, questionnaire and document folder.</p>
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
          {people.map((p) => (
            <section key={p.id} className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h2 className="font-head text-navy text-xl">{p.role === 'client' ? 'Client link' : 'Spouse or co-owner link'} · {p.name}</h2>
                {p.nextcloud_folder && (
                  <a href={folderWebUrl(p.nextcloud_folder)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:text-gold-dark">
                    <FolderOpen className="w-4 h-4" /> {p.name}&apos;s folder
                  </a>
                )}
              </div>
              <EngagementActions id={e.id} link={personLink(e, p)} status={e.status} email={p.email} person={p.role} submitted={Boolean(p.submitted_at)} />
              {p.role === 'spouse' && !signed && <p className="text-xs text-gray-500 mt-3">The spouse&apos;s link is emailed automatically once the agreements are signed. You can copy it earlier if you want to send it yourself.</p>}
            </section>
          ))}

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
              {signed && (
                <div className="py-3 text-sm flex flex-col gap-1.5">
                  <div className="font-semibold text-navy">Signing confirmation</div>
                  <p className="text-xs text-gray-500">The signed PDF and a Signing Certificate (who signed, when, and a fingerprint of the PDF) are in this engagement&apos;s Agreements folder.</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    {e.nextcloud_folder && <a href={folderWebUrl(`${e.nextcloud_folder}/Agreements`)} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy hover:text-gold-dark underline underline-offset-2">Open the Agreements folder</a>}
                    {verifyUrl && <a href={verifyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy hover:text-gold-dark underline underline-offset-2">Verify signatures in LibreSign</a>}
                  </div>
                </div>
              )}
              {people.map((p) => (
                <div key={p.id} className="py-3">
                  <div className="font-semibold text-navy text-sm mb-2">{p.name} <span className="font-normal text-gray-400">· {p.role === 'client' ? 'client' : 'spouse or co-owner'}</span></div>
                  <div className="flex flex-wrap justify-between gap-3 py-1">
                    <div>
                      <div className="text-sm text-gray-700">Questionnaire</div>
                      <div className="text-xs text-gray-500">{p.submitted_at ? `Submitted ${fmtDateTime(p.submitted_at)}` : p.questionnaire_part ? 'Started' : 'Not started'}</div>
                    </div>
                    <PersonQuestionnaireChip p={p} signed={signed} />
                  </div>
                  <div className="flex flex-wrap justify-between gap-3 py-1">
                    <div>
                      <div className="text-sm text-gray-700">Documents</div>
                      <div className="text-xs text-gray-500">Uploaded or marked not applicable</div>
                    </div>
                    <PersonDocsChip p={p} signed={signed} />
                  </div>
                </div>
              ))}
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

        <div className="lg:col-span-2">
          <ReviewPanel id={e.id} initial={review} canRun={anySubmitted} aiReady={Boolean((process.env.ANTHROPIC_API_KEY ?? '').trim())} hasFolder={Boolean(e.nextcloud_folder)} readyNote="The review can run once at least one person has submitted their questionnaire." />
        </div>
      </div>
    </div>
  )
}
