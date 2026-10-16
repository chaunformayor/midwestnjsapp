import { resolveToken } from '@/lib/onboarding/server'
import { clientView } from '@/lib/onboarding/service'
import { MIS_CONTACT } from '@/lib/onboarding/config'
import ClientApp from '@/components/onboarding/ClientApp'

export const dynamic = 'force-dynamic'

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-7 max-w-xl">
      <h1 className="font-head text-navy text-2xl">{title}</h1>
      <div className="text-gray-600 mt-3 text-sm leading-relaxed">{children}</div>
      <p className="text-sm mt-5"><span className="font-semibold select-all">{MIS_CONTACT.phone}</span> · <span className="font-semibold select-all">{MIS_CONTACT.email}</span></p>
    </section>
  )
}

export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const found = await resolveToken(token)
  if (!found) {
    return (
      <Notice title="This link isn't working">
        <p>Check that you opened the full link from your email. If it still doesn&apos;t work, the link may have been replaced with a newer one. Contact us and we&apos;ll send you a fresh link.</p>
      </Notice>
    )
  }
  if (found.e.status === 'canceled') {
    return (
      <Notice title="This onboarding was closed">
        <p>This link is no longer active. If you think that&apos;s a mistake, contact us and we&apos;ll help.</p>
      </Notice>
    )
  }
  const view = await clientView(found.e, found.person)
  return <ClientApp token={token} initial={view} />
}
