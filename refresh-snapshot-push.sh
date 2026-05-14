#!/usr/bin/env bash
# Refresh ./document.db from the live Trilium data dir, commit, push.
# Single-command backup. Idempotent — skips the commit when nothing changed.
#
# Usage:   ./refresh-snapshot-push.sh
# Cron:    */30 * * * *  /home/mustafa/trillium-notes/refresh-snapshot-push.sh >> /tmp/trilium-refresh.log 2>&1
#
# Env vars:
#   TRILIUM_DATA   override the source dir (default: $HOME/.trilium-data)
#   NO_PUSH=1      commit but don't push (e.g. on a flaky network)

set -eo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
SRC="${TRILIUM_DATA:-$HOME/.trilium-data}/document.db"
DST="$REPO/document.db"

[ -f "$SRC" ] || { echo "ERROR: source not found: $SRC" >&2; exit 1; }
command -v sqlite3 >/dev/null || { echo "ERROR: sqlite3 not in PATH" >&2; exit 1; }

echo "→ snapshot  $SRC  →  $DST"
sqlite3 "$SRC" ".backup $DST"
chmod 600 "$DST"

echo "→ integrity check"
if ! result=$(sqlite3 "$DST" "PRAGMA integrity_check;") || [ "$result" != "ok" ]; then
    echo "ERROR: integrity check failed: ${result:-<no output>}" >&2
    exit 2
fi

cd "$REPO"
git add document.db
if git diff --cached --quiet; then
    echo "→ no change since last snapshot — nothing to commit"
    exit 0
fi

TS=$(date -u +%Y%m%dT%H%M%SZ)
echo "→ commit    Refresh document.db backup — $TS"
git commit -q -m "Refresh document.db backup — $TS"

if [ "${NO_PUSH:-0}" = "1" ]; then
    echo "→ push skipped (NO_PUSH=1)"
    exit 0
fi
if ! git remote get-url origin >/dev/null 2>&1; then
    echo "→ no remote 'origin' configured — commit kept locally"
    exit 0
fi

echo "→ push      $(git remote get-url origin)"
git push -q origin HEAD
echo "✓ done"
