import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import nodemailer from 'nodemailer'

// When SMTP_HOST is set, all site email goes through that SMTP server instead
// of Amazon SES. Leave it unset to use SES.
//   SMTP_HOST, SMTP_PORT (587 or 465), SMTP_USER, SMTP_PASSWORD,
//   SMTP_FROM (optional, e.g. "Midwest Investor Services <info@...>"; must be
//   an address that SMTP account is allowed to send from)
let smtp: nodemailer.Transporter | null | undefined
function getSMTP() {
  if (smtp !== undefined) return smtp
  const host = (process.env.SMTP_HOST ?? '').trim()
  if (!host) return (smtp = null)
  const port = Number(process.env.SMTP_PORT || 587)
  const user = (process.env.SMTP_USER ?? '').trim()
  smtp = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 uses TLS from the start; 587 upgrades with STARTTLS
    auth: user ? { user, pass: (process.env.SMTP_PASSWORD ?? '').trim() } : undefined, // a stray space or line break here makes the login fail
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })
  return smtp
}

/**
 * Reads SMTP_FROM leniently: accepts "Name <email>", plain "email", or either
 * wrapped in quotes or missing the angle brackets. Falls back to the site's
 * default sender if no email address can be found in it.
 */
function smtpFrom(fallback: string): string | { name: string; address: string } {
  const raw = (process.env.SMTP_FROM ?? '').trim().replace(/^['"]+|['"]+$/g, '').trim()
  if (!raw) return fallback
  const m = raw.match(/[^\s<>"',;]+@[^\s<>"',;]+\.[A-Za-z]{2,}/)
  if (!m) {
    console.warn('SMTP_FROM has no valid email address in it; using the default sender')
    return fallback
  }
  const name = raw.replace(m[0], '').replace(/[<>"']/g, '').trim()
  return name ? { name, address: m[0] } : m[0]
}

function getSES() {
  return new SESv2Client({
    region: process.env.AWS_SES_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  })
}

async function sendEmail({ from, to, replyTo, subject, html }: {
  from: string; to: string | string[]; replyTo?: string; subject: string; html: string
}) {
  const toAddresses = Array.isArray(to) ? to : [to]
  const transport = getSMTP()
  if (transport) {
    await transport.sendMail({ from: smtpFrom(from), to: toAddresses, replyTo, subject, html })
    return
  }
  const cmd = new SendEmailCommand({
    FromEmailAddress: from,
    Destination: { ToAddresses: toAddresses },
    ReplyToAddresses: replyTo ? [replyTo] : undefined,
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: html, Charset: 'UTF-8' } },
      },
    },
  })
  await getSES().send(cmd)
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
  await sendEmail({
    from: FROM, to: ADMIN_EMAIL, replyTo: data.email,
    subject: `New Contact: ${data.name}${data.subject ? ` — ${data.subject}` : ''}`,
    html: `<h2>New contact form submission</h2>
      <table style="border-collapse:collapse;width:100%">
        ${row('Name', data.name)}${row('Email', data.email)}${row('Phone', data.phone || '')}
        ${row('Subject', data.subject || '')}${row('Message', data.message)}
      </table>`,
  })
  await sendEmail({
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
  await sendEmail({
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
  await sendEmail({
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
  await sendEmail({
    from: FROM, to: ADMIN_EMAIL,
    subject: `New Investor List Signup — ${data.email}`,
    html: `<p>New subscriber: <strong>${data.name || '—'}</strong> &lt;${data.email}&gt;</p>`,
  })
  await sendEmail({
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
  await sendEmail({
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

// ---------------------------------------------------------------- client onboarding

function esc(s: string | null | undefined) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0;"><a href="${esc(href)}" style="background:#C9A84C;color:#0D1B2A;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${esc(label)}</a></p>`
}

const SIGNOFF = `<p style="margin-top:32px;color:#6B7280;font-size:14px;">— Midwest Investor Services · 636-590-7698 · info@midwestinvestorservices.com</p>`

export async function sendOnboardingInvite(data: { to: string; firstName: string; link: string; engagement: string }) {
  await sendEmail({
    from: FROM, to: data.to, replyTo: ADMIN_EMAIL,
    subject: 'Your Midwest Investor Services onboarding link',
    html: baseLayout(`
      <p>Hi ${esc(data.firstName) || 'there'},</p>
      <p>Thank you for choosing Midwest Investor Services for ${esc(data.engagement.toLowerCase())}. Here is your private link to get started.</p>
      <p>You'll review and sign our engagement and confidentiality agreements, then answer a questionnaire about your goals and properties and upload a few documents. It takes about 30–45 minutes, and you can stop and come back anytime with the same link.</p>
      ${button(data.link, 'Start onboarding')}
      <p style="color:#6B7280;font-size:13px;">This link is just for you. Please don't forward it.</p>
      ${SIGNOFF}`),
  })
}

export async function sendOnboardingSigned(data: {
  client: string
  adminUrl: string
  folderUrl?: string
  signers: { name: string; signedAt: string }[]
  validationUrl?: string | null
  people: { email: string; firstName: string; link: string | null }[]
}) {
  const signerRows = data.signers.map((s) => `<tr><td style="padding:6px 8px;border:1px solid #eee;">${esc(s.name)}</td><td style="padding:6px 8px;border:1px solid #eee;">${esc(s.signedAt)}</td></tr>`).join('')
  const signerTable = signerRows ? `<table style="border-collapse:collapse;width:100%;font-size:14px;margin:12px 0;"><tr><th align="left" style="padding:6px 8px;border:1px solid #eee;">Signed by</th><th align="left" style="padding:6px 8px;border:1px solid #eee;">When</th></tr>${signerRows}</table>` : ''
  const verify = data.validationUrl ? `<p><a href="${esc(data.validationUrl)}" style="color:#A88830;">Verify the signatures online</a></p>` : ''
  await sendEmail({
    from: FROM, to: ADMIN_EMAIL,
    subject: `Agreements signed — ${data.client}`,
    html: baseLayout(`
      <p><strong>${esc(data.client)}</strong> signed the Engagement Agreement and NDA, and so did MIS. The signed PDF and a signing certificate are in the engagement's Agreements folder in Nextcloud.</p>
      ${signerTable}
      ${verify}
      ${button(data.adminUrl, 'Open in admin')}
      ${data.folderUrl ? `<p><a href="${esc(data.folderUrl)}" style="color:#A88830;">Open the Nextcloud folder</a></p>` : ''}`),
  })
  for (const p of data.people) {
    if (!p.email) continue
    await sendEmail({
      from: FROM, to: p.email, replyTo: ADMIN_EMAIL,
      subject: 'Your agreements are signed — next, your questionnaire',
      html: baseLayout(`
        <p>Hi ${esc(p.firstName) || 'there'},</p>
        <p>Your Engagement Agreement and NDA are fully signed. This is your confirmation:</p>
        ${signerTable}
        <p>You can download the signed PDF and the signing certificate anytime from your onboarding page.</p>
        <p>Next, answer your own questionnaire and upload your own documents. Your progress saves as you go.</p>
        ${p.link ? button(p.link, 'Continue onboarding') : ''}
        <p style="color:#6B7280;font-size:13px;">This link is just for you. Please don't forward it.</p>
        ${SIGNOFF}`),
    })
  }
}

export async function sendOnboardingSubmitted(data: { clientEmail: string; firstName: string; client: string; link: string | null; adminUrl: string; docsDone: number; docsTotal: number; folderUrl?: string; everyoneDone?: boolean; waitingOn?: string[] }) {
  const status = data.everyoneDone
    ? '<p>Everyone on this engagement has now submitted.</p>'
    : data.waitingOn?.length ? `<p>Still waiting on: ${esc(data.waitingOn.join(', '))}.</p>` : ''
  await sendEmail({
    from: FROM, to: ADMIN_EMAIL,
    subject: `Questionnaire submitted — ${data.client}`,
    html: baseLayout(`
      <p><strong>${esc(data.client)}</strong> submitted the intake questionnaire. Documents so far: ${data.docsDone} of ${data.docsTotal}.</p>
      ${status}
      <p>The answers and document checklist are saved as one PDF in that person's Nextcloud folder.</p>
      ${button(data.adminUrl, 'Open in admin')}
      ${data.folderUrl ? `<p><a href="${esc(data.folderUrl)}" style="color:#A88830;">Open the Nextcloud folder</a></p>` : ''}`),
  })
  await sendEmail({
    from: FROM, to: data.clientEmail, replyTo: ADMIN_EMAIL,
    subject: 'We received your questionnaire',
    html: baseLayout(`
      <p>Hi ${esc(data.firstName) || 'there'},</p>
      <p>Thank you. We received your questionnaire${data.docsDone < data.docsTotal ? ` and ${data.docsDone} of ${data.docsTotal} documents. You can upload the rest anytime from your onboarding link` : ' and documents'}.</p>
      <p>We'll review everything within two business days and reach out to schedule your strategy meeting.</p>
      ${data.link && data.docsDone < data.docsTotal ? button(data.link, 'Upload more documents') : ''}
      ${SIGNOFF}`),
  })
}
