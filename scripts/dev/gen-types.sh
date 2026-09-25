#!/usr/bin/env bash
# Regenerates packages/database/src/database.gen.ts from the migrations by
# applying them to a throwaway local PostgreSQL and running `supabase gen types`.
set -euo pipefail
source "$(dirname "$0")/pg.sh"
pg_reset
OUT="$ROOT/packages/database/src/database.gen.ts"
npx supabase gen types typescript \
  --db-url "postgresql://postgres@127.0.0.1:$PGPORT/$PGDATABASE?sslmode=disable" \
  --schema public > "$OUT"
npx prettier --write "$OUT" >/dev/null
echo "✓ wrote $OUT"
