#!/usr/bin/env bash
# Full rehearsal of the legacy import against local Postgres + emulator:
# fixture → import → verify → re-import (idempotent) → late signup → re-import.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
source "$ROOT/scripts/dev/pg.sh"
pg_reset >/dev/null 2>&1
bash "$ROOT/scripts/dev/api.sh" start >/dev/null
trap 'bash "$ROOT/scripts/dev/api.sh" stop' EXIT
cd "$ROOT/scripts/migration"
FIX="$ROOT/.dev/legacy-fixture"
npx tsx src/fixture.ts "$FIX" >/dev/null
export DATABASE_URL="postgresql://postgres@127.0.0.1:$PGPORT/$PGDATABASE"
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ROOT/.dev/keys.json','utf8')).service_role)")
ANON=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ROOT/.dev/keys.json','utf8')).anon)")

signup() { # email name -> prints user id; creates household when $3=household
  node --input-type=module -e "
    import { createClient } from '@supabase/supabase-js';
    const db = createClient('$SUPABASE_URL', '$ANON', { auth: { persistSession: false } });
    const s = await db.auth.signUp({ email: '$1', password: 'kodeord-kodeord', options: { data: { display_name: '$2' } } });
    if (s.error) throw s.error;
    if ('$3' === 'household') { const h = await db.rpc('create_household', { p_name: 'Familien' }); console.log(h.data); } else console.log(s.data.user.id);"
}
HH=$(signup aksel@example.com Aksel household)
echo "household $HH"
npx tsx src/import.ts --sqlite "$FIX/morsopskrifter.db" --dry-run --report "$ROOT/.dev/dry.json" | tail -3
npx tsx src/import.ts --sqlite "$FIX/morsopskrifter.db" --files "$FIX/App_files" --household "$HH" --invite --site-url http://localhost:3000 --report "$ROOT/.dev/import.json"
npx tsx src/verify.ts --sqlite "$FIX/morsopskrifter.db" --household "$HH"
echo "── re-run (must be idempotent)"
npx tsx src/import.ts --sqlite "$FIX/morsopskrifter.db" --files "$FIX/App_files" --household "$HH" --report "$ROOT/.dev/import2.json" | grep -E "Importeret|sprunget"
echo "── mor signs up later, re-run attaches membership + favorites"
signup mor@example.com Mor x >/dev/null
npx tsx src/import.ts --sqlite "$FIX/morsopskrifter.db" --files "$FIX/App_files" --household "$HH" --report "$ROOT/.dev/import3.json" | grep -E "Importeret"
psql -tA -c "select string_agg(p.display_name || ':' || m.role, ',' order by p.display_name) from household_members m join profiles p on p.id = m.user_id where m.household_id = '$HH'"
psql -tA -c "select count(*) || ' favorites for mor' from favorites f join auth.users u on u.id = f.user_id where u.email = 'mor@example.com'"
psql -tA -c "select count(*) || ' recipes, search ok: ' || (select count(*) from recipes where household_id = '$HH' and search_vector @@ to_tsquery('danish', 'kanel')) from recipes where household_id = '$HH'"
npx tsx src/verify.ts --sqlite "$FIX/morsopskrifter.db" --household "$HH" | tail -1
