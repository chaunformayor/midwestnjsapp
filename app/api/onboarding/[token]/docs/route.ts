import { setNotApplicable } from '@/lib/onboarding/service'
import { fail, ok, withClient } from '@/lib/onboarding/http'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

/** Marks a checklist item as not applicable, or undoes that. */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params
  return withClient(token, async (e) => {
    const body = (await req.json().catch(() => ({}))) as { doc?: unknown; na?: unknown }
    if (typeof body.doc !== 'string') return fail('Missing document.')
    const docs = await setNotApplicable(e, body.doc, body.na === true)
    return ok({ docs })
  })
}
