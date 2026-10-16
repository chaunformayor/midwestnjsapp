import { clientView, resendSigningEmail } from '@/lib/onboarding/service'
import { ok, withClient } from '@/lib/onboarding/http'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

/** Asks LibreSign to email the signing link again to whoever hasn't signed. */
export async function POST(_req: Request, { params }: Ctx) {
  const { token } = await params
  return withClient(token, async (e, p) => {
    const r = await resendSigningEmail(e)
    return ok({ sentTo: r.sentTo, view: await clientView(r.engagement, p) })
  })
}
