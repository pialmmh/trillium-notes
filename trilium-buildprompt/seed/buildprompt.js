// Build Prompt — Trilium frontend code note
// Required label: #run=frontendStartup

const PROMPTS_FOLDER_TITLE = 'Prompts';
const MAX_TITLE_WORDS = 8;
const MAX_TITLE_LEN   = 60;

// ---------- modal ----------
function ensureModal() {
    if (document.getElementById('bp-modal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'bp-modal';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);'
        + 'display:none;align-items:center;justify-content:center;z-index:99999;';
    wrap.innerHTML = `
      <div style="background:var(--main-background-color,#fff);color:var(--main-text-color,#000);
                  border-radius:8px;width:min(760px,92vw);max-height:90vh;display:flex;
                  flex-direction:column;padding:16px;gap:12px;
                  box-shadow:0 10px 40px rgba(0,0,0,0.3);">
        <div style="font-weight:600;font-size:1.1em;">Build Prompt</div>
        <textarea id="bp-ta" spellcheck="false" style="
            flex:1 1 auto;min-height:360px;width:100%;
            font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;
            padding:10px;border:1px solid #ccc;border-radius:6px;resize:vertical;
            background:var(--input-background-color,#fff);color:inherit;"></textarea>
        <div id="bp-status" style="font-size:12px;opacity:0.7;min-height:1em;"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button id="bp-copy">Copy</button>
            <button id="bp-save">Save and Copy</button>
            <button id="bp-close">Close</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', e => { if (e.target === wrap) closeModal(); });
    document.getElementById('bp-close').onclick = closeModal;
    document.getElementById('bp-copy').onclick = doCopy;
    document.getElementById('bp-save').onclick = doSave;
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && wrap.style.display === 'flex') closeModal();
    });
}
function openModal(prefill) {
    ensureModal();
    document.getElementById('bp-ta').value = prefill;
    document.getElementById('bp-status').textContent = '';
    document.getElementById('bp-modal').style.display = 'flex';
    setTimeout(() => {
        const ta = document.getElementById('bp-ta');
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 30);
}
function closeModal() { document.getElementById('bp-modal').style.display = 'none'; }
function setStatus(msg) { document.getElementById('bp-status').textContent = msg; }

// ---------- prefill ----------
function buildPrefill({ noteId, title, selection }) {
    const url = `${location.origin}/#root/${noteId}`;
    let out = `## References\n- Trilium note: [${title}](${url})`;
    if (selection && selection.trim()) {
        const quoted = selection.trim().split('\n').map(l => `  > ${l}`).join('\n');
        out += `\n  Selection:\n${quoted}`;
    }
    return out + `\n\n## Prompt\n`;
}

// ---------- copy ----------
async function doCopy() {
    await navigator.clipboard.writeText(document.getElementById('bp-ta').value);
    setStatus('Copied to clipboard.');
}

// ---------- save ----------
async function doSave() {
    const txt = document.getElementById('bp-ta').value;
    try {
        const promptsId = await ensurePromptsFolder();
        const title = deriveTitle(txt);
        await api.runOnBackend((parentId, t, c) => {
            const { note } = api.createNewNote({
                parentNoteId: parentId, title: t, content: c,
                type: 'code', mime: 'text/markdown'
            });
            return note.noteId;
        }, [promptsId, title, txt]);
        await navigator.clipboard.writeText(txt);
        setStatus(`Saved as "${title}" + copied to clipboard.`);
    } catch (e) {
        console.error(e);
        setStatus('Save failed — see console.');
    }
}
function deriveTitle(text) {
    const idx = text.indexOf('## Prompt');
    const body = idx >= 0 ? text.slice(idx + '## Prompt'.length).trim() : text.trim();
    const firstLine = body.split('\n').find(l => l.trim().length > 0) || 'untitled';
    const words = firstLine.trim().split(/\s+/).slice(0, MAX_TITLE_WORDS).join(' ');
    return words.length > MAX_TITLE_LEN ? words.slice(0, MAX_TITLE_LEN) + '…' : words;
}
async function ensurePromptsFolder() {
    const hits = await api.searchForNotes(`"${PROMPTS_FOLDER_TITLE}"`);
    for (const n of hits) {
        if (n.title === PROMPTS_FOLDER_TITLE) {
            const parents = (typeof n.getParentNotes === 'function')
                ? await n.getParentNotes() : [];
            if (parents.some(p => p.noteId === 'root')) return n.noteId;
        }
    }
    return await api.runOnBackend((title) => {
        const { note } = api.createNewNote({
            parentNoteId: 'root', title, content: '', type: 'text'
        });
        note.setLabel('iconClass', 'bx bx-folder');
        return note.noteId;
    }, [PROMPTS_FOLDER_TITLE]);
}

// ---------- open helpers ----------
function openForActiveNote(selection) {
    const active = api.getActiveContextNote();
    if (!active) return;
    openModal(buildPrefill({
        noteId: active.noteId,
        title: active.title,
        selection: selection || ''
    }));
}

// ---------- keyboard triggers ----------
api.bindGlobalShortcut('alt+c', () => {
    openForActiveNote(window.getSelection().toString());
});
api.bindGlobalShortcut('alt+shift+c', () => {
    openForActiveNote('');
});

// ---------- floating button (bottom-right) ----------
function ensureFloatingButton() {
    if (document.getElementById('bp-fab')) return;
    const btn = document.createElement('button');
    btn.id = 'bp-fab';
    btn.title = 'Build Prompt (Alt+Shift+C)';
    btn.innerHTML = '<span class="bx bx-message-square-detail"></span>';
    btn.style.cssText = [
        'position:fixed', 'right:18px', 'bottom:18px', 'z-index:9998',
        'width:42px', 'height:42px', 'border-radius:50%',
        'border:none', 'cursor:pointer',
        'background:#4a90e2', 'color:#fff', 'font-size:20px',
        'box-shadow:0 4px 12px rgba(0,0,0,0.25)',
        'display:flex', 'align-items:center', 'justify-content:center'
    ].join(';');
    btn.addEventListener('click', () => openForActiveNote(window.getSelection().toString()));
    document.body.appendChild(btn);
}
// Trilium may not have body ready immediately at startup — try once now, retry briefly
(function bpInstallButton(retries) {
    if (document.body) { ensureFloatingButton(); return; }
    if (retries > 0) setTimeout(() => bpInstallButton(retries - 1), 200);
})(20);
