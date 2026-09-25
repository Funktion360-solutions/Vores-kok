#!/usr/bin/env bash
# Starts/stops the local Supabase API emulator in the background.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PIDFILE="$ROOT/.dev/api.pid"
case "${1:-start}" in
  start)
    mkdir -p "$ROOT/.dev"
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then kill "$(cat "$PIDFILE")"; sleep 0.3; fi
    nohup node "$ROOT/scripts/dev/local-supabase.mjs" > "$ROOT/.dev/api.log" 2>&1 &
    echo $! > "$PIDFILE"
    for _ in $(seq 1 30); do curl -sf http://127.0.0.1:${PORT:-54321}/auth/v1/health >/dev/null && break; sleep 0.2; done
    node "$ROOT/scripts/dev/local-supabase.mjs" --print-keys > "$ROOT/.dev/keys.json"
    echo "local API on http://127.0.0.1:${PORT:-54321} (keys in .dev/keys.json)";;
  stop)
    [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE";;
esac
