import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendContactNotification } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, phone, subject, message } = body

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('contact_submissions').insert({
    name, email, phone, subject, message,
  })
  if (error) {
    console.error('contact insert error', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  await sendContactNotification({ name, email, phone, subject, message })

  return NextResponse.json({ ok: true })
}
