import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendDealNotification } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    submitter_name, submitter_email, submitter_phone,
    property_address, asking_price, arv, rehab_estimate,
    property_type, bedrooms, bathrooms, sqft, notes
  } = body

  if (!submitter_name || !submitter_email || !property_address || !asking_price) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('deal_submissions').insert({
      submitter_name, submitter_email, submitter_phone,
      property_address,
      asking_price: Number(asking_price),
      arv: arv ? Number(arv) : null,
      rehab_estimate: rehab_estimate ? Number(rehab_estimate) : null,
      property_type, bedrooms: bedrooms ? Number(bedrooms) : null,
      bathrooms: bathrooms ? Number(bathrooms) : null,
      sqft: sqft ? Number(sqft) : null,
      notes,
    })
    if (error) console.error('deal insert error', error)
  } catch (err) {
    console.error('deal db error', err)
  }

  try {
    await sendDealNotification({
      submitterName: submitter_name,
      submitterEmail: submitter_email,
      submitterPhone: submitter_phone,
      propertyAddress: property_address,
      askingPrice: asking_price,
      arv, rehabEstimate: rehab_estimate,
      propertyType: property_type,
      notes,
    })
  } catch (err) {
    console.error('deal email error', err)
  }

  return NextResponse.json({ ok: true })
}
