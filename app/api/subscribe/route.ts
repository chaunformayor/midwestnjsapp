import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendSubscribeConfirmation } from '@/lib/ses'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, name, source } = body

  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('subscribers').upsert(
      { email, name, source: source || 'website' },
      { onConflict: 'email', ignoreDuplicates: true }
    )
    if (error) console.error('subscribe insert error', error)
  } catch (err) {
    console.error('subscribe db error', err)
  }

  try {
    await sendSubscribeConfirmation({ email, name })
  } catch (err) {
    console.error('subscribe email error', err)
  }

  return NextResponse.json({ ok: true })
}
