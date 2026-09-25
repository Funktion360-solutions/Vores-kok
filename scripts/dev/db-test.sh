#!/usr/bin/env bash
# Applies all migrations to a fresh local database and runs the SQL test suite
# in supabase/tests (RLS, storage policies, RPCs, constraints).
set -euo pipefail
source "$(dirname "$0")/pg.sh"
# roles are cluster-wide; drop the database but keep the cluster
pg_reset
echo "✓ migrations applied"
fail=0
for t in "$ROOT"/supabase/tests/*.sql; do
  if out=$(psql -q -v ON_ERROR_STOP=1 -f "$t" 2>&1); then
    echo "✓ $(basename "$t")"
  else
    echo "✗ $(basename "$t")"; echo "$out" | tail -20; fail=1
  fi
done
exit $fail
