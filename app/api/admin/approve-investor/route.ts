import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendInvestorApproved } from '@/lib/ses'
import { currentAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // Only signed-in admins may approve investors. Before this check, anyone could
  // call this route directly and approve any account.
  if (!(await currentAdmin())) return NextResponse.json({ error: 'Not allowed' }, { status: 401 })

  const { userId, email, name } = await req.json()
  if (!userId || !email) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('profiles').update({ role: 'investor' }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sendInvestorApproved({ email, name })

  return NextResponse.json({ ok: true })
}
