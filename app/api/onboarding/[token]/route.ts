import { clientView } from '@/lib/onboarding/service'
import { ok, withClient } from '@/lib/onboarding/http'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

/** Everything the client page needs. Also checks LibreSign while signing is in progress. */
export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params
  return withClient(token, async (e) => ok(await clientView(e)))
}
