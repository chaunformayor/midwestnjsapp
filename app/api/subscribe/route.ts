import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendSubscribeConfirmation } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, name, source } = body

  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('subscribers').upsert(
    { email, name, source: source || 'website' },
    { onConflict: 'email', ignoreDuplicates: true }
  )
  if (error) {
    console.error('subscribe insert error', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  await sendSubscribeConfirmation({ email, name })

  return NextResponse.json({ ok: true })
}
