# Midwest Investor Services website

Next.js site for Midwest Investor Services (MIS): public pages, an investor portal, an admin area, and **client onboarding** (agreements signed through Nextcloud LibreSign, an intake questionnaire, and document uploads stored in Nextcloud).

The owner is not a developer. Explain changes in plain language, test before saying something works, and keep the site's tone (navy `#0D1B2A`, gold `#C9A84C`, Playfair headings, Inter body).

## Ground rules

- **This GitHub repo is public.** Never commit secrets, API keys, app passwords, or any client's personal details. Secrets live only in Vercel environment variables.
- If someone pastes a secret into the chat, tell them to revoke it and make a new one, and never repeat or reuse the pasted value.
- Work on a branch, not `main`. Onboarding work is on `onboarding`; Vercel builds a preview for every push.
- Run the onboarding test (below) and `npx tsc --noEmit` before pushing changes that touch onboarding.

## Stack

- Next.js 16 (App Router, Turbopack; middleware is `proxy.ts`; route `params` are Promises), React 19, Tailwind 3, lucide-react icons
- Supabase: Postgres + auth. `profiles.role` is `admin`, `investor`, or `pending`; there is **no** `status` column.
- Hosted on Vercel (Hobby). Request bodies are capped at 4.5 MB. Runtime logs are kept for 1 hour. Preview deployments are behind Vercel login.
- Email: `lib/ses.ts` sends through SMTP when `SMTP_HOST` is set (currently Resend), otherwise Amazon SES. SES is still in sandbox, so it can only send to verified addresses.
- PDFs: `pdfkit` (listed in `serverExternalPackages` in `next.config.ts`)

Commands: `npm run dev`, `npm run build`, `npx tsc --noEmit`, `tests/onboarding-e2e/run.sh`

## Client onboarding

Flow: admin creates a client with that client's fees → the site emails a private link → client reviews the Engagement Agreement and NDA, enters their address, and clicks **Send me the signing link** → LibreSign emails each signer → client and spouse sign (order 1), then MIS countersigns from its Nextcloud account (order 2) → LibreSign calls back → the site saves the signed PDF and emails both sides → client fills in the questionnaire → uploads documents.

### Files

| Path | What it is |
|---|---|
| `supabase/migrations/004_onboarding.sql` | `onboarding_engagements` and `onboarding_settings` tables, admin-only access rules (already run in Supabase) |
| `lib/onboarding/config.ts` | Engagement types, questionnaire sections, fee fields, payment options, status labels, MIS contact info |
| `lib/onboarding/agreements.ts` | Full agreement and NDA text. One source feeds both the web view and the PDF. |
| `lib/onboarding/questionnaire.ts` | Questionnaire definition, per-property follow-up sections, validation, document checklist |
| `lib/onboarding/pdf.ts` | Agreement and questionnaire PDFs |
| `lib/onboarding/server.ts` | Link tokens (hash plus encrypted copy), callback signatures, site URL and preview bypass, database access, Nextcloud paths |
| `lib/onboarding/service.ts` | The workflow: create, invite, start signing, refresh signing, resend signing email, answers, submit, uploads |
| `lib/nextcloud.ts` | WebDAV (folders, files, chunked upload) and the LibreSign API |
| `app/onboarding/[token]/` and `components/onboarding/ClientApp.tsx` | Client pages |
| `app/(admin)/admin/onboarding/` and `components/onboarding/*` | Admin tracker, new-client form, client detail and actions |
| `app/api/onboarding/[token]/*` | Client APIs: view, sign, remind, signed (PDF), answers, submit, docs, upload |
| `app/api/onboarding/libresign-callback` | LibreSign's "signed" notice (checked by HMAC, then re-checked with LibreSign) |
| `app/api/admin/onboarding/*` | Admin APIs: create, settings, and per-client actions (resend, new-link, refresh, remind, reset-signing, cancel, link) |

Client files are stored in Nextcloud under the website's account: `MIS Clients/<Name> (<id6>)/Agreements|Questionnaire|Documents`.

### LibreSign facts learned the hard way

- LibreSign **never returns a signer's own link (`sign_request_uuid`) to the account that sent the request**. Clients can only get their link from LibreSign's email. That's why the page shows "Link sent to <email>" plus a **Send the signing email again** button (`POST /ocs/v2.php/apps/libresign/api/v1/notify/signer` with `fileId` and `signRequestId`).
- LibreSign's emails go out through **Nextcloud's own mail settings**, not the website's. Nextcloud now sends through Resend SMTP. It used to send through SES, whose sandbox silently blocked signing emails.
- Signers come back with `identifyMethods` (`email` for clients, `account` for MIS). An account signer also reports that account's email, which can match a client's email during testing. Treat email-identified signers as clients.
- Partly signed files can also list signatures read from the PDF itself, which have no `signRequestId`; ignore those. "Signed" is the `signed` date, or `status === 2` on newer versions.
- File status: 0 draft, 1 ready, 2 partly signed, 3 signed, 4 deleted, 5 in progress, 6 canceled. The page polls every 8 seconds while waiting. The callback only fires when everyone has signed.
- Admin **Check LibreSign now** logs LibreSign's response shape (`onboarding: LibreSign status`) and shows each signer's state.

### Environment variables (Vercel)

Existing: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAIL`, `DEALS_EMAIL`, `RESEND_API_KEY`, `AWS_SES_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

Onboarding:
- `NEXTCLOUD_URL`, `NEXTCLOUD_USER`, `NEXTCLOUD_APP_PASSWORD`: the website's Nextcloud account
- `MIS_SIGNER_ACCOUNT`: the owner's Nextcloud username, for the MIS countersignature
- `ONBOARDING_FOLDER`: optional; default `MIS Clients`
- `ONBOARDING_SECRET`: recommended; must not change once clients have links

Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. For Resend: `smtp.resend.com`, `465`, `resend`, an API key, and `Name <address@midwestinvestorservices.com>`.

Preview only: `VERCEL_AUTOMATION_BYPASS_SECRET` is set automatically and added to client links on previews.

These are set for **Preview** only so far. Add them to **Production** before merging.

### Testing

`tests/onboarding-e2e/run.sh` builds the site, starts stand-ins for Supabase, Nextcloud/LibreSign, SES and SMTP (`mock.mjs`, `smtp-sink.mjs`), and drives a real browser through the whole flow (`run_e2e.py`, 43 checks). Screenshots land in `tests/onboarding-e2e/out/`. The mock copies real LibreSign behavior listed above; keep it in step when LibreSign behavior changes. Needs Python Playwright with Chromium.

For the live preview, read Vercel runtime logs within an hour of the problem.

## Status (October 14, 2026)

- Full flow tested live on the preview up to the signing step. Invite email, LibreSign emails and partial signing all work.
- Not yet tested live: MIS countersign → "Agreements signed" → questionnaire → uploads → files in Nextcloud.
- Before go-live:
  1. Add the env vars to Production and set `ONBOARDING_SECRET`.
  2. Decide on email: keep Resend, or get SES production access.
  3. Delete or fix the `SMTP_FROM` value in Vercel. It currently has no address in it, so the site falls back to `info@midwestinvestorservices.com`.
  4. Have an attorney review the agreement text.
  5. Merge `onboarding` into `main`. That also ships two fixes: `approve-investor` now requires admin, and admins land on `/admin` after login.
  6. Consider making the repo private.
