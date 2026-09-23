# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Plaintext Web is an unofficial, dependency-free web adaptation of JP Aumasson's
Plaintext (a Swift/macOS editor). The whole app ships as **one self-contained
file, `index.html`**: inline CSS, markup, and a single inline `<script>`, with
fonts and a sound embedded as base64. There is no build step, no
`package.json`, and no dependencies.

GitHub Pages serves the root of `main` (https://dusterbloom.github.io/plaintext-web/)
and there is no CI. Every push to `main` is a release, so run the tests first.

## Commands

```bash
node --test tests/verify.mjs                               # full suite (Node 22+)
node --test --test-name-pattern='durable' tests/verify.mjs # only tests whose name matches
git diff --check                                           # whitespace gate used by past plans
python3 -m http.server 8765 --bind 127.0.0.1               # serve locally (same as .claude/launch.json)
```

`node --test tests/` fails on Node 22: pass the file path. You can also open
`index.html` from disk, but some browsers block localStorage there and show
"Local recovery unavailable".

## Editing `index.html`

- Lines 12–15 are the four base64 WOFF2 `@font-face` rules (28–60 KB per
  line). `TAP_AUDIO_BASE64` (line ~419) is the embedded MP3. Read the file with
  `offset`/`limit` that skip these lines, and never rewrite or reformat them.
  Tests require exactly 4 `@font-face` rules and 4 woff2 data URLs, and they pin
  the MP3's byte length and SHA-256.
- The app must make zero runtime network requests. Tests reject `fetch`, XHR,
  WebSocket, EventSource, `sendBeacon`, and any external
  `src`/`href`/`url(http…)`.
- `<template id="legalNotices">` must contain `LICENSE`,
  `THIRD_PARTY_NOTICES.md` and every `ThirdPartyLicenses/*` file verbatim. If
  you change a licence file, update the template too. The attribution strings
  (`JP Aumasson`, `github.com/veorq/Plaintext`, "unofficial web adaptation")
  are tested.
- Themes, fonts, and the typewriter synthesis are ported from the upstream
  Swift app (`Models.swift`, `TypewriterSoundPlayer.swift`), so keep the values
  faithful. The untouched upstream build is in the first commit:
  `git show 37cf7f1:plaintext.html`.

## Script architecture

Everything lives in one strict-mode IIFE, in this order:

1. `store`: a localStorage wrapper that falls back to an in-memory `Map`.
2. `K`: every storage key.
3. The `/* @testable:start */ … /* @testable:end */` block of pure functions.
4. Themes and settings, then sound, then `doc` state.
5. The durable workspace.
6. Rendering, then edits/undo/autosave.
7. History, files, find, dialogs, settings, and the palette.
8. Input wiring, then writing sessions.
9. The startup sequence, at the bottom.

State is held in module-level objects:

- `settings`
- `doc`: text, `cleanText`, name, external file `handle`, local `history`, `undo`/`redo`
- `persistence`: localStorage health
- `durableState`: `kind`, workspace handles, `revision`, `digest`, and a serialized write `queue`
- `session`: the writing goal

**There are three persistence layers. Don't conflate them.**

1. **Workspace on disk (source of truth, desktop Chromium only).**
   - Uses the File System Access API. The user picks a parent folder, and
     `createPlaintextWorkspace` creates:
     - `Plaintext/document.md`
     - `recovery/latest.json`: a revision record with `format`, `version`,
       `name`, `savedAt`, `revision`, `parentDigest`, SHA-256 `digest`, and
       `text`
     - `recovery/snapshots/`
   - Every write goes through `writeVerifiedFile`, which writes, closes, reads
     the file back, and compares. `K.durable` is updated only after a
     verified write.
   - Writes are chained on `durableState.queue`, and are skipped when the
     text and name match `queuedText`/`queuedName`. Any failure flips the
     state to disconnected and disables the editor.
   - On connect, `compareDocumentRevisions(disk, cache from K.durable)` picks
     disk, browser, or conflict.
2. **localStorage cache.**
   - `K.recovery`: the current text.
   - `K.history`: at most 80 versions and 1.5 MB.
   - `K.clean`: a fingerprint of the last text saved to a file.
   - `K.durable`: the last verified disk record.
   - Settings and the session.
3. **Optional external file.** This is `doc.handle`, set by Open or Save As.
   It is separate from the workspace, and Cmd+S writes to it.

`persistNow()` is the single fan-out point. It writes localStorage recovery
and history and, when a workspace is connected, queues a disk revision. It runs
1 s after the last edit and again on `pagehide`, `visibilitychange`, and
`beforeunload`.

**Keep the writing surface free of chrome.** Distraction-free writing is the
product. New controls go in the command palette (`COMMANDS`), not on the page.
Status appears only when the writer has to act.

- **Locking:** editing starts locked (`editor.disabled = true`). The only way
  in is the palette's first command ("Connect workspace…", or "Change
  workspace folder…" once connected), which runs `connectWorkspace()`.
  Cancelling the folder picker changes nothing. At launch `restoreWorkspace()` reuses the folder handle saved in IndexedDB: it reconnects silently if permission is still granted, otherwise the menu offers "Reconnect to …" (`reconnectWorkspace()` calls `requestPermission` before any await, so the menu click still counts as a user gesture).
- **Status line:** `#persistenceStatus` renders
  `durableState.notice || persistence.notice` and stays hidden while saves
  succeed.
- **Close guard:** `beforeunload` prompts while `pendingDiskWrites > 0`.
- **Known leak:** the lock covers the textarea only. Commands such as undo,
  New/Open, Replace All, and history restore still change `doc` while locked.

The durable-autosave spec (`docs/superpowers/specs/2026-09-21-durable-autosave-design.md`)
is only partly implemented. Check the code before assuming spec behaviour. The
current gaps:

- Conflicts are resolved with `window.confirm`.
- Every changed write creates a snapshot.
- Only picker cancellation is tested; lock and conflict have no tests.

Other wiring:

- **Palette and shortcuts:** the `COMMANDS` array drives the palette (a `title`
  may be a function). Keyboard shortcuts are wired separately in the
  `document` `keydown` handler, so a new command usually needs both.
- **Document replacement:** `replaceDocument()` is the only path for New, Open,
  and drop. It goes through `confirmDiscard()`.
- **Dialogs:** these are native `<dialog>` elements shown with `showModal()`.
  `[data-close]` buttons and backdrop clicks close them, and closing refocuses
  the editor.

## Tests (`tests/verify.mjs`, Node stdlib only)

The tests read `index.html` as text and use three techniques:

1. **`extractTestableLogic(html, names)`** evaluates the `@testable` block with
   `new Function` and returns the named functions. Code in that block must be
   pure: no `$`, DOM, `doc`, `store`, or `window`. Inject dependencies as
   parameters, as `createSoundPlayer(now, createContext, getMode, tapBytes)`,
   `writeRecoveryWithFallback(storage, keys, …)`, and `digestText(text, subtle)` do.
2. **`extractFunctionSource(html, name)`** slices a top-level `function name(`
   by counting braces and runs it against a fake context (see
   `writingSessionHarness`). A brace inside a string or regex in that function
   breaks the slicing.
3. **Regex assertions over markup, CSS, and source.** These cover ids, aria
   attributes, the contents of specific `@media` blocks, the `bg:`…`sec:` order
   in `THEMES`, and a few exact code shapes. Before renaming an id or
   reformatting a snippet, run `rg` for it in the test file.

For new logic, prefer a pure `@testable` function with injected dependencies
and a behavioural test over another regex on the source.

To try the workspace flow in a browser without a native folder picker, stub it
in DevTools: `window.showDirectoryPicker = async () => navigator.storage.getDirectory()`.
This uses the browser's private OPFS directory as the folder.

## Conventions

- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `style:`,
  `chore:`), in small focused commits.
- The workflow is spec, then plan, then TDD red/green:
  - Specs go in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`,
    named `YYYY-MM-DD-<topic>[-design].md`.
  - Per-task reports go in `.superpowers/`.
  - Both directories are gitignored and exist only locally.
- Durable editing requires `window.showDirectoryPicker`, so other browsers are
  read-only by design (README). This conflicts with the v2 design
  (`docs/superpowers/specs/2026-09-01-plaintext-web-v2-design.md`), which
  requires editing on Firefox, Safari, iOS, and Android.
