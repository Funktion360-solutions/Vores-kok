#!/usr/bin/env bash
# End-to-end test of the web app against the local Postgres + Supabase emulator.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/dev/pg.sh"
pg_reset
bash "$ROOT/scripts/dev/api.sh" start
ANON=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ROOT/.dev/keys.json','utf8')).anon)")
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON"
export NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100
export NEXT_DIST_DIR=.next-e2e
export NEXT_TELEMETRY_DISABLED=1
cd "$ROOT/apps/web"
if [ -z "${E2E_SKIP_BUILD:-}" ]; then npx next build > "$ROOT/.dev/e2e-build.log" 2>&1 || { tail -40 "$ROOT/.dev/e2e-build.log"; exit 1; }; fi
setsid node "$ROOT/node_modules/next/dist/bin/next" start --port 3100 > "$ROOT/.dev/e2e-web.log" 2>&1 &
WEB=$!
trap 'kill -- -$WEB 2>/dev/null; bash "$ROOT/scripts/dev/api.sh" stop' EXIT
for _ in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:3100/login && break; sleep 0.5; done
PW_CHROMIUM=${PW_CHROMIUM-/opt/pw-browsers/chromium} npx playwright test "$@"
