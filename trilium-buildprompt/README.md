# trilium-buildprompt

A thin Docker wrapper around [`triliumnext/notes`](https://hub.docker.com/r/triliumnext/notes)
that pre-installs a **Build Prompt** feature for working with Claude Code
(or any LLM CLI) from inside Trilium.

The feature gives you:

- a floating button (bottom-right of the Trilium UI)
- `Alt+C` shortcut (uses the current text selection)
- `Alt+Shift+C` shortcut (uses the active note, no selection)

Any of those open a modal pre-filled with a reference link back to the active
Trilium note (and the quoted selection, when applicable). You type your prompt
below, then **Copy** to clipboard (paste into your CLI) or **Save** to keep it
under a `Prompts` folder Trilium auto-creates under root.

Saved prompts have short titles derived from the first few words of the prompt,
so the tree stays readable.

## How it works

Trilium itself is unmodified — this image inherits `triliumnext/notes:<tag>`
and adds two files:

- `/opt/buildprompt/buildprompt.js` — a JS frontend code note with the feature.
- `/opt/buildprompt/seed.js` — a Node script that idempotently inserts that
  code note into Trilium's SQLite as a child of `root`, labelled
  `#run=frontendStartup`.

The base image's `start-docker.sh` is replaced with a thin wrapper that runs
`seed.js` once per boot before handing off to Trilium. Because the seeder
writes directly to the DB *before* Trilium opens it, Trilium's in-memory cache
(becca) loads the new note naturally on startup. No runtime patching, no
context-menu interception, no fragile DOM observers.

## First-time use

```bash
docker compose up -d --build
```

Open `http://127.0.0.1:7081/` and complete Trilium's first-run setup wizard
(set username, password, etc.). The seeder won't have inserted anything yet —
it intentionally skips while `user_data.isSetup = 'false'`.

Then:

```bash
docker compose restart
```

Reload the browser tab. You should see the Build Prompt floating button in the
bottom-right corner.

## Subsequent boots

The seeder is idempotent. On every container start it checks:

1. Does the DB exist? (If not, first boot — skip.)
2. Is setup complete? (If not, still in wizard — skip.)
3. Does the `Build Prompt (frontend script)` note already exist? (If yes — skip.)

So restarts and image rebuilds never duplicate the note, and removing the note
manually from Trilium followed by a `docker compose restart` re-installs it.

## Updating

To incorporate a newer Trilium release, just rebuild:

```bash
docker compose build --pull
docker compose up -d
```

The `FROM triliumnext/notes:${BASE_TAG}` line in the Dockerfile picks up
whatever you set `BASE_TAG` to (defaults to `latest`).

## Building for another machine

This repo is self-contained. On a fresh host:

```bash
git clone <this repo>
cd trilium-buildprompt
docker compose up -d --build
```

Then follow the first-time-use steps above.

## File map

```
.
├── Dockerfile              # FROM triliumnext/notes:${BASE_TAG} + payload + wrapper
├── docker-compose.yml      # convenience runner with bind-mount + port map
├── README.md               # this file
└── seed/
    ├── buildprompt.js      # the Trilium frontend code note (the feature)
    ├── seed.js             # idempotent SQLite seeder
    └── start-docker.sh     # wrapper around Trilium's own start-docker.sh
```

## Source code

Trilium itself is **not** modified. Build Prompt lives entirely in the seeded
code note, which means it travels with the Trilium database — back up
`document.db` and the feature comes with it.
