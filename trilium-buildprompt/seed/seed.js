#!/usr/bin/env node
/*
 * Idempotently seed the "Build Prompt (frontend script)" code note into a
 * Trilium SQLite database. Runs BEFORE Trilium itself, so when Trilium boots
 * it loads the new note into its in-memory cache (becca) from disk naturally.
 *
 * Skips silently when:
 *   - the DB file doesn't exist yet (first ever boot, Trilium will create it)
 *   - user setup isn't complete (Trilium is still showing the setup wizard)
 *   - the note already exists
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH     = process.env.TRILIUM_DB_PATH || '/home/node/trilium-data/document.db';
const SCRIPT_PATH = process.env.BP_SCRIPT_PATH  || '/opt/buildprompt/buildprompt.js';
const NOTE_TITLE  = 'Build Prompt (frontend script)';

function log(msg) {
    console.log(`[buildprompt-seed] ${msg}`);
}

function utcNow() {
    // Trilium's date format: "YYYY-MM-DD HH:MM:SS.mmm+0000"
    const d = new Date();
    const pad = (n, w=2) => String(n).padStart(w, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} `
         + `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.`
         + `${pad(d.getUTCMilliseconds(),3)}+0000`;
}

function randomId(n=12) {
    // Trilium uses ~12 chars from a base-58-ish alphabet via nanoid.
    // Crypto-random base64, stripped to alnum, sliced — close enough; collision
    // probability is negligible for a single insert.
    return crypto.randomBytes(32).toString('base64')
            .replace(/[^a-zA-Z0-9]/g, '').slice(0, n);
}

function main() {
    if (!fs.existsSync(DB_PATH)) {
        log(`DB not present at ${DB_PATH} — first boot, skipping.`);
        return;
    }
    if (!fs.existsSync(SCRIPT_PATH)) {
        log(`script not present at ${SCRIPT_PATH} — image misbuild?`);
        process.exit(1);
    }

    // better-sqlite3 ships inside the Trilium image's node_modules.
    let Database;
    try {
        Database = require('/usr/src/app/node_modules/better-sqlite3');
    } catch (e) {
        log(`could not load better-sqlite3: ${e.message}`);
        process.exit(1);
    }

    const db = new Database(DB_PATH);
    try {
        // Setup complete? Trilium 0.95 marks this via options.initialized='true'.
        const initRow = db.prepare(
            `SELECT value FROM options WHERE name = 'initialized'`
        ).get();
        if (!initRow || initRow.value !== 'true') {
            log('Trilium not initialized yet — skipping until next boot.');
            return;
        }
        // Already seeded?
        const existing = db.prepare(
            `SELECT noteId FROM notes WHERE title = ? AND isDeleted = 0`
        ).get(NOTE_TITLE);
        if (existing) {
            log(`note "${NOTE_TITLE}" already exists (${existing.noteId}) — nothing to do.`);
            return;
        }

        const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
        const now = utcNow();
        const noteId  = randomId(12);
        const branchId = `root_${noteId}`;
        const attrId  = randomId(12);

        // Trilium computes blobId by hashing the content and folding +,/ to X,Y.
        const blobId = crypto.createHash('sha512')
            .update(content)
            .digest('base64')
            .replace(/\+/g, 'X')
            .replace(/\//g, 'Y')
            .substr(0, 20);

        const tx = db.transaction(() => {
            // blob (only insert if it doesn't already exist — content-addressed)
            const blobRow = db.prepare(`SELECT blobId FROM blobs WHERE blobId = ?`).get(blobId);
            if (!blobRow) {
                db.prepare(
                    `INSERT INTO blobs (blobId, content, dateModified, utcDateModified)
                     VALUES (?, ?, ?, ?)`
                ).run(blobId, content, now, now);
            }
            // note
            db.prepare(
                `INSERT INTO notes (noteId, title, isProtected, type, mime, blobId,
                                    isDeleted, dateCreated, dateModified,
                                    utcDateCreated, utcDateModified)
                 VALUES (?, ?, 0, 'code', 'application/javascript;env=frontend', ?,
                         0, ?, ?, ?, ?)`
            ).run(noteId, NOTE_TITLE, blobId, now, now, now, now);
            // branch under root
            db.prepare(
                `INSERT INTO branches (branchId, noteId, parentNoteId, notePosition,
                                       prefix, isExpanded, isDeleted, utcDateModified)
                 VALUES (?, ?, 'root', 100, NULL, 0, 0, ?)`
            ).run(branchId, noteId, now);
            // label: #run=frontendStartup
            db.prepare(
                `INSERT INTO attributes (attributeId, noteId, type, name, value,
                                         position, utcDateModified, isDeleted,
                                         isInheritable)
                 VALUES (?, ?, 'label', 'run', 'frontendStartup', 10, ?, 0, 0)`
            ).run(attrId, noteId, now);
        });
        tx();

        log(`inserted note ${noteId} under root with #run=frontendStartup.`);
    } finally {
        db.close();
    }
}

try {
    main();
} catch (e) {
    console.error('[buildprompt-seed] FATAL:', e);
    // Do NOT fail the container start — Trilium should still boot.
    process.exit(0);
}
