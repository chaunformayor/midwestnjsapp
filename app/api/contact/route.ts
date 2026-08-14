import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendContactNotification } from '@/lib/ses'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, phone, subject, message } = body

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const nameParts = String(name).trim().split(/\s+/)
  const first_name = nameParts[0] || name
  const last_name = nameParts.slice(1).join(' ') || ''

  // Save to DB — non-fatal if Supabase isn't configured yet
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('contact_submissions').insert({
      first_name, last_name, email, phone: phone || null,
      inquiry_type: subject || null, message,
    })
    if (error) console.error('contact insert error', error)
  } catch (err) {
    console.error('contact db error', err)
  }

  // Send email — non-fatal if Resend isn't configured yet
  try {
    await sendContactNotification({ name, email, phone, subject, message })
  } catch (err) {
    console.error('contact email error', err)
  }

  return NextResponse.json({ ok: true })
}
