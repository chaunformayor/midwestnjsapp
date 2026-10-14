// API-level check of the per-person flow: each person has their own link,
// questionnaire, documents and folder, and the signing confirmation is saved.
// Needs no browser. run.sh starts the site and stand-ins first:
//   E2E_RUNNER=node tests/onboarding-e2e/run.sh
// Usage: node people-check.mjs <admin access token>
const SITE = 'http://127.0.0.1:3000'
const MOCK = 'http://127.0.0.1:8899'
const ACCESS = process.argv[2]
const results = []

function check(name, cond, detail = '') {
  results.push([name, Boolean(cond)])
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

const b64url = (s) => Buffer.from(s).toString('base64url')
const session = {
  access_token: ACCESS, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'refresh-test',
  user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: {} },
}
const ADMIN_COOKIE = `sb-127-auth-token=base64-${b64url(JSON.stringify(session))}`

const mock = async (path) => (await fetch(MOCK + path)).json()
async function admin(path, body, method = 'POST') {
  const res = await fetch(SITE + path, { method, headers: { 'content-type': 'application/json', cookie: ADMIN_COOKIE }, body: JSON.stringify(body) })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}
async function client(token, path = '', init = {}) {
  const res = await fetch(`${SITE}/api/onboarding/${token}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } })
  const type = res.headers.get('content-type') ?? ''
  return { status: res.status, json: type.includes('json') ? await res.json().catch(() => ({})) : null, buf: type.includes('pdf') ? Buffer.from(await res.arrayBuffer()) : null }
}
const tokenOf = (link) => link.split('/onboarding/')[1].split('?')[0]
const post = (body) => ({ method: 'POST', body: JSON.stringify(body) })

// ---------------------------------------------------------------- set up and create
await admin('/api/admin/onboarding/settings', { entity_type: 'limited liability company', office_address: '100 Example Blvd, St. Louis, MO 63101', signer_name: 'Chaun', signer_title: 'Managing Member' }, 'PUT')
const fees = { phase1: '2,500', meetingHours: '2', deliveryDays: '10', hourly: '175', extra: '175', retainer: '', cap: '3,500', cancel: '500', mileage: '50', approval: '100' }
const made = await admin('/api/admin/onboarding', {
  client_name: 'Jordan Ellis', client_email: 'jordan@example.com', spouse_name: 'Taylor Ellis', spouse_email: 'taylor@example.com',
  engagement_type: 'estate', focus: 'protecting assets', modules: ['finances', 'estate'], fees, pay_methods: ['Check'], send_email: true,
})
check('engagement created', made.status === 200 && made.json.link, JSON.stringify(made.json).slice(0, 120))
const id = made.json.id
const jordan = tokenOf(made.json.link)
const spouseLink = await admin(`/api/admin/onboarding/${id}`, { action: 'link', person: 'spouse' })
check('admin can get the spouse link', spouseLink.json.link && tokenOf(spouseLink.json.link) !== jordan)
const taylor = tokenOf(spouseLink.json.link)

let st = await mock('/__mock/state')
check('two people rows created', st.db.onboarding_people.length === 2 && st.db.onboarding_people.map((p) => p.role).sort().join() === 'client,spouse')
check('spouse has own token, client uses the engagement link', st.db.onboarding_people.find((p) => p.role === 'spouse').token_hash && !st.db.onboarding_people.find((p) => p.role === 'client').token_hash)

// ---------------------------------------------------------------- views
let jv = (await client(jordan)).json
let tv = (await client(taylor)).json
check('client sees own name and partner', jv.me.name === 'Jordan Ellis' && jv.me.role === 'client' && jv.partner?.name === 'Taylor Ellis')
check('spouse sees own name and partner', tv.me.name === 'Taylor Ellis' && tv.me.role === 'spouse' && tv.partner?.name === 'Jordan Ellis')
const refused = await client(taylor, '/sign', post({ name1: 'Taylor Ellis', email1: 'taylor@example.com', name2: 'Jordan Ellis', email2: 'jordan@example.com', address: '1 A St', payOption: '100% at signing', read: true }))
check('spouse cannot start the signing', refused.status === 403, refused.status)
const early = await client(taylor, '/answers', post({ answers: { v: {}, props: [] }, part: 'about' }))
check('questionnaire locked until signed', early.status === 409, early.status)

// ---------------------------------------------------------------- signing
const sent = await client(jordan, '/sign', post({ name1: 'Jordan Ellis', email1: 'jordan@example.com', name2: 'Taylor Ellis', email2: 'taylor@example.com', address: '1234 Example Ave, St. Louis, MO 63104', payOption: '100% at signing', read: true }))
check('client sent agreements for signature', sent.status === 200 && sent.json.status === 'signing', JSON.stringify(sent.json).slice(0, 160))
st = await mock('/__mock/state')
check('unsigned PDF is under the engagement folder', st.files.some(([p]) => /^MIS Clients\/Estate Planning - Jordan and Taylor Ellis \([0-9a-f]{6}\)\/Agreements\/Engagement Agreement and NDA - unsigned\.pdf$/.test(p)), st.files.map((f) => f[0]).join(' | '))
const before = st.emails.length
await mock('/__mock/sign-all')
st = await mock('/__mock/state')
const signedMails = st.emails.slice(before).filter((e) => /signed/i.test(e.subject ?? ''))
check('signed emails go to admin, client and spouse', signedMails.length === 3 && ['admin@example.com', 'jordan@example.com', 'taylor@example.com'].every((a) => signedMails.some((m) => (Array.isArray(m.to) ? m.to : [m.to]).includes(a))), signedMails.map((m) => m.to).join(' '))
const spouseMail = signedMails.find((m) => (Array.isArray(m.to) ? m.to : [m.to]).includes('taylor@example.com'))
check('spouse email carries the spouse link, not the client link', spouseMail?.html.includes(taylor) && !spouseMail.html.includes(jordan))
check('signed email lists who signed', /Jordan Ellis/.test(spouseMail?.html ?? '') && /Midwest Investor Services/.test(spouseMail?.html ?? ''))
const root = st.files.map((f) => f[0]).find((p) => p.endsWith('Agreements/Engagement Agreement and NDA - signed.pdf')).replace(/\/Agreements\/.*$/, '')
check('signed PDF saved', Boolean(root), root)
check('signing certificate saved next to the signed PDF', st.files.some(([p, n]) => p === `${root}/Agreements/Signing Certificate.pdf` && n > 800))
const cert = await client(jordan, '/signed?doc=certificate')
check('client can download the certificate', cert.status === 200 && cert.buf?.subarray(0, 5).toString() === '%PDF-', cert.status)
const cert2 = await client(taylor, '/signed?doc=certificate')
check('spouse can download the certificate', cert2.status === 200 && cert2.buf?.subarray(0, 5).toString() === '%PDF-', cert2.status)
jv = (await client(jordan)).json
tv = (await client(taylor)).json
check('signed view lists every signer with a time', jv.status === 'signed' && jv.signers_done.length === 3 && jv.signers_done.every((s) => s.signed_at), JSON.stringify(jv.signers_done))
check('both people unlocked', tv.status === 'signed')

// ---------------------------------------------------------------- each person answers and uploads
check('spouse questionnaire starts with their own details', tv.answers.v['p1.name'] === 'Taylor Ellis' && tv.answers.v['p1.email'] === 'taylor@example.com', JSON.stringify(tv.answers.v))
const taylorAnswers = { v: { 'p1.name': 'Taylor Ellis', 'p1.email': 'taylor@example.com', 'goal.worry': 'Probate for the kids.', 'wrap.confirm': true, 'wrap.name': 'Taylor Ellis' }, props: [] }
const jordanAnswers = { v: { 'p1.name': 'Jordan Ellis', 'p1.email': 'jordan@example.com', 'goal.worry': 'A tenant lawsuit.', 'wrap.confirm': true, 'wrap.name': 'Jordan Ellis' }, props: [] }
check('spouse saves a draft', (await client(taylor, '/answers', post({ answers: taylorAnswers, part: 'goals' }))).status === 200)
st = await mock('/__mock/state')
check('spouse draft is in the spouse folder', st.files.some(([p]) => p === `${root}/Taylor Ellis/Questionnaire/answers.json`), st.files.map((f) => f[0]).join(' | '))
jv = (await client(jordan)).json
check("client cannot see the spouse's answers", jv.answers.v['goal.worry'] === undefined && jv.answers.v['p1.name'] === 'Jordan Ellis')

const pdfFile = Buffer.concat([Buffer.from('%PDF-1.4 test\n'), Buffer.alloc(2000, 120)])
async function upload(token, doc, name) {
  const qs = new URLSearchParams({ doc, name, upload: crypto.randomUUID(), index: '1', total: '1', size: String(pdfFile.length) })
  const res = await fetch(`${SITE}/api/onboarding/${token}/upload?${qs}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: pdfFile })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}
check('spouse uploads their own tax return', (await upload(taylor, 'tax', 'taylor-taxes.pdf')).status === 200)
check('client uploads their own tax return', (await upload(jordan, 'tax', 'jordan-taxes.pdf')).status === 200)
st = await mock('/__mock/state')
check('uploads land in each person\'s own Documents folder',
  st.files.some(([p]) => p === `${root}/Taylor Ellis/Documents/Personal and tax/taylor-taxes.pdf`) && st.files.some(([p]) => p === `${root}/Jordan Ellis/Documents/Personal and tax/jordan-taxes.pdf`),
  st.files.map((f) => f[0]).filter((p) => p.includes('Documents')).join(' | '))
check('nothing is uploaded straight into the engagement folder', !st.files.some(([p]) => p.startsWith(`${root}/Documents`) || p.startsWith(`${root}/Questionnaire`)))

// ---------------------------------------------------------------- submit
const ts = await client(taylor, '/submit', post({ answers: taylorAnswers }))
check('spouse submitted', ts.status === 200 && ts.json.status === 'submitted', ts.status + ' ' + JSON.stringify(ts.json).slice(0, 120))
st = await mock('/__mock/state')
let eng = st.db.onboarding_engagements.find((e) => e.id === id)
check('engagement stays open until the client submits too', eng.status === 'signed', eng.status)
const pdfPath = (who) => `${root}/${who}/Questionnaire/Questionnaire and Document Checklist.pdf`
const taylorPdf = st.files.find(([p]) => p === pdfPath('Taylor Ellis'))
check("spouse's questionnaire + checklist PDF saved", taylorPdf && taylorPdf[1] > 1500, taylorPdf?.[1])
const waiting = st.emails.filter((e) => /questionnaire submitted/i.test(e.subject ?? '')).pop()
check('admin email says who is still waiting', /Still waiting on: Jordan Ellis/.test(waiting?.html ?? ''), waiting?.html?.slice(0, 200))
const again = await client(taylor, '/answers', post({ answers: taylorAnswers, part: 'goals' }))
check('a submitted questionnaire is locked', again.status === 409)

const tv2 = (await client(taylor)).json
const jv2 = (await client(jordan)).json
check("spouse view says submitted, client view still signed", tv2.status === 'submitted' && jv2.status === 'signed', `${tv2.status}/${jv2.status}`)

const js = await client(jordan, '/submit', post({ answers: jordanAnswers }))
check('client submitted', js.status === 200)
st = await mock('/__mock/state')
eng = st.db.onboarding_engagements.find((e) => e.id === id)
check('engagement becomes submitted once everyone has', eng.status === 'submitted', eng.status)
check('engagement totals add up both people', eng.docs_done === 2 && eng.docs_total === 12, `${eng.docs_done}/${eng.docs_total}`)

// ---------------------------------------------------------------- checklist PDF follows later uploads
const sizeBefore = st.files.find(([p]) => p === pdfPath('Jordan Ellis'))[1]
const more = await upload(jordan, 'stmts', 'statements.pdf')
const na = await client(jordan, '/docs', post({ doc: 'benef', na: true }))
st = await mock('/__mock/state')
const sizeAfter = st.files.find(([p]) => p === pdfPath('Jordan Ellis'))[1]
check('later uploads and not-applicable marks update the PDF', more.status === 200 && na.status === 200 && sizeAfter !== sizeBefore, `${sizeBefore} -> ${sizeAfter}`)
const pdfRaw = await (await fetch(`${MOCK}/__mock/file?path=${encodeURIComponent(pdfPath('Jordan Ellis'))}`)).arrayBuffer()
check('checklist PDF is a PDF', Buffer.from(pdfRaw).subarray(0, 5).toString() === '%PDF-')
const rebuilt = await admin(`/api/admin/onboarding/${id}`, { action: 'rebuild-pdf', person: 'spouse' })
check('admin can rebuild a PDF', rebuilt.status === 200, JSON.stringify(rebuilt.json))

// ---------------------------------------------------------------- other
const bad = await fetch(`${SITE}/api/onboarding/${taylor.slice(0, -2)}xx`)
check('wrong spouse token is rejected', bad.status === 404)
const list = await fetch(`${SITE}/admin/onboarding`, { headers: { cookie: ADMIN_COOKIE } })
const html = await list.text()
check('admin list shows both submitted', list.status === 200 && /All\s*(<!-- -->)?\s*2(<!-- -->)?\s*submitted/.test(html))
const detail = await fetch(`${SITE}/admin/onboarding/${id}`, { headers: { cookie: ADMIN_COOKIE } })
const dhtml = await detail.text()
check('admin detail shows both people and the signing confirmation', detail.status === 200 && dhtml.includes('Taylor Ellis') && dhtml.includes('Signing confirmation'))

const failed = results.filter((r) => !r[1])
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
