# trillium-notes

Two things live in this repo:

**Refresh + push** in one command: `./refresh.sh` (idempotent — no commit if the snapshot is unchanged).


## 1. `document.db` — Trilium DB backup

Consistent SQLite snapshot taken with
`sqlite3 source.db ".backup dest.db"` (WAL-safe — does not require
stopping Trilium).

**To restore:**
1. Stop Trilium.
2. Replace `~/.trilium-data/document.db` with this file.
3. Delete `document.db-shm` and `document.db-wal` if present.
4. Start Trilium.

`session_secret.txt` and `config.ini` are intentionally NOT in this repo.

## 2. `trilium-buildprompt/` — wrapper Docker image source

A thin Docker wrapper around `triliumnext/notes` that pre-installs a
"Build Prompt" feature (floating button + `Alt+C` / `Alt+Shift+C` modal,
Copy / Save / Close, auto-managed `Prompts` folder under root) for
working with Claude Code or another LLM CLI from inside Trilium.

See [`trilium-buildprompt/README.md`](trilium-buildprompt/README.md) for
build, run, and first-time-use instructions.

Trilium itself is **not** modified — the feature is implemented as a
frontend JS code note labelled `#run=frontendStartup`, seeded into
Trilium's SQLite by a small Node script that runs once per boot before
Trilium starts.
