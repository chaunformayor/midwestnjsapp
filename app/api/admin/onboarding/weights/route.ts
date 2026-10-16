import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/onboarding/server'
import { handleError } from '@/lib/onboarding/http'
import { getWeights, saveWeights } from '@/lib/onboarding/review/service'

export const dynamic = 'force-dynamic'

/** The weights used to score client answers. */
export async function GET() {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'Please sign in as an admin.' }, { status: 401 })
  try {
    return NextResponse.json({ weights: await getWeights() })
  } catch (err) {
    return handleError(err)
  }
}

export async function PUT(req: Request) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'Please sign in as an admin.' }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as { weights?: unknown }
    return NextResponse.json({ ok: true, weights: await saveWeights(body.weights) })
  } catch (err) {
    return handleError(err)
  }
}
