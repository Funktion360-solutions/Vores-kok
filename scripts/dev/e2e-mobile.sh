#!/usr/bin/env bash
# Smoke-tests the universal Expo app through its web build (react-native-web)
# against the local Postgres + emulator, incl. offline behaviour and iPad split view.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/dev/pg.sh"
pg_reset >/dev/null 2>&1
bash "$ROOT/scripts/dev/api.sh" start
ANON=$(node -p "require('$ROOT/.dev/keys.json').anon")
cd "$ROOT/apps/mobile"
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY="$ANON" npx expo export --platform web --output-dir "$ROOT/.dev/dist-web" > "$ROOT/.dev/expo-web.log" 2>&1
node e2e/serve.mjs "$ROOT/.dev/dist-web" 8081 & SERVER=$!
trap 'kill $SERVER 2>/dev/null; bash "$ROOT/scripts/dev/api.sh" stop' EXIT
cd e2e
VK_KEYS="$ROOT/.dev/keys.json" PW_CHROMIUM=${PW_CHROMIUM:-/opt/pw-browsers/chromium} npx playwright test -c playwright.config.ts "$@"
