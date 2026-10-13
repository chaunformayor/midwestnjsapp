import { clientView, startSigning } from '@/lib/onboarding/service'
import { ok, withClient } from '@/lib/onboarding/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ token: string }> }

/** Builds the agreement PDF and sends it to LibreSign for signature. */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params
  return withClient(token, async (e) => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const updated = await startSigning(e, body)
    return ok(await clientView(updated))
  })
}
