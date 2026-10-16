import { NextResponse } from 'next/server'
import { currentAdmin, saveSettings } from '@/lib/onboarding/server'
import { handleError } from '@/lib/onboarding/http'

export const dynamic = 'force-dynamic'

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

/** Saves the MIS business details used in every agreement. */
export async function PUT(req: Request) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'Please sign in as an admin.' }, { status: 401 })
  try {
    const b = (await req.json()) as Record<string, unknown>
    const s = {
      entity_type: clip(b.entity_type, 80),
      office_address: clip(b.office_address, 200),
      signer_name: clip(b.signer_name, 80),
      signer_title: clip(b.signer_title, 80),
    }
    await saveSettings(s)
    return NextResponse.json({ ok: true, settings: s })
  } catch (err) {
    return handleError(err)
  }
}
