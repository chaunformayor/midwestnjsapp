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

// ---------------------------------------------------------------- review: weighted scores, AI recommendations, client PDF
async function onboard(first, last, mk) {
  const made2 = await admin('/api/admin/onboarding', {
    client_name: `${first} ${last}`, client_email: `${first.toLowerCase()}@example.com`, spouse_name: `Sam ${last}`, spouse_email: `sam.${last.toLowerCase()}@example.com`,
    engagement_type: 'estate', focus: 'protecting assets', modules: ['finances', 'estate'], fees, pay_methods: ['Check'], send_email: false,
  })
  const t1 = tokenOf(made2.json.link)
  const t2 = tokenOf((await admin(`/api/admin/onboarding/${made2.json.id}`, { action: 'link', person: 'spouse' })).json.link)
  await client(t1, '/sign', post({ name1: `${first} ${last}`, email1: `${first.toLowerCase()}@example.com`, name2: `Sam ${last}`, email2: `sam.${last.toLowerCase()}@example.com`, address: '9 Test Ln, St. Louis, MO 63101', payOption: '100% at signing', read: true }))
  await mock('/__mock/sign-all')
  const a1 = mk('client', `${first} ${last}`)
  const a2 = mk('spouse', `Sam ${last}`)
  const s1 = await client(t1, '/submit', post({ answers: a1 }))
  const s2 = await client(t2, '/submit', post({ answers: a2 }))
  return { id: made2.json.id, ok: s1.status === 200 && s2.status === 200, detail: `${s1.status}/${s2.status} ${JSON.stringify(s1.json).slice(0, 100)}` }
}

const rich = (who, name) => {
  const v = {
    'p1.name': name, 'p1.email': `${name.split(' ')[0].toLowerCase()}@example.com`, 'wrap.confirm': true, 'wrap.name': name,
    'prop.p1.address': '500 Sample Pl #4B, St. Louis, MO 63101', 'prop.p1.ptype': 'Condo', 'prop.p1.use': 'Short-term rental', 'prop.p1.occ': 'Owner',
    'prop.p1.value': '240,000', 'prop.p1.balance': '210,000', 'prop.p1.insurer': '', 'str.p1.told': 'No', 'str.p1.permit': 'No',
  }
  if (who === 'client') Object.assign(v, { 'prop.p1.title': 'Sole name', 'goal.protect': 'High', 'est.will.have': 'No', 'fin.claims': 'Yes', 'fin.claimsDetail': 'A tenant lawsuit in 2024.' })
  else Object.assign(v, { 'prop.p1.title': 'Joint with spouse', 'goal.protect': 'Low', 'est.will.have': 'Yes' })
  return { v, props: ['p1'] }
}
const hh = await onboard('Riley', 'Marsh', rich)
check('second household submitted with a property each', hh.ok, hh.detail)

const noKey = await fetch(`${SITE}/api/admin/onboarding/${hh.id}/review`, { method: 'POST' })
check('review needs an admin', noKey.status === 401, noKey.status)
const w0 = await fetch(`${SITE}/api/admin/onboarding/weights`)
check('weights need an admin', w0.status === 401)

const ran = await admin(`/api/admin/onboarding/${hh.id}/review`, {})
const rv = ran.json.review
check('review runs', ran.status === 200 && rv?.review?.priorities?.length === 2, ran.status + ' ' + JSON.stringify(ran.json).slice(0, 200))
const row = (key) => rv.scores.rows.find((r) => r.key === key)
check('liability scores high for a personally held short-term rental with a claim', row('liability').household >= 60, row('liability').household)
check('the most cautious person sets the household score', row('liability').household === Math.max(...row('liability').people.map((p) => p.score)))
check('the two people are scored separately', row('liability').people.length === 2 && row('liability').people[0].score !== row('liability').people[1].score, JSON.stringify(row('liability').people))
check("client's High goal raises the weight, so the factor is above 1", row('liability').goalFactor === 1.5, row('liability').goalFactor)
check('priority is household x weight x goal factor', Math.abs(row('liability').priority - row('liability').household * row('liability').weight * row('liability').goalFactor) < 0.2, row('liability').priority)
check('answers that differ between spouses are flagged', rv.scores.discrepancies.some((d) => /how title is held/.test(d)) && rv.scores.discrepancies.some((d) => /Goal "Protect/.test(d)), rv.scores.discrepancies.join(' | ').slice(0, 300))
check('rows are ranked by priority', rv.scores.rows.every((r, i, a) => i === 0 || a[i - 1].priority >= r.priority))
check('default weights stored with the review', rv.weights.liability === 5)

st = await mock('/__mock/state')
const call = st.anthropic.at(-1)
const promptJson = JSON.stringify(call.body)
check('Claude call uses the default model, fallbacks and a structured format', call.body.model === 'claude-opus-5-5' && call.body.fallbacks === 'default' && /server-side-fallback/.test(call.headers.beta ?? '') && Boolean(call.body.output_config?.format), JSON.stringify({ m: call.body.model, f: call.body.fallbacks, b: call.headers.beta }))
check('prompt carries the answers and scores', /Sole name/.test(promptJson) && /Liability exposure/.test(promptJson) && /Joint with spouse/.test(promptJson))
check('contact details are left out of the prompt', !/riley@example\.com|sam\.marsh@example\.com/.test(promptJson))

// weights change the ranking
await admin('/api/admin/onboarding/weights', { weights: { liability: 0, estate: 5 } }, 'PUT')
const second = (await admin(`/api/admin/onboarding/${hh.id}/review`, {})).json.review
const row2 = (key) => second.scores.rows.find((r) => r.key === key)
check('a weight of 0 switches an area off', row2('liability').weight === 0 && row2('liability').priority === 0)
check('the new weight is used and saved with that review', second.weights.liability === 0 && second.weights.estate === 5)
check('latest review is the one shown', second.id !== rv.id)
await admin('/api/admin/onboarding/weights', { weights: {} }, 'PUT')
const back = await fetch(`${SITE}/api/admin/onboarding/weights`, { headers: { cookie: ADMIN_COOKIE } })
check('weights reset to the starting values', (await back.json()).weights.liability === 5)

// choose what the client sees, edit wording, make the PDF
const pick = await admin(`/api/admin/onboarding/${hh.id}/review`, { review_id: second.id, included: ['r1'], edits: { r1: 'Edited client wording.' } }, 'PUT')
check('selections and edited wording are saved', pick.status === 200 && pick.json.review.included.join() === 'r1' && pick.json.review.review.priorities[0].client_text === 'Edited client wording.', JSON.stringify(pick.json).slice(0, 160))
const pdfRes = await fetch(`${SITE}/api/admin/onboarding/${hh.id}/review/pdf`, { method: 'POST', headers: { cookie: ADMIN_COOKIE } })
const pdfBuf = Buffer.from(await pdfRes.arrayBuffer())
check('client PDF is created', pdfRes.status === 200 && pdfBuf.subarray(0, 5).toString() === '%PDF-' && pdfBuf.length > 1500, pdfRes.status)
st = await mock('/__mock/state')
check('client PDF is saved under Review in the engagement folder', st.files.some(([p]) => /Review\/Recommendations for the client\.pdf$/.test(p)))
const dl = await fetch(`${SITE}/api/admin/onboarding/${hh.id}/review/pdf`, { headers: { cookie: ADMIN_COOKIE } })
check('admin can download the saved client PDF', dl.status === 200)
const none = await admin(`/api/admin/onboarding/${hh.id}/review`, { review_id: second.id, included: [], edits: {} }, 'PUT')
const emptyPdf = await fetch(`${SITE}/api/admin/onboarding/${hh.id}/review/pdf`, { method: 'POST', headers: { cookie: ADMIN_COOKIE } })
check('a client PDF needs at least one selected recommendation', none.status === 200 && emptyPdf.status === 400, emptyPdf.status)
const earlyRun = await admin(`/api/admin/onboarding/${id}/review`, {})
check('first household (no property answers) still reviews', earlyRun.status === 200, earlyRun.status)
const detail2 = await (await fetch(`${SITE}/admin/onboarding/${hh.id}`, { headers: { cookie: ADMIN_COOKIE } })).text()
check('admin page shows the review', /Review and recommendations/.test(detail2) && /Weighted scores/.test(detail2) && /Move the condo into an LLC/.test(detail2))
const wpage = await (await fetch(`${SITE}/admin/onboarding/weights`, { headers: { cookie: ADMIN_COOKIE } })).text()
check('weights page loads', /Review weights/.test(wpage) && /Liability exposure/.test(wpage))

const failed = results.filter((r) => !r[1])
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
