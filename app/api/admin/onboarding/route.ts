import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/onboarding/server'
import { createEngagement, type CreateInput } from '@/lib/onboarding/service'
import { handleError } from '@/lib/onboarding/http'

export const dynamic = 'force-dynamic'

/** Creates a client's onboarding and, if asked, emails them the private link. */
export async function POST(req: Request) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'Please sign in as an admin.' }, { status: 401 })
  try {
    const body = (await req.json()) as CreateInput
    const { engagement, link, emailed } = await createEngagement(body, admin.id)
    return NextResponse.json({ id: engagement.id, link, emailed })
  } catch (err) {
    return handleError(err)
  }
}
