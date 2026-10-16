import { NextResponse } from 'next/server'
import { currentAdmin, getEngagement } from '@/lib/onboarding/server'
import { handleError } from '@/lib/onboarding/http'
import { getReview, latestReview, runReview, saveSelections } from '@/lib/onboarding/review/service'

export const dynamic = 'force-dynamic'
// Reading the answers and writing the review can take a minute or two
export const maxDuration = 300

type Ctx = { params: Promise<{ id: string }> }

/** Runs a new review of this client's answers. */
export async function POST(_req: Request, { params }: Ctx) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'Please sign in as an admin.' }, { status: 401 })
  const { id } = await params
  try {
    const e = await getEngagement(id)
    if (!e) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    return NextResponse.json({ review: await runReview(e, admin.id) })
  } catch (err) {
    return handleError(err)
  }
}

/** Saves which recommendations go in the client PDF, and any edits to the client wording. */
export async function PUT(req: Request, { params }: Ctx) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'Please sign in as an admin.' }, { status: 401 })
  const { id } = await params
  try {
    const body = (await req.json().catch(() => ({}))) as { review_id?: unknown; included?: unknown; edits?: unknown }
    const current = typeof body.review_id === 'string' ? await getReview(body.review_id, id) : await latestReview(id)
    if (!current) return NextResponse.json({ error: 'No review found.' }, { status: 404 })
    const included = Array.isArray(body.included) ? body.included.filter((x): x is string => typeof x === 'string') : []
    const edits: Record<string, string> = {}
    if (body.edits && typeof body.edits === 'object') {
      for (const [k, v] of Object.entries(body.edits as Record<string, unknown>)) if (typeof v === 'string') edits[k] = v
    }
    return NextResponse.json({ review: await saveSelections(current, included, edits) })
  } catch (err) {
    return handleError(err)
  }
}
