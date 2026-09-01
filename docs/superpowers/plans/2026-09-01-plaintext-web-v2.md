# Plaintext Web v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Ship a safer, responsive, accessible, dependency-free v2 of Plaintext Web as one offline index.html, then publish it as a clearly attributed GitHub repository and Pages demo after the user's visual acceptance.

**Architecture:** Keep all runtime HTML, CSS, JavaScript, fonts, and legal notices in index.html. Add only small pure helpers for dirty state, recovery fallback, bounded numeric input, and rolling writing-session windows; expose those helpers to a Node standard-library verifier through a delimited source block. Repository-only files hold documentation, readable licence copies, and release checks.

**Tech Stack:** HTML5, CSS, browser JavaScript, Node.js standard library node:test, Git, GitHub CLI, GitHub Pages.

## Global Constraints

- The distributable remains exactly one runtime file: index.html.
- Opening index.html through file:// must provide the full app; no server is required.
- Do not add npm, package.json, a framework, a bundler, a service worker, or runtime dependencies.
- Do not add speech-to-text in this milestone.
- Do not add a PWA manifest, IndexedDB, OPFS, cloud sync, accounts,
  multi-document storage, rich text, or Markdown preview.
- Do not change the four embedded font payloads except to repair a proven corruption.
- Preserve the quiet visual character, 760px reading width, current font choices, themes, history, Undo/Redo, find/replace, fullscreen fallback, and writing sessions.
- Preserve the original build through Git history; never rewrite commit 70ce5e8.
- Use apply_patch for authored file changes. The single planned rename may use git mv.
- Run node --test tests/verify.mjs after every application change.
- Run git diff --check before every commit.
- Do not create the public GitHub repository or enable Pages until the user completes the visual/browser acceptance checkpoint in Task 8.
- Do not overwrite an existing GitHub repository named plaintext-web. Stop and report it if the name is already occupied in the authenticated account.

---

## Planned File Structure

- index.html — renamed application and GitHub Pages entry point; all runtime assets remain embedded.
- tests/verify.mjs — dependency-free static, parsing, pure-helper, contrast, and licence checks.
- README.md — use, privacy, compatibility, credits, offline instructions, and live demo link after publication.
- LICENSE — exact upstream MIT licence and copyright.
- THIRD_PARTY_NOTICES.md — exact upstream third-party notice.
- ThirdPartyLicenses/AtkinsonHyperlegible-OFL.txt — exact upstream font licence.
- ThirdPartyLicenses/Literata-OFL.txt — exact upstream font licence.
- ThirdPartyLicenses/Newsreader-OFL.txt — exact upstream font licence.
- ThirdPartyLicenses/WorkSans-OFL.txt — exact upstream font licence.
- docs/superpowers/specs/2026-09-01-plaintext-web-v2-design.md — approved design, with the inert-template legal-text syntax correction found during planning.
- docs/superpowers/plans/2026-09-01-plaintext-web-v2.md — this implementation checklist.

## Task 1: Establish the Pages Entry Point and Release Verifier

**Files:**

- Rename: plaintext.html to index.html
- Create: tests/verify.mjs

- [ ] **Step 1: Write a verifier that initially fails because index.html does not exist**

Create tests/verify.mjs with this complete initial content:

~~~js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appPath = resolve(root, "index.html");

function readApp() {
  return readFileSync(appPath, "utf8");
}

function extractInlineScript(html) {
  const matches = [
    ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
  ];
  assert.equal(matches.length, 1, "expected one inline application script");
  return matches[0][1];
}

function runtimeSource(html) {
  return html
    .replace(/<template id="legalNotices">[\s\S]*?<\/template>/i, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

function extractTestableLogic(html, names) {
  const match = html.match(
    /\/\* @testable:start \*\/([\s\S]*?)\/\* @testable:end \*\//,
  );
  assert.ok(match, "testable logic block missing");
  return new Function(
    match[1] + "; return { " + names.join(", ") + " };",
  )();
}

test("release is one parseable offline HTML file", () => {
  const html = readApp();
  const runtime = runtimeSource(html);
  const script = extractInlineScript(html);
  assert.equal((html.match(/@font-face/g) || []).length, 4);
  assert.equal(
    (html.match(/src:url\(data:font\/woff2;base64,/g) || []).length,
    4,
  );
  assert.doesNotMatch(
    runtime,
    /<(?:script|link|img|audio|video|source)\b[^>]*(?:src|href)\s*=\s*["']https?:/i,
  );
  assert.doesNotMatch(runtime, /url\(\s*["']?https?:/i);
  assert.doesNotMatch(
    script,
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b|sendBeacon/,
  );
  for (const id of ["title", "editor", "find", "settings", "history", "sessionDlg", "palette"]) {
    assert.match(html, new RegExp('id="' + id + '"'), id + " is missing");
  }
  assert.doesNotThrow(() => new Function(script));
});

export {
  appPath,
  extractInlineScript,
  extractTestableLogic,
  readApp,
  root,
  runtimeSource,
};
~~~

- [ ] **Step 2: Run the verifier and confirm the expected failure**

Run:

    node --test tests/verify.mjs

Expected: FAIL with ENOENT for index.html. A different error means the verifier itself must be corrected before continuing.

- [ ] **Step 3: Rename the preserved application**

Run:

    git mv plaintext.html index.html

Do not edit index.html in this step.

- [ ] **Step 4: Run the verifier and confirm the baseline passes**

Run:

    node --test tests/verify.mjs
    git diff --check

Expected: one passing test, four embedded font declarations, one parseable inline script, and no external runtime resource elements.

- [ ] **Step 5: Commit the entry-point checkpoint**

Run:

    git add index.html tests/verify.mjs
    git commit -m "test: establish offline release baseline"

## Task 2: Add Complete Attribution and Standalone Legal Notices

**Files:**

- Create: LICENSE
- Create: THIRD_PARTY_NOTICES.md
- Create: ThirdPartyLicenses/AtkinsonHyperlegible-OFL.txt
- Create: ThirdPartyLicenses/Literata-OFL.txt
- Create: ThirdPartyLicenses/Newsreader-OFL.txt
- Create: ThirdPartyLicenses/WorkSans-OFL.txt
- Create: README.md
- Modify: index.html
- Modify: tests/verify.mjs

- [ ] **Step 1: Add failing repository and embedded-licence checks**

Append these imports and helpers to tests/verify.mjs, merging the fs import into the existing import:

~~~js
import { existsSync, readFileSync } from "node:fs";

const legalFiles = [
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "ThirdPartyLicenses/AtkinsonHyperlegible-OFL.txt",
  "ThirdPartyLicenses/Literata-OFL.txt",
  "ThirdPartyLicenses/Newsreader-OFL.txt",
  "ThirdPartyLicenses/WorkSans-OFL.txt",
];

function legalBlock(html) {
  const match = html.match(
    /<template id="legalNotices">([\s\S]*?)<\/template>/,
  );
  assert.ok(match, "standalone legal-notices block missing");
  return match[1];
}

test("repository and standalone app retain required legal notices", () => {
  const html = readApp();
  const embedded = legalBlock(html);

  for (const relative of legalFiles) {
    const path = resolve(root, relative);
    assert.ok(existsSync(path), relative + " is missing");
    const notice = readFileSync(path, "utf8").trim();
    assert.ok(notice.length > 100, relative + " is unexpectedly short");
    assert.ok(
      embedded.includes(notice),
      relative + " is not embedded verbatim in index.html",
    );
  }

  assert.match(html, /JP Aumasson/);
  assert.match(html, /github\.com\/veorq\/Plaintext/);
  assert.match(html, /unofficial web adaptation/i);
});
~~~

Run:

    node --test tests/verify.mjs

Expected: FAIL because the repository licence files and the embedded marker block do not exist.

- [ ] **Step 2: Retrieve the authoritative upstream notices**

Read each exact current upstream file:

    gh api repos/veorq/Plaintext/contents/LICENSE -H "Accept: application/vnd.github.raw+json"
    gh api repos/veorq/Plaintext/contents/THIRD_PARTY_NOTICES.md -H "Accept: application/vnd.github.raw+json"
    gh api repos/veorq/Plaintext/contents/ThirdPartyLicenses/AtkinsonHyperlegible-OFL.txt -H "Accept: application/vnd.github.raw+json"
    gh api repos/veorq/Plaintext/contents/ThirdPartyLicenses/Literata-OFL.txt -H "Accept: application/vnd.github.raw+json"
    gh api repos/veorq/Plaintext/contents/ThirdPartyLicenses/Newsreader-OFL.txt -H "Accept: application/vnd.github.raw+json"
    gh api repos/veorq/Plaintext/contents/ThirdPartyLicenses/WorkSans-OFL.txt -H "Accept: application/vnd.github.raw+json"

Create the six repository files with apply_patch using the exact returned text. Do not paraphrase licence text or change copyright lines.

- [ ] **Step 3: Embed exact notices in the standalone file**

Immediately before the closing body tag, add one inert, non-rendered source
container:

~~~html
<template id="legalNotices">
</template>
~~~

Between those two markers, use apply_patch to add this attribution:

~~~text
Plaintext Web is an unofficial web adaptation inspired by JP Aumasson's
Plaintext: https://github.com/veorq/Plaintext
~~~

Then copy the complete, unmodified file contents retrieved in Step 2 inside the
template in this exact order, separated only by blank lines: LICENSE,
AtkinsonHyperlegible-OFL.txt, Literata-OFL.txt, Newsreader-OFL.txt,
WorkSans-OFL.txt, and THIRD_PARTY_NOTICES.md. The verifier compares every
trimmed repository file against the embedded block, so partial or paraphrased
text fails. Do not use an HTML comment: the exact OFL text contains double
hyphens, which are invalid inside HTML comments.

- [ ] **Step 4: Write the repository README**

Create README.md with these sections and wording:

~~~md
# Plaintext Web

Plaintext Web is an unofficial, dependency-free web adaptation inspired by
JP Aumasson's [Plaintext](https://github.com/veorq/Plaintext).

It is a quiet plain-text editor delivered as one self-contained HTML file.
Your document stays in your browser unless you explicitly open or save a file.

## Try it

The hosted demo link will be added after the final browser acceptance pass.

## Offline use

Download index.html and open it directly in a current browser. The editor,
styles, scripts, and fonts are embedded; the app makes no runtime network
requests.

## Features

- Local recovery and version history
- Undo and Redo
- Open, Save, Save As, and Download a copy fallbacks
- Find and replace
- Light, dark, and system-matched themes
- Goal-based writing sessions
- Fullscreen when the browser supports it

## Browser support

The release targets current Chrome, Edge, Firefox, and Safari on desktop,
Safari on iOS/iPadOS, and Chrome on Android. Direct connected-file writes use
the File System Access API where available; file input and downloads work as
the cross-browser fallback.

## Privacy

Plaintext Web has no analytics, accounts, cloud sync, or runtime network
dependencies. Browser recovery uses localStorage when available. Saving or
downloading a file happens only when you ask.

## Credits

The editor is inspired by
[Plaintext](https://github.com/veorq/Plaintext) by JP Aumasson. This repository
is an independent web adaptation and is not affiliated with or endorsed by the
upstream author.

## License

The upstream Plaintext code is distributed under its MIT licence. Embedded
fonts retain their SIL Open Font Licence terms. See LICENSE,
THIRD_PARTY_NOTICES.md, and ThirdPartyLicenses/.
~~~

- [ ] **Step 5: Verify exact notice coverage**

Run:

    node --test tests/verify.mjs
    git diff --check

Expected: both tests pass. Inspect the legalNotices template and confirm the
complete MIT and OFL texts are present and do not render in the page.

- [ ] **Step 6: Commit attribution and documentation**

Run:

    git add LICENSE THIRD_PARTY_NOTICES.md ThirdPartyLicenses README.md index.html tests/verify.mjs
    git commit -m "docs: add attribution and usage guide"

## Task 3: Introduce Dirty State and Guard Destructive Transitions

**Files:**

- Modify: index.html
- Modify: tests/verify.mjs

- [ ] **Step 1: Add failing pure-helper and dialog checks**

Append:

~~~js
test("dirty state compares exact text and fingerprints reload markers", () => {
  const html = readApp();
  const { documentIsDirty, fingerprint } = extractTestableLogic(html, [
    "documentIsDirty",
    "fingerprint",
  ]);

  assert.equal(documentIsDirty("saved", "saved"), false);
  assert.equal(documentIsDirty("changed", "saved"), true);
  assert.equal(documentIsDirty("", null), false);
  assert.equal(documentIsDirty("recovered", null), true);
  assert.notEqual(fingerprint("ab"), fingerprint("ba"));
});

test("destructive document changes have one safe guard", () => {
  const html = readApp();
  assert.match(html, /<dialog id="discardDialog"[^>]*aria-labelledby="discardTitle"/);
  assert.match(html, /id="discardCancel"[^>]*autofocus/);
  assert.match(html, /id="discardConfirm"/);
  assert.match(html, /async function confirmDiscard\(/);
  assert.match(html, /async function replaceDocument\(/);
});
~~~

Run:

    node --test tests/verify.mjs

Expected: FAIL because the testable block and discard dialog do not exist.

- [ ] **Step 2: Add the pure dirty-state helpers**

Place this delimited block near the start of the application script, after constants and before state initialization:

~~~js
/* @testable:start */
function fingerprint(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return text.length.toString(36) + ":" + (hash >>> 0).toString(36);
}

function documentIsDirty(text, cleanText) {
  if (cleanText === null) return text.length > 0;
  return text !== cleanText;
}
/* @testable:end */
~~~

This FNV-1a-derived value is a compact reload marker, not a security hash.
Add clean: "plaintext.clean" to K. Initialize the exact in-memory clean text
from recovered content only when the persisted fingerprint matches:

~~~js
const recoveredText = store.get(K.recovery) || "";
const recoveredCleanFingerprint = store.get(K.clean);

const doc = {
  text: recoveredText,
  cleanText:
    recoveredCleanFingerprint === fingerprint(recoveredText)
      ? recoveredText
      : null,
  name: store.get(K.name) || "Untitled",
  handle: null,
  history: [],
  lastSnapshot: "",
  undo: [],
  redo: [],
  lastCheckpoint: 0,
  saveTimer: 0,
};
~~~

Exact text comparison is used while the page is open. The fingerprint only
reconstructs that state after reload. Add:

~~~js
function isDirty() {
  return documentIsDirty(doc.text, doc.cleanText);
}

function markClean() {
  doc.cleanText = doc.text;
  store.set(K.clean, fingerprint(doc.cleanText));
  renderTitle();
}
~~~

- [ ] **Step 3: Add the safe discard dialog**

Add:

~~~html
<dialog id="discardDialog" aria-labelledby="discardTitle">
  <div class="panel">
    <h2 id="discardTitle">Discard unsaved changes?</h2>
    <p class="note">This replaces the current document. Your latest local recovery may also be replaced.</p>
    <div class="actions">
      <button class="btn" id="discardCancel" autofocus>Cancel</button>
      <button class="btn primary" id="discardConfirm">Discard changes</button>
    </div>
  </div>
</dialog>
~~~

Implement a promise that resolves exactly once and treats Escape, backdrop close, and Cancel as false:

~~~js
async function confirmDiscard() {
  if (!isDirty()) return true;
  const dialog = $("discardDialog");
  const cancel = $("discardCancel");
  const confirm = $("discardConfirm");

  return new Promise((resolve) => {
    let settled = false;
    const finish = (answer) => {
      if (settled) return;
      settled = true;
      cancel.removeEventListener("click", onCancel);
      confirm.removeEventListener("click", onConfirm);
      dialog.removeEventListener("close", onClose);
      if (dialog.open) dialog.close();
      resolve(answer);
    };
    const onCancel = () => finish(false);
    const onConfirm = () => finish(true);
    const onClose = () => finish(false);
    cancel.addEventListener("click", onCancel);
    confirm.addEventListener("click", onConfirm);
    dialog.addEventListener("close", onClose, { once: true });
    dialog.showModal();
  });
}
~~~

- [ ] **Step 4: Centralize New, Open, and drop replacement**

Use this candidate shape throughout:

~~~js
{
  text: fileText,
  name: fileName,
  handle: fileHandleOrNull,
  clean: true
}
~~~

Build candidates without mutating document state:

~~~js
async function candidateFromFile(file, handle) {
  return {
    text: await file.text(),
    name: file.name || "Untitled",
    handle: handle || null,
    clean: true,
  };
}
~~~

Implement:

~~~js
async function replaceDocument(candidate) {
  if (!(await confirmDiscard())) return false;
  persistNow();
  endSession();
  clearTimeout(doc.saveTimer);
  doc.name = candidate.name || "Untitled";
  doc.handle = candidate.handle || null;
  doc.text = candidate.text;
  doc.cleanText = candidate.clean ? candidate.text : null;
  doc.history = [];
  doc.lastSnapshot = candidate.text;
  doc.undo.length = 0;
  doc.redo.length = 0;
  doc.lastCheckpoint = 0;
  if (doc.cleanText === null) store.del(K.clean);
  else store.set(K.clean, fingerprint(doc.cleanText));
  store.del(K.history);
  editor.value = candidate.text;
  try { editor.setSelectionRange(0, 0); } catch (_) {}
  renderCount();
  persistNow();
  renderTitle();
  editor.focus();
  return true;
}
~~~

Route New, File System Access open, file-input open, and drop through
replaceDocument. Select and read an Open/drop candidate before asking to
discard. Treat AbortError as a silent cancel. Keep the current document and
title unchanged on read failure, and show the failure through showAlert.

Use these entry-point shapes:

~~~js
function newDocument() {
  return replaceDocument({
    text: "",
    name: "Untitled",
    handle: null,
    clean: true,
  });
}

async function openDocument() {
  if (!window.showOpenFilePicker) {
    $("filePicker").click();
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: FILE_TYPES,
    });
    const file = await handle.getFile();
    await replaceDocument(await candidateFromFile(file, handle));
  } catch (error) {
    if (error && error.name === "AbortError") return;
    showAlert("Plaintext could not open that UTF-8 plain-text file.");
  }
}

$("filePicker").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  try {
    if (file) {
      await replaceDocument(await candidateFromFile(file, null));
    }
  } catch (_) {
    showAlert("Plaintext could not read that UTF-8 plain-text file.");
  } finally {
    event.target.value = "";
  }
});
~~~

Replace the drop handler with:

~~~js
document.addEventListener("drop", async (event) => {
  event.preventDefault();
  const transfer = event.dataTransfer;
  const file = transfer && transfer.files && transfer.files[0];
  if (!file) return;

  let handle = null;
  const item = transfer.items && transfer.items[0];
  if (item && typeof item.getAsFileSystemHandle === "function") {
    try {
      const candidateHandle = await item.getAsFileSystemHandle();
      if (candidateHandle && candidateHandle.kind === "file") {
        handle = candidateHandle;
      }
    } catch (_) {}
  }

  try {
    await replaceDocument(await candidateFromFile(file, handle));
  } catch (_) {
    showAlert("Plaintext could not read that UTF-8 plain-text file.");
  }
});
~~~

Retain this dragover prevention:

~~~js
document.addEventListener("dragover", (event) => {
  event.preventDefault();
});
~~~

A read failure leaves every current-document field unchanged.

History restore is intentionally separate. Add:

~~~js
async function restoreSnapshot(snapshot) {
  if (!(await confirmDiscard())) return false;
  snapshotIfNeeded();
  checkpoint(doc.text, true);
  doc.text = snapshot.text;
  replaceEditorText(snapshot.text);
  doc.lastCheckpoint = 0;
  renderCount();
  persistNow();
  return true;
}
~~~

Change each history button listener to:

~~~js
b.addEventListener("click", async () => {
  $("history").close();
  await restoreSnapshot(snapshot);
});
~~~

This preserves the current text in both history and Undo before applying the
snapshot. It preserves name, handle, cleanText, and the existing history.

- [ ] **Step 5: Verify transition behavior**

Run:

    node --test tests/verify.mjs

Then manually exercise from file://:

1. Empty New transitions without a prompt.
2. Saved, unchanged New transitions without a prompt.
3. Dirty New shows Cancel focused; Escape and Cancel preserve content.
4. Dirty Open selects and reads the candidate before showing the prompt.
5. Cancelling a picker never shows the discard prompt.
6. Dirty drop uses the same prompt and leaves the current text intact on Cancel.
7. Dirty history restore snapshots current text, then keeps document name and history identity.

Expected: all automated checks pass and no cancelled transition changes text, name, handle, history, Undo, or clean state.

- [ ] **Step 6: Commit guarded transitions**

Run:

    git diff --check
    git add index.html tests/verify.mjs
    git commit -m "fix: guard destructive document changes"

## Task 4: Make Recovery and File Failures Explicit

**Files:**

- Modify: index.html
- Modify: tests/verify.mjs

- [ ] **Step 1: Add failing recovery-fallback tests**

Extend the testable block rather than creating a second block. Append:

~~~js
test("recovery write trims history once before giving up", () => {
  const html = readApp();
  const { writeRecoveryWithFallback } = extractTestableLogic(html, [
    "writeRecoveryWithFallback",
  ]);
  const keys = { recovery: "r", history: "h" };

  const healthy = new Map();
  const healthyStore = {
    set(key, value) {
      healthy.set(key, value);
      return true;
    },
    del(key) {
      healthy.delete(key);
    },
  };
  const first = writeRecoveryWithFallback(
    healthyStore,
    keys,
    "current",
    [1, 2, 3, 4],
  );
  assert.deepEqual(first, {
    ok: true,
    history: [1, 2, 3, 4],
    trimmed: false,
  });

  let recoveryAttempts = 0;
  const quotaStore = {
    set(key) {
      if (key === "r") {
        recoveryAttempts += 1;
        return recoveryAttempts > 1;
      }
      return true;
    },
    del() {},
  };
  const retried = writeRecoveryWithFallback(
    quotaStore,
    keys,
    "current",
    [1, 2, 3, 4],
  );
  assert.deepEqual(retried, { ok: true, history: [1, 2], trimmed: true });

  const failedStore = { set: () => false, del() {} };
  const failed = writeRecoveryWithFallback(
    failedStore,
    keys,
    "current",
    [1, 2, 3, 4],
  );
  assert.deepEqual(failed, { ok: false, history: [1, 2], trimmed: true });
});

test("persistence health has an accessible visible status", () => {
  const html = readApp();
  assert.match(html, /id="persistenceStatus"[^>]*role="status"/);
  assert.match(html, /Local recovery unavailable—save to a file\./);
  assert.match(html, /pagehide/);
  assert.match(html, /beforeunload/);
});
~~~

Run:

    node --test tests/verify.mjs

Expected: FAIL because writeRecoveryWithFallback and persistenceStatus do not exist.

- [ ] **Step 2: Add the pure recovery retry algorithm**

Inside the existing testable block add:

~~~js
function writeRecoveryWithFallback(storage, keys, text, history) {
  if (storage.set(keys.recovery, text)) {
    return { ok: true, history, trimmed: false };
  }

  const keepCount = Math.ceil(history.length / 2);
  const shortened = history.slice(0, keepCount);
  if (!storage.set(keys.history, JSON.stringify(shortened))) {
    storage.del(keys.history);
  }

  return {
    ok: storage.set(keys.recovery, text),
    history: shortened,
    trimmed: true,
  };
}
~~~

Keep store.set returning a boolean that reflects durable localStorage success.
Replace the returned storage object's set method and add live:

~~~js
set(key, value) {
  mem.set(key, value);
  if (!live) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
},
live() {
  return live;
},
~~~

When localStorage is blocked, the memory Map still supports the live page but
set returns false so the UI correctly reports that reload recovery is
unavailable.

- [ ] **Step 3: Add persistence state and its status region**

Add near the title:

~~~html
<div id="persistenceStatus" class="persistence-status" role="status" aria-live="polite" hidden></div>
~~~

Add state:

~~~js
const persistence = {
  healthy: store.live(),
  historyPaused: !store.live(),
};

function renderPersistenceStatus(message) {
  const status = $("persistenceStatus");
  status.textContent = message || "";
  status.hidden = !message;
}

function setPersistenceHealth(ok, trimmed) {
  persistence.healthy = ok;
  persistence.historyPaused = !ok;
  if (!ok) {
    renderPersistenceStatus("Local recovery unavailable—save to a file.");
  } else if (trimmed) {
    renderPersistenceStatus(
      "Current text recovered; older versions were removed to make space.",
    );
  } else {
    renderPersistenceStatus("");
  }
}
~~~

Remove trimHistory and writeHistory calls from snapshotIfNeeded so it only
adds a due snapshot. Replace persistNow with:

~~~js
function persistNow() {
  clearTimeout(doc.saveTimer);
  const recovery = writeRecoveryWithFallback(
    store,
    K,
    doc.text,
    doc.history,
  );
  doc.history = recovery.history;
  setPersistenceHealth(recovery.ok, recovery.trimmed);

  store.set(K.name, doc.name);
  if (doc.cleanText === null) {
    store.del(K.clean);
  } else {
    store.set(K.clean, fingerprint(doc.cleanText));
  }

  if (!persistence.historyPaused && !recovery.trimmed) {
    snapshotIfNeeded();
    trimHistory();
    writeHistory();
  }
}
~~~

This writes current recovery first, then document metadata and the clean
fingerprint, then a due history snapshot and its count/byte-budget trimming.
Replace doc.history with the helper's result. The helper retries recovery only
once. A later successful recovery clears historyPaused and the persistent
warning. Skipping a new snapshot in the same call that trimmed history avoids
immediately filling the space that recovery just reclaimed.

- [ ] **Step 4: Wire lifecycle safety**

Keep the debounce. Add:

~~~js
window.addEventListener("pagehide", persistNow);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persistNow();
});
window.addEventListener("beforeunload", (event) => {
  persistNow();
  if (!persistence.healthy && isDirty()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
~~~

Remove the old unconditional beforeunload listener. Call persistNow at explicit file save/export and document transition boundaries.

- [ ] **Step 5: Correct file-operation outcomes**

Use:

~~~js
function isAbort(error) {
  return error && error.name === "AbortError";
}

function fileError(action, error) {
  if (isAbort(error)) return;
  showAlert(
    "Could not " + action + " this UTF-8 plain-text file. " +
    (error && error.message ? error.message : "The browser did not provide a reason."),
  );
}
~~~

Use one writer so Save As does not mutate document identity before success:

~~~js
async function writeToHandle(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

async function save() {
  if (!doc.handle) return saveAs();
  try {
    await writeToHandle(doc.handle, doc.text);
    markClean();
    persistNow();
    editor.focus();
  } catch (error) {
    fileError("save", error);
  }
}

async function saveAs() {
  const suggested = doc.name === "Untitled" ? "Untitled.md" : doc.name;
  if (!window.showSaveFilePicker) {
    downloadCopy(suggested);
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: suggested,
      types: FILE_TYPES,
    });
    await writeToHandle(handle, doc.text);
    doc.handle = handle;
    doc.name = handle.name || suggested;
    markClean();
    renderTitle();
    persistNow();
    editor.focus();
  } catch (error) {
    fileError("save", error);
  }
}

function downloadCopy(suggested) {
  const url = URL.createObjectURL(
    new Blob([doc.text], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = suggested;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  markClean();
  persistNow();
  editor.focus();
}
~~~

Requirements for the revised handlers:

- showOpenFilePicker cancellation returns silently;
- a genuine picker failure shows one alert and does not trigger filePicker;
- file input and drop read errors keep all document state;
- createWritable, write, and close failures do not mark clean or change the
  document's handle or title;
- Save As writes to the candidate handle first, then assigns doc.handle and
  doc.name and calls markClean only after writable.close succeeds;
- successful connected-file close calls markClean;
- successful download click initiation calls markClean and labels the action
  Download a copy, but does not assign a connected handle or rename the current
  document;
- URL.revokeObjectURL runs after the click;
- unsupported connected-file APIs use the explicit file input/download path.

In COMMANDS, expose the fallback honestly:

~~~js
{
  title: () =>
    window.showSaveFilePicker ? "Save As" : "Download a copy",
  keys: SHIFT + CMD + "S",
  run: saveAs,
},
~~~

- [ ] **Step 6: Verify healthy, quota, blocked, and file paths**

Run:

    node --test tests/verify.mjs

Manual browser checks:

1. Normal edits recover after reload and do not show a warning.
2. Override storage writes in DevTools to fail once; oldest history half is removed and current text recovery is retried.
3. Continue failing recovery writes; the exact persistent warning appears and history pauses.
4. Restore writes; the warning clears and history resumes.
5. While recovery is healthy, dirty close/reload has no beforeunload prompt.
6. While recovery is unhealthy and dirty, close/reload invokes the browser warning.
7. Connected save success marks clean; cancel and failure do not.
8. Download a copy marks the exported version clean; the next edit becomes dirty.

- [ ] **Step 7: Commit persistence reliability**

Run:

    git diff --check
    git add index.html tests/verify.mjs
    git commit -m "fix: surface recovery and file failures"

## Task 5: Validate and Roll Large Writing Sessions

**Files:**

- Modify: index.html
- Modify: tests/verify.mjs

- [ ] **Step 1: Add failing bounded-number and session-UI tests**

Append:

~~~js
test("session numbers are finite bounded positive integers", () => {
  const html = readApp();
  const { parseBoundedInteger } = extractTestableLogic(html, [
    "parseBoundedInteger",
  ]);
  assert.equal(parseBoundedInteger("1", 10), 1);
  assert.equal(parseBoundedInteger("10", 10), 10);
  assert.equal(parseBoundedInteger("", 10), null);
  assert.equal(parseBoundedInteger("0", 10), null);
  assert.equal(parseBoundedInteger("-1", 10), null);
  assert.equal(parseBoundedInteger("1.5", 10), null);
  assert.equal(parseBoundedInteger("1e309", 10), null);
  assert.equal(parseBoundedInteger("11", 10), null);
});

test("session form exposes limits, errors, and a rolling window", () => {
  const html = readApp();
  assert.match(html, /id="goalAmount"[^>]*max="1000000"/);
  assert.match(html, /id="goalMinutes"[^>]*max="1440"/);
  assert.match(html, /id="sessionError"[^>]*role="alert"/);
  assert.match(html, /windowBaseline/);
});
~~~

Run:

    node --test tests/verify.mjs

Expected: FAIL on the missing helper, max attributes, error region, and rolling-window state.

- [ ] **Step 2: Add bounded integer parsing**

Inside the testable block add:

~~~js
function parseBoundedInteger(value, maximum) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number)) return null;
  if (number < 1 || number > maximum) return null;
  return number;
}
~~~

Set goalAmount max="1000000" and step="1"; set goalMinutes max="1440" and step="1". Add:

~~~html
<p id="sessionError" class="note error" role="alert" hidden></p>
~~~

Start only when both values parse. Keep the dialog open and show:

    Enter a whole-number goal from 1 to 1,000,000 and a duration from 1 to 1,440 minutes.

Clear the error on valid start and when reopening the dialog.

Validate recovery data with the same bounds:

~~~js
function restoreSession() {
  let saved = null;
  try {
    saved = JSON.parse(store.get(K.session) || "null");
  } catch (_) {}

  const goal = saved
    ? parseBoundedInteger(String(saved.goal), 1_000_000)
    : null;
  const minutes = saved
    ? parseBoundedInteger(String(saved.minutes), 1_440)
    : null;
  const unitIsValid =
    saved && (saved.unit === "words" || saved.unit === "characters");
  const timingIsValid =
    saved &&
    Number.isInteger(saved.baseline) &&
    saved.baseline >= 0 &&
    Number.isFinite(saved.startedAt) &&
    saved.startedAt > 0 &&
    Number.isFinite(saved.endsAt) &&
    saved.endsAt >= saved.startedAt;
  const finishedIsValid =
    saved &&
    (saved.finished == null ||
      ((saved.finished.reason === "goal" ||
        saved.finished.reason === "time") &&
        Number.isFinite(saved.finished.count) &&
        Number.isFinite(saved.finished.elapsed)));

  if (
    !goal ||
    !minutes ||
    !unitIsValid ||
    !timingIsValid ||
    !finishedIsValid
  ) {
    store.del(K.session);
    return;
  }
  startSession(goal, saved.unit, minutes, saved);
}
~~~

- [ ] **Step 3: Convert the CAP into a rolling visual window**

Add session.windowBaseline. Rework buildBars so it draws only the remaining visible window:

~~~js
function buildBars() {
  const fill = $("ghostFill");
  session.windowBaseline = sessionProgress();
  session.bars = [];
  session.cum = [];
  session.spent = 0;
  if (!session.active) {
    fill.textContent = "";
    $("ghost").hidden = true;
    return;
  }

  measureAverage();
  const remaining = Math.max(0, session.goal - session.windowBaseline);
  const visibleUnits = Math.min(CAP, remaining);
  const next = seeded(0x51ff ^ session.goal ^ session.windowBaseline);
  let html = "";
  let units = 0;
  while (session.bars.length < CAP && units < visibleUnits) {
    const len = LENGTHS[Math.floor(next() * LENGTHS.length)];
    units += session.unit === "words" ? 1 : len + 1;
    session.cum.push(units);
    session.bars.push(true);
    html +=
      '<span class="w"><i style="width:' +
      Math.round(len * session.avg) +
      'px"></i> </span>';
  }
  fill.innerHTML = html;
  session.bars = Array.prototype.slice.call(fill.children);
  $("ghost").hidden = false;
  paintBars();
}

function paintBars() {
  const progress = sessionProgress();
  const relative = Math.max(0, progress - session.windowBaseline);
  if (
    progress < session.windowBaseline ||
    (relative >= CAP && progress < session.goal)
  ) {
    buildBars();
    return;
  }
  let target = session.spent;
  while (
    target < session.bars.length &&
    session.cum[target] <= relative
  ) target += 1;
  while (target > 0 && session.cum[target - 1] > relative) target -= 1;
  while (session.spent < target) {
    session.bars[session.spent].style.display = "none";
    session.spent += 1;
  }
  while (session.spent > target) {
    session.spent -= 1;
    session.bars[session.spent].style.display = "";
  }
}
~~~

Replace the existing buildBars and paintBars functions with these versions.
Count, completion, and pace continue to use sessionProgress against the full
goal. Restored sessions rebuild the window at restored progress.

- [ ] **Step 4: Verify session edge cases**

Run:

    node --test tests/verify.mjs

Manual checks:

1. Blank, zero, negative, decimal, infinite, and out-of-range values keep the dialog open with the inline error.
2. Goal 1 and duration 1 start.
3. Goal 1,000,000 and duration 1,440 start without a large DOM allocation.
4. A 2,500-word goal rolls the ghost window after CAP and does not appear complete at 1,200.
5. Goal completion and time expiration each announce once.
6. Reload restores an active session with the correct remaining goal and deadline.
7. Character goals retain JavaScript string-unit counting.

- [ ] **Step 5: Commit writing-session corrections**

Run:

    git diff --check
    git add index.html tests/verify.mjs
    git commit -m "fix: validate and roll writing goals"

## Task 6: Harden Responsive Layout and Theme Contrast

**Files:**

- Modify: index.html
- Modify: tests/verify.mjs

- [ ] **Step 1: Add failing CSS and contrast checks**

Append:

~~~js
function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const parts = hex.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16));
  return 0.2126 * channel(parts[0]) +
    0.7152 * channel(parts[1]) +
    0.0722 * channel(parts[2]);
}

function contrast(a, b) {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

test("secondary theme text meets normal-text contrast", () => {
  const html = readApp();
  const script = extractInlineScript(html);
  const themes = [...script.matchAll(
    /\b(linen|graphite):\s*\{[^}]*bg:\s*"(#[0-9a-f]{6})"[^}]*sec:\s*"(#[0-9a-f]{6})"/gi,
  )];
  assert.equal(themes.length, 2);
  for (const [, name, background, secondary] of themes) {
    assert.ok(
      contrast(background, secondary) >= 4.5,
      name + " secondary text is below 4.5:1",
    );
  }
});

test("layout accounts for dynamic viewports and device safe areas", () => {
  const html = readApp();
  assert.match(html, /100svh/);
  assert.match(html, /100dvh/);
  assert.match(html, /env\(safe-area-inset-top/);
  assert.match(html, /env\(safe-area-inset-bottom/);
  assert.match(html, /pointer:\s*coarse/);
  assert.match(html, /forced-colors:\s*active/);
});
~~~

Run:

    node --test tests/verify.mjs

Expected: FAIL until both theme values and responsive CSS are present.

- [ ] **Step 2: Correct the two low-contrast theme values**

Replace the complete existing Linen and Graphite theme lines with:

~~~js
linen:     { name: "Linen",     dark: false, bg: "#e8e0d1", fg: "#38332b", sec: "#665f53", sel: "#c2b399" },
graphite:  { name: "Graphite",  dark: true,  bg: "#21211f", fg: "#c2bfb8", sec: "#918e85", sel: "#4f4d45" },
~~~

These combinations must remain at or above 4.5:1 against their existing
backgrounds; the verifier calculates the exact ratio.

- [ ] **Step 3: Add viewport and safe-area foundations**

Add CSS custom properties and ordered fallbacks:

~~~css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
}

html,
body {
  min-height: 100vh;
  min-height: 100svh;
  min-height: 100dvh;
}

body {
  padding:
    var(--safe-top)
    var(--safe-right)
    var(--safe-bottom)
    var(--safe-left);
}

dialog .panel {
  max-height: calc(100dvh - 2rem - var(--safe-top) - var(--safe-bottom));
  overflow: auto;
}
~~~

Adjust the existing title, editor, find bar, clock, count, and pace offsets so each adds the relevant safe-area inset once. Do not double-apply body padding and element offsets; inspect at simulated notches after editing.

- [ ] **Step 4: Add focused mobile adaptations**

Add:

~~~css
@media (max-width: 600px) {
  input,
  select,
  textarea {
    font-size: max(16px, 1em);
  }

  .find {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 0.5rem;
  }
}

@media (pointer: coarse) {
  button,
  select,
  input:not([type="checkbox"]):not([type="radio"]) {
    min-height: 44px;
  }

  .title {
    min-width: 44px;
    min-height: 44px;
  }
}

@media (max-height: 500px) and (orientation: landscape) {
  .editor-wrap {
    padding-top: 2.5rem;
    padding-bottom: calc(2.5rem + var(--safe-bottom));
  }
}

@media (forced-colors: active) {
  button,
  input,
  select,
  dialog {
    border: 1px solid ButtonText;
  }

  :focus-visible {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }
}
~~~

Merge selectors with the existing stylesheet where appropriate. The final find grid must keep all six controls reachable at 320px without horizontal page scrolling.

- [ ] **Step 5: Verify responsive acceptance sizes**

Run:

    node --test tests/verify.mjs

Inspect at:

- 320 by 568 portrait;
- 568 by 320 short landscape;
- 390 by 844 representative phone;
- 768 by 1024 tablet;
- 1440 by 900 desktop;
- desktop at 200% browser zoom;
- coarse pointer emulation;
- forced-colors emulation where supported.

Expected: editor, title, dialogs, find/replace, count, clock, and pace remain visible and usable; no horizontal page scroll; focused mobile fields do not trigger iOS text zoom; desktop measure remains unchanged.

- [ ] **Step 6: Commit responsive and contrast work**

Run:

    git diff --check
    git add index.html tests/verify.mjs
    git commit -m "style: harden responsive editor layout"

## Task 7: Correct Accessibility, Keyboard, and Browser Compatibility

**Files:**

- Modify: index.html
- Modify: tests/verify.mjs

- [ ] **Step 1: Add failing semantics and keyboard checks**

Append:

~~~js
test("dialogs, palette, title, and live output have accessible semantics", () => {
  const html = readApp();
  const dialogs = {
    settings: "settingsTitle",
    history: "historyTitle",
    alert: "alertTitle",
    sessionDlg: "sessionTitle",
    palette: "paletteTitle",
    discardDialog: "discardTitle",
  };
  for (const [id, label] of Object.entries(dialogs)) {
    assert.match(
      html,
      new RegExp(
        '<dialog(?=[^>]*\\bid="' + id +
        '")(?=[^>]*\\baria-labelledby="' + label + '")[^>]*>',
      ),
      id + " dialog needs the expected aria-labelledby",
    );
    assert.match(html, new RegExp('id="' + label + '"'));
  }
  assert.match(html, /id="title"[^>]*aria-label="Open command palette"/);
  assert.match(html, /id="paletteQuery"[^>]*role="combobox"/);
  assert.match(html, /id="paletteList"[^>]*role="listbox"/);
  assert.match(
    html,
    /role="option"|setAttribute\(["']role["'],\s*["']option["']\)/,
  );
  assert.match(html, /id="sessionStatus"[^>]*role="status"/);
  assert.match(html, /<link rel="icon" href="data:,"/);
});

test("keyboard handling preserves browser and focus conventions", () => {
  const html = readApp();
  const script = extractInlineScript(html);
  assert.doesNotMatch(
    script,
    /\.key\s*!==\s*["']Tab["'][\s\S]{0,200}preventDefault/,
  );
  assert.doesNotMatch(
    script,
    /key\s*===\s*["']d["'][\s\S]{0,100}toggleDark/,
  );
  assert.doesNotMatch(
    script,
    /key\s*===\s*["']k["'][\s\S]{0,100}openPalette/,
  );
  assert.match(script, /addListener/);
  assert.match(script, /closest\(\s*["']input, select, textarea, button/);
});
~~~

Run:

    node --test tests/verify.mjs

Expected: FAIL on incomplete dialog labels, palette semantics, title name, live completion status, browser shortcuts, or MediaQueryList fallback.

- [ ] **Step 2: Label every dialog and the title control**

Give each dialog aria-labelledby with these exact targets:

- settings to settingsTitle;
- history to historyTitle;
- alert to alertTitle;
- sessionDlg to sessionTitle;
- palette to paletteTitle;
- discardDialog to discardTitle.

Add the matching ID to each existing heading without changing visible wording.
Because the palette intentionally has no visible heading, add this as its first
child:

~~~html
<h2 id="paletteTitle" class="sr-only">Command palette</h2>
~~~

Set the title button to:

~~~html
<button
  class="title"
  id="title"
  title="Command palette"
  aria-label="Open command palette"
>
  Untitled
</button>
~~~

Use a CSS pseudo-element or child span for a subtle downward chevron. Keep it low contrast but visible in forced colors. Update renderTitle without replacing the button's aria-label.

- [ ] **Step 3: Implement command-palette combobox semantics**

Use:

~~~html
<input
  id="paletteQuery"
  role="combobox"
  aria-autocomplete="list"
  aria-controls="paletteList"
  aria-expanded="false"
  placeholder="Type a command"
  aria-label="Type a command"
>
<ul id="paletteList" role="listbox"></ul>
~~~

In renderPalette, remove aria-selected from the wrapper li and configure each
existing command button before appending it:

~~~js
b.id = "palette-option-" + i;
b.setAttribute("role", "option");
b.setAttribute("aria-selected", String(i === paletteIndex));
~~~

Add:

~~~js
function syncPaletteSelection() {
  const items = $("paletteList").querySelectorAll('[role="option"]');
  items.forEach((item, index) => {
    item.setAttribute("aria-selected", String(index === paletteIndex));
  });
  const active = items[paletteIndex];
  if (active) {
    $("paletteQuery").setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  } else {
    $("paletteQuery").removeAttribute("aria-activedescendant");
  }
}
~~~

Replace movePalette's current child loop with syncPaletteSelection. Call
syncPaletteSelection after rendering and after wrapped Arrow movement.
Set paletteQuery aria-expanded to true in openPalette and false in the
palette's close listener. Enter runs the active command. Add an explicit Escape
branch that closes the palette without running a command. Update the selected
CSS selector from a selected li to:

~~~css
.palette [role="option"][aria-selected="true"],
.palette [role="option"]:hover {
  background: color-mix(in srgb, var(--sec) 14%, transparent);
}
~~~

- [ ] **Step 4: Restore normal Tab and browser shortcuts**

Remove the editor Tab-insertion handler. Remove Ctrl/Cmd+D and Ctrl/Cmd+K overrides so bookmark and browser search/address behavior remains native. Keep intentional app shortcuts.

At the top of the global keydown handler add:

~~~js
const interactive = e.target.closest(
  "input, select, textarea, button, [contenteditable='true']",
);
if (interactive && e.target !== editor) return;
~~~

Palette and find inputs keep their local handlers.

- [ ] **Step 5: Make theme and status controls keyboard-complete**

Keep each swatch a focusable button with role="radio" and aria-checked. Remove
the buildSettings call from each swatch click; setTheme already refreshes the
selected state. Add delegated radiogroup navigation:

~~~js
$("themes").addEventListener("keydown", (event) => {
  const swatches = Array.from(
    $("themes").querySelectorAll(".swatch"),
  );
  const current = swatches.indexOf(document.activeElement);
  if (current < 0) return;

  let next = current;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    next = (current + 1) % swatches.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    next = (current - 1 + swatches.length) % swatches.length;
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = swatches.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  setTheme(swatches[next].dataset.theme);
  swatches[next].focus();
});
~~~

Space and Enter continue to activate the native buttons.

Add:

~~~html
<div id="sessionStatus" class="sr-only" role="status" aria-live="polite"></div>
~~~

Only write a completion or expiration sentence to sessionStatus once in finishSession. Do not make the every-second clock a live region.

Keep persistenceStatus polite. Add:

~~~css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
~~~

- [ ] **Step 6: Add old Safari MediaQueryList fallback and reduced motion**

Replace the unconditional listener with:

~~~js
const onAppearanceChange = () => {
  if (settings.match) applyTheme();
};

if (typeof darkMedia.addEventListener === "function") {
  darkMedia.addEventListener("change", onAppearanceChange);
} else if (typeof darkMedia.addListener === "function") {
  darkMedia.addListener(onAppearanceChange);
}
~~~

Retain or add:

~~~css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
~~~

Add an empty embedded favicon to the document head so browsers do not make a
separate favicon request:

~~~html
<link rel="icon" href="data:,">
~~~

- [ ] **Step 7: Verify keyboard and assistive behavior**

Run:

    node --test tests/verify.mjs

Manual keyboard pass:

1. Tab reaches title, editor-adjacent controls when visible, all dialog controls, swatches, and dialog close actions.
2. Tab in the editor changes focus and does not insert a tab.
3. Ctrl/Cmd+D and Ctrl/Cmd+K remain browser-owned.
4. Title opens the palette without knowing a shortcut.
5. Palette has a correct accessible name, active descendant, option selection, and Arrow/Enter/Escape behavior.
6. Every dialog announces its visible heading.
7. Swatches work with arrows, Home/End, Space, and Enter.
8. Recovery failure and session completion each announce once.
9. Reduced-motion and forced-colors modes retain focus and control boundaries.

- [ ] **Step 8: Commit accessibility and compatibility**

Run:

    git diff --check
    git add index.html tests/verify.mjs
    git commit -m "fix: improve accessible browser controls"

## Task 8: Perform Release Verification and User Visual Acceptance

**Files:**

- Modify: README.md only if verified behavior differs from its compatibility or offline instructions
- Modify: tests/verify.mjs only if a missing deterministic release invariant is discovered

- [ ] **Step 1: Run the complete automated release gate**

Run:

    node --test tests/verify.mjs
    git diff --check
    git status --short

Expected: every test passes, diff check is silent, and status contains only intentional release-verification edits or is clean.

- [ ] **Step 2: Verify the file:// build**

Open the absolute index.html path in a target browser. Confirm edit, reload recovery, guarded New/Open/drop, history restore, Save/Download a copy, find/replace, themes, count, fullscreen fallback, palette, and valid/invalid/restored/large sessions.

In browser network tools, clear the log and reload. Expected: no runtime request beyond the document itself; embedded data font URLs do not make network requests.

- [ ] **Step 3: Verify the HTTP build**

Run:

    python3 -m http.server 4173

Open:

    http://127.0.0.1:4173/

Repeat the smoke test and zero-runtime-network check. Stop the server after the checks.

- [ ] **Step 4: Complete the browser and viewport matrix**

Record pass/fail for:

| Browser | Desktop/mobile | Core edit/recovery | Open/download | Layout | Keyboard/a11y |
|---|---|---:|---:|---:|---:|
| Chrome stable | Desktop | | | | |
| Edge stable | Desktop | | | | |
| Firefox stable | Desktop | | | | |
| Safari stable | macOS | | | | |
| Safari stable | iOS/iPadOS | | | | |
| Chrome stable | Android | | | | |

For browser/device combinations unavailable locally, mark them as user acceptance items rather than claiming a pass.

- [ ] **Step 5: Commit any verification-only corrections**

If README.md or tests/verify.mjs changed:

    node --test tests/verify.mjs
    git diff --check
    git add README.md tests/verify.mjs
    git commit -m "test: verify Plaintext Web v2 release"

If neither file changed, do not create an empty commit.

- [ ] **Step 6: Stop for the user's visual acceptance**

Give the user the file:// and local HTTP URL, list exactly which browser checks were completed, and ask them to inspect the result. Do not start Task 9 until the user explicitly approves the visual build.

## Task 9: Create the Public Repository and Publish GitHub Pages

**Files:**

- Modify: README.md

- [ ] **Step 1: Re-run the release gate after user approval**

Run:

    node --test tests/verify.mjs
    git diff --check
    git status --short

Expected: all tests pass and the worktree is clean.

- [ ] **Step 2: Confirm GitHub identity and repository-name safety**

Run:

    gh auth status
    gh api user --jq .login

Expected login: dusterbloom. If a different account is active, stop and ask the
user to confirm the account. Then run:

    gh repo view dusterbloom/plaintext-web

Expected: repository not found. If a repository exists, inspect it read-only
and stop; do not push, rename, delete, or overwrite it without user direction.

- [ ] **Step 3: Create and push the public repository**

Run:

    gh repo create plaintext-web --public --source=. --remote=origin --push

Expected: origin points to the authenticated owner's public plaintext-web repository and main is pushed.

- [ ] **Step 4: Enable Pages from the main-branch root**

Run:

    gh api --method POST repos/dusterbloom/plaintext-web/pages -f "source[branch]=main" -f "source[path]=/"
    gh api repos/dusterbloom/plaintext-web/pages --jq .html_url

Expected URL: https://dusterbloom.github.io/plaintext-web/. If the POST reports
that Pages already exists, read the current configuration and change it only
if it does not use main and root.

- [ ] **Step 5: Put the real demo URL in README.md**

Replace the final sentence under Try it with:

~~~md
Open the [live demo](https://dusterbloom.github.io/plaintext-web/), or download
index.html and open it locally.
~~~

Run:

    node --test tests/verify.mjs
    git diff --check
    git add README.md
    git commit -m "docs: link live Plaintext Web demo"
    git push

- [ ] **Step 6: Verify the deployed artifact**

Poll the Pages URL with a normal GET until GitHub returns HTTP 200, allowing for deployment delay. Confirm the returned HTML includes all of:

- id="editor";
- id="legalNotices";
- Local recovery unavailable—save to a file.;
- four @font-face declarations;
- no external runtime resource elements.

Open the live URL in a browser, perform an edit/reload smoke test, and confirm the network panel shows no runtime requests after the document.

- [ ] **Step 7: Prepare the upstream-author message**

Provide, but do not send without the user's request, this concise draft with the exact URLs filled in:

~~~text
Hi JP — your Plaintext editor inspired me to build an unofficial single-file
web adaptation. It runs fully offline, keeps its fonts and code in one HTML
file, and adds guarded file flows, local recovery, responsive browser support,
accessibility improvements, and writing sessions.

Demo: https://dusterbloom.github.io/plaintext-web/
Source: https://github.com/dusterbloom/plaintext-web
Upstream inspiration: https://github.com/veorq/Plaintext

Thank you for making and sharing Plaintext.
~~~

Confirm both URLs resolve before presenting the draft.

## Final Release Gate

- [ ] index.html is the only runtime artifact and works through file://.
- [ ] node --test tests/verify.mjs passes.
- [ ] Git working tree is clean.
- [ ] No runtime network dependency exists.
- [ ] New, Open, drop, and restore cannot silently replace dirty work.
- [ ] Recovery failure is visible, retryable, and protected by beforeunload only when necessary.
- [ ] File cancellation is silent and real failures are visible.
- [ ] Large writing goals retain correct completion and rolling ghost feedback.
- [ ] 320px, short-landscape, tablet, desktop, and 200% zoom layouts are usable.
- [ ] Keyboard, dialog, palette, swatch, live-status, forced-colors, and reduced-motion checks pass.
- [ ] MIT, OFL, upstream credit, and unofficial-adaptation language exist in both repository and standalone file.
- [ ] The user has approved the visual build.
- [ ] GitHub Pages returns the verified current index.html.
- [ ] The author message contains the final demo and source URLs and remains unsent until requested.
