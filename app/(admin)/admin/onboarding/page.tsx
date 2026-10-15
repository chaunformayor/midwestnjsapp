import Link from 'next/link'
import { Plus } from 'lucide-react'
import { ENGAGEMENT_TYPES, householdName, missingSettings } from '@/lib/onboarding/config'
import { getSettings, listEngagements, type Engagement } from '@/lib/onboarding/server'
import { nextcloudConfigured } from '@/lib/nextcloud'
import { fmtDate } from '@/lib/utils'
import { AgreementChip, DocsChip, QuestionnaireChip } from '@/components/onboarding/StatusChips'

export const dynamic = 'force-dynamic'

export default async function OnboardingListPage() {
  let rows: Engagement[] = []
  let loadError = ''
  try {
    rows = await listEngagements()
  } catch (err) {
    loadError = (err as Error).message
  }
  const settings = await getSettings().catch(() => null)
  const missing = missingSettings(settings)
  const storageOk = nextcloudConfigured()

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-head text-navy text-3xl">Client Onboarding</h1>
          <p className="text-gray-500 text-sm mt-1">Private links for new clients: agreements, questionnaire, and documents.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/onboarding/weights" className="text-sm font-semibold text-navy underline underline-offset-2 hover:text-gold-dark">Review weights</Link>
          <Link href="/admin/onboarding/new" className="inline-flex items-center gap-2 bg-gold text-navy font-semibold text-sm px-5 py-3 rounded hover:bg-gold-dark transition">
            <Plus className="w-4 h-4" /> New client
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm mb-6">
          Couldn&apos;t load clients: {loadError}. If the onboarding tables don&apos;t exist yet, run <code>supabase/migrations/004_onboarding.sql</code> in the Supabase SQL editor.
        </div>
      )}
      {!storageOk && (
        <div className="rounded-md bg-amber-50 text-amber-900 px-4 py-3 text-sm mb-6">
          Nextcloud isn&apos;t connected. Add NEXTCLOUD_URL, NEXTCLOUD_USER, and NEXTCLOUD_APP_PASSWORD in Vercel before sending links.
        </div>
      )}
      {!loadError && missing.length > 0 && (
        <div className="rounded-md bg-amber-50 text-amber-900 px-4 py-3 text-sm mb-6">
          Add the MIS business details ({missing.join(', ')}) on the <Link href="/admin/onboarding/new" className="underline font-semibold">new client</Link> page. Every agreement uses them.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        {rows.length ? (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3 font-bold">Client</th>
                <th className="px-5 py-3 font-bold">Engagement</th>
                <th className="px-5 py-3 font-bold">Agreements</th>
                <th className="px-5 py-3 font-bold">Questionnaire</th>
                <th className="px-5 py-3 font-bold">Documents</th>
                <th className="px-5 py-3 font-bold">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/onboarding/${e.id}`} className="font-semibold text-navy hover:text-gold-dark">{householdName(e.client_name, e.spouse_name)}</Link>
                    <div className="text-xs text-gray-400">{e.client_email}</div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{ENGAGEMENT_TYPES[e.engagement_type]?.label ?? e.engagement_type}</td>
                  <td className="px-5 py-3.5"><AgreementChip e={e} /></td>
                  <td className="px-5 py-3.5"><QuestionnaireChip e={e} /></td>
                  <td className="px-5 py-3.5"><DocsChip e={e} /></td>
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{fmtDate(e.last_activity_at ?? e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !loadError && <div className="text-center py-16 text-gray-400 text-sm">No clients yet. Create the first link with <b>New client</b>.</div>
        )}
      </div>
    </div>
  )
}
