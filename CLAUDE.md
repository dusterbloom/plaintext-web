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
- `doc`: text, `cleanText`, name, `savedAt`, external file `handle`, `history` (newest first), `undo`/`redo`
- `persistence`: browser-storage health
- `safetyCopy`: `kind`, folder handle, `lastWritten`, and a serialized sync `queue`
- `session`: the writing goal

**There are three persistence layers. Don't conflate them.**

1. **Browser copy (IndexedDB `plaintext`, v2, strict durability).**
   - `state["current"]`: `{ text, name, savedAt }`.
   - `versions` (keyPath `date`): `{ date, text, name, pinned? }`, thinned by
     `keepVersions` (newest per 2 min for an hour, per hour for a day, per day
     for 30 days, then per week). Pinned versions are never thinned.
   - `handles["workspace"]`: the remembered safety-copy folder.
   - `saveBrowserCopy(pin)` is the only writer; `persistNow()` calls it 1 s after
     the last edit and on `pagehide`/`visibilitychange`/`beforeunload`, then
     `syncSafetyCopy()`. Old localStorage text and history are migrated once.
2. **Safety copy (File System Access, desktop Chromium only).**
   - `Plaintext/document.md` and `Plaintext/history/<ISO date>[.pinned].md`.
   - `syncNow()` uses `planDocumentSync`: the browser is current while writing;
     on first contact the newer side wins; the other text always becomes a
     pinned version. `mergeHistory` keeps browser and disk history a thinned
     union, and imports old `recovery/` revisions (including nested
     `Plaintext/Plaintext/…`) once.
   - Editing is never locked. `safetyCopy.kind` is `none`, `paused` (the next
     click or key press re-grants permission), or `on`.
3. **Optional external file.** This is `doc.handle`, set by Open or Save As.
   It is separate from the safety copy, and Cmd+S writes to it.

**Keep the writing surface free of chrome.** Distraction-free writing is the
product. New controls go in the command palette (`COMMANDS`), not on the page.
`#persistenceStatus` appears only when the writer has to act (choose or resume
the safety copy, or browser storage failed).

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
   parameters, as `createSoundPlayer(now, createContext, getMode, tapBytes)` and
   `planDocumentSync(browser, disk, lastWrittenText)` do.
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

`node tests/browser-smoke.mjs` runs `tests/browser-harness.html` in headless
Chromium against a real OPFS folder: migration, connect, outside edits, reload,
and restoring a wiped browser. To try the flow by hand, stub the picker in
DevTools: `window.showDirectoryPicker = async () => navigator.storage.getDirectory()`.

## Conventions

- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `style:`,
  `chore:`), in small focused commits.
- The workflow is spec, then plan, then TDD red/green:
  - Specs go in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`,
    named `YYYY-MM-DD-<topic>[-design].md`.
  - Per-task reports go in `.superpowers/`.
  - Both directories are gitignored and exist only locally.
- Editing works in every browser; only the safety-copy folder needs
  `window.showDirectoryPicker` (desktop Chromium).
