import { saveAnswers } from '@/lib/onboarding/service'
import { ok, withClient } from '@/lib/onboarding/http'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

/** Saves a questionnaire draft to the client's Nextcloud folder. */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params
  return withClient(token, async (e) => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    await saveAnswers(e, body)
    return ok({ savedAt: new Date().toISOString() })
  })
}
