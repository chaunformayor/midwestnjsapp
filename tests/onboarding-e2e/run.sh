#!/usr/bin/env bash
# End-to-end test of client onboarding.
#
# Builds the site, starts it against local stand-ins for Supabase, Nextcloud,
# LibreSign, Amazon SES and an SMTP server (mock.mjs, smtp-sink.mjs), then drives
# a real browser through the whole flow (run_e2e.py). Nothing real is contacted.
#
#   tests/onboarding-e2e/run.sh              build, then test (email through SES stand-in)
#   tests/onboarding-e2e/run.sh --no-build   reuse the last build
#   SMTP_HOST=127.0.0.1 tests/onboarding-e2e/run.sh   send email through the SMTP stand-in
#   E2E_RUNNER=node tests/onboarding-e2e/run.sh      run people-check.mjs (API-level, no browser) instead of the browser test
#
# Needs: Node 20+, Python 3 with Playwright (pip install playwright; playwright install chromium).
# Uses ports 3000, 8899 and 2525. Screenshots and logs go to tests/onboarding-e2e/out/.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$HERE/out"
mkdir -p "$OUT"

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

[ -d "$HERE/node_modules" ] || (cd "$HERE" && npm install --silent --no-audit --no-fund)

# Test-only values; the stand-ins accept exactly these.
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:8899
export NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-test
export SUPABASE_SERVICE_ROLE_KEY=service-test
export NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000

if [ "${1:-}" != "--no-build" ]; then
  echo "Building the site…"
  (cd "$ROOT" && npm run build > "$OUT/build.log" 2>&1) || { tail -30 "$OUT/build.log"; exit 1; }
fi

node "$HERE/mock.mjs" > "$OUT/mock.log" 2>&1 & PIDS+=($!)
node "$HERE/smtp-sink.mjs" > "$OUT/smtp.log" 2>&1 & PIDS+=($!)
for _ in $(seq 1 20); do grep -q '^ACCESS ' "$OUT/mock.log" 2>/dev/null && break; sleep 0.25; done
ACCESS="$(awk '/^ACCESS /{print $2}' "$OUT/mock.log")"

cd "$ROOT"
NEXTCLOUD_URL=http://127.0.0.1:8899 NEXTCLOUD_USER=mis-signing NEXTCLOUD_APP_PASSWORD=app-pass MIS_SIGNER_ACCOUNT=chaun \
SMTP_HOST="${SMTP_HOST:-}" SMTP_PORT=2525 SMTP_USER=smtp-user SMTP_PASSWORD=smtp-pass SMTP_FROM='MIS Test <sender@example.com>' \
ANTHROPIC_API_KEY=sk-test ANTHROPIC_BASE_URL=http://127.0.0.1:8899 \
AWS_ENDPOINT_URL=http://127.0.0.1:8899 AWS_ENDPOINT_URL_SESV2=http://127.0.0.1:8899 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_SES_REGION=us-east-1 \
ADMIN_EMAIL=admin@example.com \
  node_modules/.bin/next start -p 3000 -H 127.0.0.1 > "$OUT/next.log" 2>&1 & PIDS+=($!)
for _ in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:3000/ && break; sleep 0.5; done

if [ "${E2E_RUNNER:-python}" = "node" ]; then
  node "$HERE/people-check.mjs" "$ACCESS"   # no browser needed: per-person flow, folders, certificate
else
  python3 "$HERE/run_e2e.py" "$ACCESS"
fi
