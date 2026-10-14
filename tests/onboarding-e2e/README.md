# Onboarding end-to-end test

Runs the whole client onboarding flow in a real browser against local stand-ins. No real services are contacted.

```bash
tests/onboarding-e2e/run.sh                          # build, then test
tests/onboarding-e2e/run.sh --no-build               # reuse the last build
SMTP_HOST=127.0.0.1 tests/onboarding-e2e/run.sh      # send email through the SMTP stand-in instead of SES
```

What's what:

- `mock.mjs`: one server on port 8899 that stands in for:
  - Supabase (PostgREST and auth)
  - Nextcloud (WebDAV and chunked uploads)
  - LibreSign, behaving like the real one: no signer links for the requester, `signRequestId`, `notify/signer`, partly signed files listing PDF signatures
  - Amazon SES

  Test controls:
  - `/__mock/state`: everything stored and sent
  - `/__mock/sign-one?i=0`: one signer signs
  - `/__mock/sign-all`: everyone signs, and the callback fires
- `smtp-sink.mjs`: SMTP server on port 2525 that requires login and hands messages to the mock.
- `run_e2e.py`: Playwright test. It covers:
  - admin creates a client
  - the invite email goes out
  - the client reviews and sends the agreements for signing
  - the signing email can be resent
  - partial signing
  - the callback, then the signed PDF and emails
  - the questionnaire
  - chunked uploads
  - admin views
  - phone layout

  It exits non-zero if any check fails.

Needs Node 20+ and Python 3 with Playwright (`pip install playwright && playwright install chromium`). Screenshots and logs go to `out/`, which git ignores.
