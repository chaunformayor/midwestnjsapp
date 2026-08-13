import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendInvestorApproved } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const { userId, email, name } = await req.json()
  if (!userId || !email) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('profiles').update({ role: 'investor' }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sendInvestorApproved({ email, name })

  return NextResponse.json({ ok: true })
}
