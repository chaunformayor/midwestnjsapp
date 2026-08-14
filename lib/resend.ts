import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
}

const FROM = 'Midwest Investor Services <info@midwestinvestorservices.com>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'info@midwestinvestorservices.com'
const DEALS_EMAIL = process.env.DEALS_EMAIL ?? 'deals@midwestinvestorservices.com'
const BOOKING_URL = 'https://chaun-missourihandymanservice.zohobookings.com/#/4594161000000711006'

function row(label: string, value: string) {
  return `<tr><td style="padding:8px;border:1px solid #eee;font-weight:600;white-space:nowrap">${label}</td><td style="padding:8px;border:1px solid #eee;">${value || '—'}</td></tr>`
}

function baseLayout(body: string) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0D1B2A;padding:24px 32px;">
        <h2 style="color:#C9A84C;margin:0;font-size:20px;">Midwest Investor Services</h2>
      </div>
      <div style="padding:32px;background:#fff;border:1px solid #E5E7EB;">${body}</div>
    </div>`
}

export async function sendContactNotification(data: {
  name: string; email: string; phone?: string; subject?: string; message: string
}) {
  await getResend().emails.send({
    from: FROM, to: ADMIN_EMAIL, replyTo: data.email,
    subject: `New Contact: ${data.name}${data.subject ? ` — ${data.subject}` : ''}`,
    html: `<h2>New contact form submission</h2>
      <table style="border-collapse:collapse;width:100%">
        ${row('Name', data.name)}${row('Email', data.email)}${row('Phone', data.phone || '')}
        ${row('Subject', data.subject || '')}${row('Message', data.message)}
      </table>`,
  })
  await getResend().emails.send({
    from: FROM, to: data.email,
    subject: 'We received your message — Midwest Investor Services',
    html: baseLayout(`
      <p>Hi ${data.name.split(' ')[0]},</p>
      <p>Thanks for reaching out. We'll respond within one business day.</p>
      <p>For urgent matters call <strong>636-590-7698</strong> (Mon–Fri, 8AM–6PM CT).</p>
      <p>Or book a call: <a href="${BOOKING_URL}" style="color:#A88830;">Schedule on Zoho Bookings →</a></p>
      <p style="margin-top:32px;color:#6B7280;font-size:14px;">— The MIS Team · St. Louis, MO</p>`),
  })
}

export async function sendDealNotification(data: {
  submitterName: string; submitterEmail: string; submitterPhone?: string
  propertyAddress: string; askingPrice: string | number
  arv?: string | number; rehabEstimate?: string | number
  propertyType?: string; notes?: string
}) {
  await getResend().emails.send({
    from: FROM, to: DEALS_EMAIL, replyTo: data.submitterEmail,
    subject: `Deal Submission — ${data.propertyAddress}`,
    html: `<h2>New deal submission</h2>
      <table style="border-collapse:collapse;width:100%">
        ${row('Submitter', `${data.submitterName} &lt;${data.submitterEmail}&gt;${data.submitterPhone ? ` · ${data.submitterPhone}` : ''}`)}
        ${row('Address', data.propertyAddress)}
        ${row('Asking Price', data.askingPrice ? `$${Number(data.askingPrice).toLocaleString()}` : '')}
        ${row('Type', data.propertyType || '')}
        ${row('Est. ARV', data.arv ? `$${Number(data.arv).toLocaleString()}` : '')}
        ${row('Est. Rehab', data.rehabEstimate ? `$${Number(data.rehabEstimate).toLocaleString()}` : '')}
        ${row('Notes', data.notes || '')}
      </table>`,
  })
  await getResend().emails.send({
    from: FROM, to: data.submitterEmail,
    subject: 'Deal Received — Midwest Investor Services',
    html: baseLayout(`
      <p>Hi ${data.submitterName.split(' ')[0]},</p>
      <p>We received your deal submission for <strong>${data.propertyAddress}</strong>.</p>
      <p>Our acquisitions team will review it within <strong>48 business hours</strong>.</p>
      <p>Have photos or an inspection report? Reply to this email with attachments — it speeds up our analysis.</p>
      <p>Questions? Call <strong>636-590-7698</strong>.</p>
      <p style="margin-top:32px;color:#6B7280;font-size:14px;">— The MIS Team · St. Louis, MO</p>`),
  })
}

export async function sendSubscribeConfirmation(data: { email: string; name?: string }) {
  await getResend().emails.send({
    from: FROM, to: ADMIN_EMAIL,
    subject: `New Investor List Signup — ${data.email}`,
    html: `<p>New subscriber: <strong>${data.name || '—'}</strong> &lt;${data.email}&gt;</p>`,
  })
  await getResend().emails.send({
    from: FROM, to: data.email,
    subject: "You're on the MIS Investor List",
    html: baseLayout(`
      <p>Hi${data.name ? ` ${data.name.split(' ')[0]}` : ''},</p>
      <p>You're on the MIS investor list. Here's what to expect:</p>
      <ul>
        <li>Monthly St. Louis market reports</li>
        <li>Off-market deal alerts — first access</li>
        <li>Investor education and strategy content</li>
      </ul>
      <p>Book a free 30-minute investor strategy call: <a href="${BOOKING_URL}" style="color:#A88830;">Schedule →</a></p>
      <p style="margin-top:32px;color:#6B7280;font-size:14px;">— The MIS Team · 636-590-7698</p>`),
  })
}

export async function sendInvestorApproved(data: { email: string; name?: string }) {
  await getResend().emails.send({
    from: FROM, to: data.email,
    subject: 'Your Investor Portal Access is Approved — Midwest Investor Services',
    html: baseLayout(`
      <p>Hi ${data.name ? data.name.split(' ')[0] : 'there'},</p>
      <p>Your Investor Portal access has been <strong>approved</strong>.</p>
      <p>You now have access to:</p>
      <ul>
        <li>MIS deal underwriting templates</li>
        <li>Investor buy box framework</li>
        <li>St. Louis submarket reports</li>
        <li>Rehab scope of work templates</li>
        <li>DSCR loan guide and lender referrals</li>
      </ul>
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/portal" style="background:#C9A84C;color:#0D1B2A;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;margin-top:8px;">Access Your Portal →</a></p>
      <p style="margin-top:32px;color:#6B7280;font-size:14px;">— The MIS Team · 636-590-7698</p>`),
  })
}
