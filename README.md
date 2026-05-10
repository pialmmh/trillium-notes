# trillium-notes — backups of Trilium document.db

`document.db` is a consistent SQLite snapshot taken with
`sqlite3 source.db ".backup dest.db"` (WAL-safe — does not require
stopping Trilium).

## To restore
1. Stop Trilium.
2. Replace `~/.trilium-data/document.db` with this file.
3. Delete `document.db-shm` and `document.db-wal` if present.
4. Start Trilium.

`session_secret.txt` and `config.ini` are intentionally NOT in this repo.
