import { NextResponse } from 'next/server'
import { getEngagement, verifyCallbackSignature } from '@/lib/onboarding/server'
import { refreshSigning } from '@/lib/onboarding/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * LibreSign posts here when a document is signed. The post itself is not
 * trusted: the URL carries a signature only this site can make, and the
 * status is re-checked with LibreSign before anything changes.
 */
export async function POST(req: Request) {
  const u = new URL(req.url)
  const id = u.searchParams.get('e') ?? ''
  const sig = u.searchParams.get('sig') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id) || !sig || !verifyCallbackSignature(id, sig)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }
  try {
    const e = await getEngagement(id)
    if (!e) return NextResponse.json({ ok: true })
    let pdf: Buffer | undefined
    let uuid = ''
    try {
      const form = await req.formData()
      uuid = String(form.get('uuid') ?? '')
      const file = form.get('file')
      if (file && typeof file === 'object' && 'arrayBuffer' in file) pdf = Buffer.from(await file.arrayBuffer())
    } catch {
      /* body is optional; the status check below is what counts */
    }
    if (uuid && e.libresign_uuid && uuid !== e.libresign_uuid) return NextResponse.json({ ok: true, ignored: 'old request' })
    await refreshSigning(e, pdf && pdf.subarray(0, 5).toString() === '%PDF-' ? pdf : undefined)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('onboarding: callback failed', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
