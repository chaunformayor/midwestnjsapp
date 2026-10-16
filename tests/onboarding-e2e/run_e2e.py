"""End-to-end browser test of client onboarding. Run it through run.sh, which
builds the site and starts the local stand-in services first."""
import base64, json, os, sys, time, urllib.request
from playwright.sync_api import sync_playwright, expect

SITE = 'http://127.0.0.1:3000'
MOCK = 'http://127.0.0.1:8899'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
ACCESS = sys.argv[1]
results = []

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail else ''), flush=True)

def mock(path):
    with urllib.request.urlopen(MOCK + path) as r:
        return json.loads(r.read())

def b64url(s):
    return base64.urlsafe_b64encode(s.encode()).decode().rstrip('=')

session = {'access_token': ACCESS, 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': 4102444800, 'refresh_token': 'refresh-test',
           'user': {'id': 'admin-1', 'aud': 'authenticated', 'role': 'authenticated', 'email': 'admin@example.com', 'app_metadata': {}, 'user_metadata': {}}}

with sync_playwright() as p:
    b = p.chromium.launch()
    errors = []
    admin = b.new_context(viewport={'width': 1280, 'height': 900})
    admin.add_cookies([{'name': 'sb-127-auth-token', 'value': 'base64-' + b64url(json.dumps(session)), 'domain': '127.0.0.1', 'path': '/'}])
    a = admin.new_page()
    a.on('pageerror', lambda e: errors.append('admin: ' + str(e)))

    # ---------------- admin: list + new client
    a.goto(SITE + '/admin/onboarding')
    check('admin list loads for admin', a.get_by_role('heading', name='Client Onboarding').is_visible())
    a.screenshot(path=f'{OUT}/01-admin-list-empty.png')
    a.goto(SITE + '/admin/onboarding/new')
    a.get_by_label('Client full name').fill('Jordan Ellis')
    a.get_by_label('Client email').fill('jordan@example.com')
    a.get_by_label('Spouse or co-owner name').fill('Taylor Ellis')
    a.get_by_label('Spouse or co-owner email').fill('taylor@example.com')
    # try creating before fees -> should show errors
    a.get_by_role('button', name='Create client link').click()
    check('create blocked until fees filled', a.get_by_role('alert').first.is_visible())
    fees = {'Phase 1 flat fee': '2,500', 'Strategy meeting length (hours)': '2', 'Report delivered within (business days)': '10', 'Phase 2 hourly rate': '175',
            'Meetings beyond Phase 1 (per hour)': '175', 'Phase 2 retainer': '1,000', 'Phase 2 cap without client approval': '3,500',
            'Kept if client cancels before the meeting': '500', 'Bill travel over (miles)': '50', 'Single expenses over this need approval': '100'}
    for k, v in fees.items():
        a.get_by_label(k).fill(v)
    a.get_by_text('Check', exact=True).click()
    a.get_by_text('ACH bank transfer', exact=True).click()
    a.get_by_label('Entity type').fill('limited liability company')
    a.get_by_label('Principal office address').fill('100 Example Blvd, St. Louis, MO 63101')
    a.get_by_label('Signer title').fill('Managing Member')
    a.get_by_role('button', name='Save business details').click()
    a.get_by_text('Saved').wait_for()
    a.screenshot(path=f'{OUT}/02-admin-new.png', full_page=True)
    a.get_by_role('button', name='Create client link').click()
    a.wait_for_url('**/admin/onboarding/*?created=1*', timeout=15000)
    check('link created and emailed', a.get_by_text('emailed to jordan@example.com').is_visible())
    link = a.locator('#client-link').input_value()
    check('client link shown', '/onboarding/' in link, link)
    a.screenshot(path=f'{OUT}/03-admin-detail-new.png', full_page=True)
    st = mock('/__mock/state')
    invite = [e for e in st['emails'] if 'onboarding link' in (e['subject'] or '')]
    check('invite email sent with link', invite and link in invite[0]['html'], invite[0]['to'] if invite else '')

    # ---------------- client: welcome + agreements
    client = b.new_context(viewport={'width': 1280, 'height': 900})
    c = client.new_page()
    c.on('pageerror', lambda e: errors.append('client: ' + str(e)))
    c.goto(link)
    check('client page loads', c.get_by_role('heading', name='Welcome, Jordan Ellis').is_visible())
    c.screenshot(path=f'{OUT}/04-client-welcome.png', full_page=True)
    c.get_by_role('button', name='Start with the agreements').click()
    check('agreement shows fees', c.get_by_text('$2,500').first.is_visible())
    check('agreement shows MIS entity', c.get_by_text('limited liability company').first.is_visible())
    c.get_by_role('button', name='Send me the signing link').click()
    check('sign form validates', c.get_by_text('Enter your home address.').is_visible())
    c.get_by_label('Home address').fill('1234 Example Ave, St. Louis, MO 63104')
    c.get_by_text('50% at signing, 50% when the report is delivered').click()
    c.get_by_label('I have read both agreements.').check()
    c.screenshot(path=f'{OUT}/05-client-agreements.png', full_page=True)
    c.get_by_role('button', name='Send me the signing link').click()
    c.get_by_role('heading', name='Sign in LibreSign').wait_for(timeout=20000)
    check('signing panel lists both client emails', c.get_by_text('Link sent to jordan@example.com').is_visible() and c.get_by_text('Link sent to taylor@example.com').is_visible())
    check('MIS not shown as a client signer', c.get_by_text('Link sent to', exact=False).count() == 2, c.get_by_text('Link sent to', exact=False).count())
    check('no dead Sign now button', c.get_by_role('link', name='Sign now').count() == 0)
    c.screenshot(path=f'{OUT}/06-client-signing.png', full_page=True)
    c.get_by_role('button', name='Send the signing email again').click()
    c.get_by_text('Sent again to jordan@example.com and taylor@example.com', exact=False).wait_for(timeout=15000)
    st = mock('/__mock/state')
    ids = sorted(s['signRequestId'] for s in st['ls'][0]['signers'][:2])
    check('resend asked LibreSign to email both clients', sorted(n['signRequestId'] for n in st['notifies']) == ids, st['notifies'])
    c.screenshot(path=f'{OUT}/06b-client-resent.png', full_page=True)
    c.get_by_role('button', name='Send the signing email again').click()
    c.get_by_role('status').filter(has_text='was just sent').wait_for(timeout=10000)
    check('resend is rate limited', len(mock('/__mock/state')['notifies']) == 2)
    a.goto(a.url.split('?')[0])
    a.get_by_role('button', name='Resend signing email').click()
    a.get_by_role('alert').filter(has_text='just sent').wait_for(timeout=10000)
    check('admin resend button works (rate limited right after)', True)
    st = mock('/__mock/state')
    eng = st['db']['onboarding_engagements'][0]
    check('status signing', eng['status'] == 'signing')
    req = st['ls'][0]
    check('LibreSign got 3 signers, MIS last', [s['displayName'] for s in req['signers']] == ['Jordan Ellis', 'Taylor Ellis', 'Midwest Investor Services'] and req['signers'][2]['signingOrder'] == 2)
    check('unsigned PDF saved to Nextcloud', any(f[0].endswith('Engagement Agreement and NDA - unsigned.pdf') for f in st['files']))

    # ---------------- one client signs first (no callback until everyone signs)
    mock('/__mock/sign-one?i=0')
    c.locator('div', has_text='Jordan Ellis').get_by_text('Signed', exact=True).first.wait_for(timeout=20000)
    rows = c.get_by_text('Link sent to', exact=False).count()
    check('first signer shows Signed, second still waiting', rows == 1, rows)
    c.screenshot(path=f'{OUT}/06c-client-one-signed.png', full_page=True)
    a.goto(a.url.split('?')[0])
    a.get_by_role('button', name='Check LibreSign now').click()
    a.get_by_text('LibreSign says the document is', exact=False).wait_for(timeout=10000)
    msg = a.get_by_role('status').inner_text()
    check('admin check shows each signer', 'Jordan Ellis: signed' in msg and 'Taylor Ellis: not signed yet' in msg, msg)
    st = mock('/__mock/state')
    check('cert-only duplicate ignored', len(st['db']['onboarding_engagements'][0]['signers_status']) == 3, len(st['db']['onboarding_engagements'][0]['signers_status']))

    # ---------------- LibreSign signs and calls back
    r = mock('/__mock/sign-all')
    st = mock('/__mock/state')
    check('callback accepted', any('callback -> 200' in l for l in st['log']), [l for l in st['log'] if 'callback' in l])
    eng = st['db']['onboarding_engagements'][0]
    check('status signed after callback', eng['status'] == 'signed')
    check('signed PDF saved', any(f[0].endswith('- signed.pdf') for f in st['files']))
    signed_emails = [e['subject'] for e in st['emails'] if 'signed' in (e['subject'] or '').lower()]
    check('signed emails sent (admin + client + spouse)', len(signed_emails) == 3, signed_emails)
    check('signing certificate saved', any(f[0].endswith('Agreements/Signing Certificate.pdf') for f in st['files']))
    c.get_by_role('heading', name='Agreements signed').wait_for(timeout=15000)
    check('client page picked up signature', True)
    token = link.split('/onboarding/')[1].split('?')[0]
    r = client.request.get(f'{SITE}/api/onboarding/{token}/signed')
    check('client can download signed PDF', r.status == 200 and r.body()[:5] == b'%PDF-', r.status)
    r = client.request.get(f'{SITE}/api/onboarding/{token[:-2]}xx/signed')
    check('wrong token cannot download', r.status == 404, r.status)
    c.get_by_role('button', name='Continue to the questionnaire').click()

    # ---------------- questionnaire
    check('names prefilled', c.get_by_label('Full legal name').first.input_value() == 'Jordan Ellis')
    c.screenshot(path=f'{OUT}/07-q-about.png', full_page=True)
    c.get_by_role('button', name='Save and continue').click()
    c.get_by_role('heading', name='Goals and priorities').wait_for()
    c.locator('[id="f-goal-protect-0"]').check(force=True)
    c.get_by_label('What is your biggest worry about your properties or finances?').fill('A tenant lawsuit reaching our home.')
    c.get_by_role('button', name='Save and continue').click()
    c.get_by_role('heading', name='Your properties').wait_for()
    c.get_by_role('button', name='+ Add a property').click()
    c.get_by_role('button', name='Save and continue').click()
    check('property address required', c.get_by_text('Add an address for property 1.').is_visible())
    c.locator('[id="f-prop-p1-address"]').fill('500 Sample Pl #4B, St. Louis, MO 63101')
    c.locator('[id="f-prop-p1-ptype"]').select_option('Condo')
    c.locator('[id="f-prop-p1-use"]').select_option('Short-term rental')
    c.locator('[id="f-prop-p1-value"]').fill('240,000')
    c.screenshot(path=f'{OUT}/08-q-props.png', full_page=True)
    c.get_by_role('button', name='Save and continue').click()
    c.get_by_role('heading', name='Short-term rental: 500 Sample Pl #4B').wait_for()
    check('short-term rental part added', True)
    c.get_by_text('Airbnb', exact=True).click()
    for title in ['Other assets and finances', 'Existing estate plan', 'Your advisors', 'Review and submit']:
        c.get_by_role('button', name='Save and continue').click()
        c.get_by_role('heading', name=title).wait_for()
    st = mock('/__mock/state')
    check('draft answers saved to Nextcloud', any(f[0].endswith('Questionnaire/answers.json') for f in st['files']))
    c.get_by_role('button', name='Submit questionnaire').click()
    check('submit needs confirmation', c.get_by_text('Check the confirmation box.').is_visible())
    c.get_by_label('I confirm this information is accurate').check()
    c.get_by_label('Type your full name').fill('Jordan Ellis')
    c.get_by_role('button', name='Submit questionnaire').click()
    c.get_by_role('heading', name='Upload your documents').wait_for(timeout=20000)
    st = mock('/__mock/state')
    check('questionnaire PDF saved', any(f[0].endswith('Questionnaire/Questionnaire and Document Checklist.pdf') for f in st['files']))
    check('client marked submitted; engagement waits for the spouse', any(p['role'] == 'client' and p['submitted_at'] for p in st['db']['onboarding_people']) and st['db']['onboarding_engagements'][0]['status'] == 'signed')
    subs = [e['subject'] for e in st['emails'] if 'questionnaire submitted' in (e['subject'] or '').lower() or 'received your questionnaire' in (e['subject'] or '').lower()]
    check('submitted emails sent (admin + client)', len(subs) == 2, subs)

    # ---------------- documents
    small = os.path.join(OUT, 'deed.pdf')
    open(small, 'wb').write(b'%PDF-1.4 test deed\n' + b'x' * 2000)
    big = os.path.join(OUT, 'big-scan.pdf')
    open(big, 'wb').write(b'%PDF-1.4 big\n' + os.urandom(9 * 1024 * 1024))
    c.get_by_label('Upload: Recorded deed').set_input_files(small)
    c.get_by_text('deed.pdf').wait_for(timeout=20000)
    c.get_by_label('Upload: Closing (settlement) statement from the purchase').set_input_files(big)
    c.get_by_text('big-scan.pdf').wait_for(timeout=60000)
    c.get_by_role('button', name='Not applicable').first.click()
    time.sleep(1.5)
    st = mock('/__mock/state')
    bigf = [f for f in st['files'] if f[0].endswith('big-scan.pdf')]
    check('large file assembled from chunks', bigf and bigf[0][1] == os.path.getsize(big), bigf)
    check('small file saved', any(f[0].endswith('/deed.pdf') for f in st['files']))
    eng = st['db']['onboarding_engagements'][0]
    check('doc counts updated', eng['docs_done'] == 3 and eng['docs_total'] > 3, f"{eng['docs_done']} of {eng['docs_total']}")
    c.screenshot(path=f'{OUT}/09-client-docs.png', full_page=True)
    c.get_by_role('button', name='Finish', exact=True).last.click()
    c.get_by_role('heading', name="You're all set, Jordan").wait_for()
    c.screenshot(path=f'{OUT}/10-client-finish.png', full_page=True)

    # ---------------- reload keeps state
    c.goto(link)
    check('reload lands on documents step', c.get_by_role('heading', name='Upload your documents').is_visible())

    # ---------------- admin views progress
    a.goto(SITE + '/admin/onboarding')
    a.screenshot(path=f'{OUT}/11-admin-list.png', full_page=True)
    a.goto(SITE + f"/admin/onboarding/{eng['id']}")
    a.screenshot(path=f'{OUT}/12-admin-detail-done.png', full_page=True)
    check('admin detail shows submitted', a.get_by_text('Submitted', exact=True).first.is_visible())

    # ---------------- phone width
    m = b.new_context(viewport={'width': 390, 'height': 844})
    mp = m.new_page()
    mp.goto(link)
    sw = mp.evaluate('document.documentElement.scrollWidth')
    check('no sideways scroll on phone', sw <= 390, str(sw))
    mp.get_by_role('button', name='Questionnaire').first.click()
    mp.screenshot(path=f'{OUT}/13-phone-questionnaire.png', full_page=False)

    check('no page script errors', not errors, errors)
    b.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
