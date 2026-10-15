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

Flow: admin creates a client with that client's fees → the site emails the main client a private link → client reviews the Engagement Agreement and NDA, enters their address, and clicks **Send me the signing link** → LibreSign emails each signer → client and spouse sign (order 1), then MIS countersigns from its Nextcloud account (order 2) → LibreSign calls back → the site saves the signed PDF and a **Signing Certificate**, and emails admin, client and spouse (each with their own link) → **each person** fills in their own questionnaire and uploads their own documents.

**People:** the agreements are signed once per household, but every person has their own row in `onboarding_people`, their own link, answers, documents and folder. The main client's link is the engagement's own token (existing links keep working); the spouse gets a separate token. Rows for older engagements are created the first time they are opened. The engagement becomes `submitted` only when every person has submitted; a person's page shows `submitted` as soon as they have.

### Files

| Path | What it is |
|---|---|
| `supabase/migrations/004_onboarding.sql` | `onboarding_engagements` and `onboarding_settings` tables, admin-only access rules (already run in Supabase) |
| `supabase/migrations/005_onboarding_people.sql` | `onboarding_people`: one row per person with their own link, folder and progress. **Run in the Supabase SQL editor before deploying.** |
| `lib/onboarding/config.ts` | Engagement types, questionnaire sections, fee fields, payment options, status labels, MIS contact info |
| `lib/onboarding/agreements.ts` | Full agreement and NDA text. One source feeds both the web view and the PDF. |
| `lib/onboarding/questionnaire.ts` | Questionnaire definition, per-property follow-up sections, validation, document checklist |
| `lib/onboarding/pdf.ts` | Agreement PDF, the per-person Questionnaire and Document Checklist PDF, the Signing Certificate, and the client-facing recommendations PDF |
| `supabase/migrations/006_onboarding_reviews.sql` | Review weights column and the `onboarding_reviews` table. **Run in Supabase before using the review.** |
| `lib/onboarding/review/*` | Scoring, weights, the Claude call, and saving/PDF for reviews |
| `lib/onboarding/server.ts` | Link tokens (hash plus encrypted copy), callback signatures, site URL and preview bypass, database access, Nextcloud paths |
| `lib/onboarding/service.ts` | The workflow: create, invite, start signing, refresh signing, resend signing email, answers, submit, uploads |
| `lib/nextcloud.ts` | WebDAV (folders, files, chunked upload) and the LibreSign API |
| `app/onboarding/[token]/` and `components/onboarding/ClientApp.tsx` | Client pages |
| `app/(admin)/admin/onboarding/` and `components/onboarding/*` | Admin tracker, new-client form, client detail and actions |
| `app/api/onboarding/[token]/*` | Client APIs: view, sign, remind, signed (PDF), answers, submit, docs, upload |
| `app/api/onboarding/libresign-callback` | LibreSign's "signed" notice (checked by HMAC, then re-checked with LibreSign) |
| `app/api/admin/onboarding/*` | Admin APIs: create, settings, and per-client actions (resend, new-link, refresh, remind, reset-signing, cancel, link) |

Client files are stored in Nextcloud under the website's account:

```
MIS Clients/<Engagement type> - <Household> (<id6>)/       e.g. Estate Planning - John and Jane Smith (a1b2c3)
  Agreements/                  unsigned PDF, signed PDF, Signing Certificate.pdf (shared)
  <Person name>/               one folder per person
    Questionnaire/             answers.json, Questionnaire and Document Checklist.pdf
    Documents/<group>/...      their uploads, plus checklist.json
```

The PDF is built on submit and rebuilt after every later upload or not-applicable mark. Older engagements keep their old single folder for the main client.

### Review and recommendations

An admin button on each client's page ("Run review") scores the submitted answers, then asks Claude for recommendations. Nothing runs automatically and nothing reaches the client unless the admin makes the client PDF.

- **Scoring** (`lib/onboarding/review/scoring.ts`, pure functions): seven areas (liability, asset-protection structure, insurance, estate readiness, debt and leverage, compliance, information completeness), each 0-100 per person where higher means more needs attention. The household score is the higher of the two people's. **Priority = household score × admin weight (0-5) × goal factor**; the goal factor is 1.5 / 1 / 0.6 from how High / Medium / Low the client rated the related goals. Answers that differ between spouses are listed as discrepancies.
- **Weights** are set at `/admin/onboarding/weights` (stored in `onboarding_settings.review_weights`); starting values and descriptions live in `lib/onboarding/review/config.ts`. Each review stores the weights it used.
- **AI step** (`lib/onboarding/review/ai.ts`): `@anthropic-ai/sdk`, model `claude-opus-5-5` (override with `ANTHROPIC_REVIEW_MODEL`), structured output (zod v4 schema), server-side `fallbacks: 'default'`. Needs `ANTHROPIC_API_KEY` in Vercel. **Client answers are sent to the Anthropic API** minus email, phone, date of birth, advisor contact details and the typed confirmation name.
- **Results** are saved in `onboarding_reviews` (migration 006). The admin ticks which recommendations to share, can edit the client wording, and "Create client PDF" saves `Review/Recommendations for the client.pdf` in the engagement folder (no scores or internal notes) and downloads it.
- The route that runs a review has `maxDuration = 300`.

### Signing confirmation

LibreSign puts digital signatures in the PDF but not necessarily a visible stamp. The site therefore also saves `Agreements/Signing Certificate.pdf` (signers, times, LibreSign file id, SHA-256 of the signed PDF, verification link), shows the signers and times on the client's "Agreements signed" panel and the admin page, and includes them in the signed emails. The verification link is LibreSign's public page `/apps/libresign/validation/<uuid>`, the same address LibreSign prints in the footer. LibreSign already stamps a footer (QR code, "Digitally signed by LibreSign", validation link) on the signed PDF by default; it is controlled by Nextcloud's LibreSign settings (`add_footer`, `write_qrcode_on_footer`, `validation_site`), not by the site.

### LibreSign facts learned the hard way

- LibreSign **never returns a signer's own link (`sign_request_uuid`) to the account that sent the request**. Clients can only get their link from LibreSign's email. That's why the page shows "Link sent to <email>" plus a **Send the signing email again** button (`POST /ocs/v2.php/apps/libresign/api/v1/notify/signer` with `fileId` and `signRequestId`).
- LibreSign's emails go out through **Nextcloud's own mail settings**, not the website's. Nextcloud now sends through Resend SMTP. It used to send through SES, whose sandbox silently blocked signing emails.
- Signers come back with `identifyMethods` (`email` for clients, `account` for MIS). An account signer also reports that account's email, which can match a client's email during testing. Treat email-identified signers as clients.
- Partly signed files can also list signatures read from the PDF itself, which have no `signRequestId`; ignore those. "Signed" is the `signed` date, or `status === 2` on newer versions.
- File status: 0 draft, 1 ready, 2 partly signed, 3 signed, 4 deleted, 5 in progress, 6 canceled. The page polls every 8 seconds while waiting. The callback only fires when everyone has signed.
- Admin **Check LibreSign now** logs LibreSign's response shape (`onboarding: LibreSign status`) and shows each signer's state.

### Environment variables (Vercel)

Review: `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_REVIEW_MODEL`)

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
- Per-person questionnaires and documents, the new folder layout, the combined PDF and the signing certificate are built and pass `E2E_RUNNER=node tests/onboarding-e2e/run.sh`; not yet tried live.
- Not yet tested live: MIS countersign → "Agreements signed" → questionnaire → uploads → files in Nextcloud.
- Before go-live:
  0. Run `supabase/migrations/005_onboarding_people.sql` in Supabase.
  1. Add the env vars to Production and set `ONBOARDING_SECRET`.
  2. Decide on email: keep Resend, or get SES production access.
  3. Delete or fix the `SMTP_FROM` value in Vercel. It currently has no address in it, so the site falls back to `info@midwestinvestorservices.com`.
  4. Have an attorney review the agreement text.
  5. Merge `onboarding` into `main`. That also ships two fixes: `approve-investor` now requires admin, and admins land on `/admin` after login.
  6. Consider making the repo private.
