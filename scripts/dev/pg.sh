#!/usr/bin/env bash
# Local throwaway PostgreSQL cluster for tests/dev (no Docker needed).
# Usage: source scripts/dev/pg.sh && pg_up | pg_down | pg_reset
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PGDATA="$ROOT/.dev/pgdata"
export PGHOST="$ROOT/.dev/sock"
export PGPORT="${PGPORT:-54329}"
export PGUSER=postgres
export PGDATABASE="${PGDATABASE:-voreskok}"

# PostgreSQL refuses to run as root; use an unprivileged account in containers.
AS_PG=()
if [ "$(id -u)" = "0" ]; then
  id pgdev >/dev/null 2>&1 || useradd -M -s /bin/bash pgdev
  AS_PG=(runuser -u pgdev --)
fi

pg_up() {
  mkdir -p "$PGHOST" "$ROOT/.dev"
  [ ${#AS_PG[@]} -gt 0 ] && chown pgdev "$ROOT/.dev" "$PGHOST" && chmod 755 "$ROOT/.dev"
  if [ ! -d "$PGDATA" ]; then
    "${AS_PG[@]}" "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
  fi
  if ! "${AS_PG[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    "${AS_PG[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -l "$ROOT/.dev/pg.log" -o "-k $PGHOST -p $PGPORT -c listen_addresses=127.0.0.1 -c wal_level=logical" -w start >/dev/null
  fi
}
pg_down() { "${AS_PG[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true; }
pg_reset() {
  pg_up
  psql -q -d postgres -c "drop database if exists $PGDATABASE with (force)" -c "create database $PGDATABASE" >/dev/null
  psql -q -v ON_ERROR_STOP=1 -f "$ROOT/scripts/dev/supabase-shim.sql" >/dev/null
  for f in "$ROOT"/supabase/migrations/*.sql; do
    psql -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null || { echo "Migration failed: $f" >&2; return 1; }
  done
}
