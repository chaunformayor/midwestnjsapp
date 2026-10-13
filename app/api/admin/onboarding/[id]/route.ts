import { NextResponse } from 'next/server'
import { currentAdmin, getEngagement, updateEngagement } from '@/lib/onboarding/server'
import { linkFor, refreshSigning, replaceLink, resendInvite } from '@/lib/onboarding/service'
import { handleError } from '@/lib/onboarding/http'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Admin actions on one client:
 *   resend         email the same link again
 *   new-link       replace the link (the old one stops working); email it if send=true
 *   refresh        check LibreSign now
 *   reset-signing  go back to before signing, e.g. after a typo in a signer's email
 *   cancel         turn the link off
 */
export async function POST(req: Request, { params }: Ctx) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'Please sign in as an admin.' }, { status: 401 })
  const { id } = await params
  try {
    const e = await getEngagement(id)
    if (!e) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    const body = (await req.json().catch(() => ({}))) as { action?: string; send?: boolean }
    switch (body.action) {
      case 'resend':
        await resendInvite(e)
        return NextResponse.json({ ok: true, message: `Link emailed to ${e.client_email}.` })
      case 'new-link': {
        const r = await replaceLink(e, body.send === true)
        return NextResponse.json({ ok: true, link: r.link, message: r.emailed ? `New link emailed to ${e.client_email}. The old link no longer works.` : 'New link created. The old link no longer works.' })
      }
      case 'refresh': {
        const r = await refreshSigning(e)
        return NextResponse.json({ ok: true, status: r?.status ?? e.status, message: r?.status === 'signed' ? 'Everyone has signed.' : 'Checked LibreSign. Still waiting on a signature.' })
      }
      case 'reset-signing':
        if (e.status !== 'signing') return NextResponse.json({ error: 'Only a request that is waiting for signatures can be reset.' }, { status: 409 })
        await updateEngagement(e.id, { status: 'invited', libresign_uuid: null, libresign_status: null, signers_status: null, sign_details: null, sent_for_signature_at: null })
        return NextResponse.json({ ok: true, message: 'Reset. The client can review and send the agreements again. Cancel the old request in LibreSign so nobody signs it.' })
      case 'cancel':
        await updateEngagement(e.id, { status: 'canceled' })
        return NextResponse.json({ ok: true, message: 'Canceled. The link no longer works.' })
      case 'link':
        return NextResponse.json({ ok: true, link: linkFor(e) })
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }
  } catch (err) {
    return handleError(err)
  }
}
