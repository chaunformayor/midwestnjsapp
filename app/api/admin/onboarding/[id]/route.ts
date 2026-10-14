import { NextResponse } from 'next/server'
import { currentAdmin, getEngagement, updateEngagement } from '@/lib/onboarding/server'
import { describeSigning, linkFor, refreshSigning, replaceLink, resendInvite, resendSigningEmail } from '@/lib/onboarding/service'
import { handleError } from '@/lib/onboarding/http'
import { NextcloudError } from '@/lib/nextcloud'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Admin actions on one client:
 *   resend         email the same link again
 *   new-link       replace the link (the old one stops working); email it if send=true
 *   refresh        check LibreSign now
 *   remind         have LibreSign email the signing link again to client signers who haven't signed
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
        if (r?.status === 'signed') return NextResponse.json({ ok: true, status: r.status, message: 'Everyone has signed.' })
        return NextResponse.json({ ok: true, status: r?.status ?? e.status, message: await describeSigning(r ?? e) })
      }
      case 'remind': {
        const r = await resendSigningEmail(e)
        return NextResponse.json({
          ok: true,
          message: r.sentTo.length ? `LibreSign is emailing the signing link again to ${r.sentTo.join(' and ')}.` : 'Everyone has signed.',
        })
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
    // Admins get LibreSign's or Nextcloud's own wording, which says what to fix
    if (err instanceof NextcloudError) {
      console.error('onboarding admin: Nextcloud error', err.status, err.message)
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return handleError(err)
  }
}
