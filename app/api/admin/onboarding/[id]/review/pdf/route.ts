import { NextResponse } from 'next/server'
import { getFile } from '@/lib/nextcloud'
import { currentAdmin, getEngagement } from '@/lib/onboarding/server'
import { handleError } from '@/lib/onboarding/http'
import { latestReview, makeClientPdf, pdfPath } from '@/lib/onboarding/review/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

const headers = { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="MIS Recommendations.pdf"', 'Cache-Control': 'no-store' }

/** Builds the client-facing PDF from the selected recommendations, saves it in Nextcloud, and returns it. */
export async function POST(_req: Request, { params }: Ctx) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'Please sign in as an admin.' }, { status: 401 })
  const { id } = await params
  try {
    const e = await getEngagement(id)
    const review = e ? await latestReview(id) : null
    if (!e || !review) return NextResponse.json({ error: 'Run a review first.' }, { status: 404 })
    const { pdf } = await makeClientPdf(e, review)
    return new Response(new Uint8Array(pdf), { headers })
  } catch (err) {
    return handleError(err)
  }
}

/** Downloads the client PDF that was last created. */
export async function GET(_req: Request, { params }: Ctx) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'Please sign in as an admin.' }, { status: 401 })
  const { id } = await params
  try {
    const e = await getEngagement(id)
    const pdf = e?.nextcloud_folder ? await getFile(pdfPath(e.nextcloud_folder)) : null
    if (!pdf) return NextResponse.json({ error: 'No client PDF has been created yet.' }, { status: 404 })
    return new Response(new Uint8Array(pdf), { headers })
  } catch (err) {
    return handleError(err)
  }
}
