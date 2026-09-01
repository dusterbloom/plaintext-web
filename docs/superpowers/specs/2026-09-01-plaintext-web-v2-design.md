# Plaintext Web v2 Design

Date: 2026-09-01  
Status: Approved design, pending implementation plan

## Context

Plaintext Web is a self-contained browser adaptation of JP Aumasson's
[Plaintext](https://github.com/veorq/Plaintext), a quiet, fullscreen-first
plain-text editor. The current web build already works without a server and
bundles its four typefaces, CSS, and JavaScript into one HTML file. It adds
browser file operations, system-theme matching, and goal-based writing
sessions to the upstream editor model.

The v2 work is a surgical reliability and usability pass. It must make the
existing application safe to publish and pleasant on current desktop and
mobile browsers without turning it into a framework project or changing its
quiet visual identity.

## Goals

- Keep the distributed application as one self-contained HTML file.
- Preserve the named editor feature set and the existing visual character.
- Prevent accidental document loss during New, Open, drop, and restore flows.
- Make local recovery failure visible and recover from storage quota pressure
  when possible.
- Correct writing-session limits and placeholder behavior.
- Work well across current desktop and mobile browser viewport sizes.
- Meet essential keyboard and screen-reader accessibility expectations.
- Publish a clearly attributed public repository and GitHub Pages demo.
- Leave behind a small, repeatable release verification process.

## Non-goals

- Speech-to-text or downloadable transcription models.
- A service worker, installable PWA, or offline caching of the hosted page.
- IndexedDB, OPFS, cloud sync, accounts, or multi-document storage.
- A framework, package manager, bundler, or generated release artifact.
- Rich text, Markdown preview, syntax highlighting, spellcheck, or network
  services.
- Legacy Internet Explorer or obsolete mobile-browser support.

Offline transcription is a separate project after this baseline ships. It has
independent microphone, model-cache, worker, memory, and browser-compatibility
decisions and must not destabilize v2.

## Distribution and repository structure

`index.html` is the application and the GitHub Pages entry point. It contains
all runtime HTML, CSS, JavaScript, fonts, and licensing notices. It makes no
runtime network requests and can be opened directly with a `file://` URL.

The repository may contain supporting files that are not needed at runtime:

- `README.md`
- `LICENSE`
- `THIRD_PARTY_NOTICES.md`
- `ThirdPartyLicenses/`
- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `tests/verify.mjs`

The untouched source build is preserved in the repository's first commit.
Implementation renames the working application from `plaintext.html` to
`index.html`; Git history remains the original comparison point.

## Runtime architecture

The implementation remains dependency-free and directly maintained inside
`index.html`. Existing sections stay grouped by responsibility: storage,
themes, document state, editing/history, file operations, dialogs, command
palette, input wiring, and writing sessions.

Small helpers are introduced only where they centralize behavior that is
currently duplicated or unsafe:

- document dirty-state calculation;
- guarded document replacement;
- persistence health and status rendering;
- finite bounded number parsing;
- rolling writing-session placeholder generation.

No generic component layer, event bus, class hierarchy, or internal module
system is added.

## Document state and dirty tracking

The document state distinguishes three concepts:

1. `text`: the current editor contents.
2. recovery text: the latest successful local browser recovery copy.
3. clean text: the contents last explicitly opened, written to a file, or
   exported through the download fallback.

In memory, dirty state is `text !== cleanText`. A compact clean fingerprint is
persisted so a reload can recognize content that was explicitly saved without
duplicating the entire document in local storage. Recovered text with no
matching clean fingerprint is treated as unsaved.

Editing updates text, Undo/Redo state, word/session counts, and the debounced
recovery schedule. Local recovery does not mark a document clean. A successful
file write or initiated fallback download updates the clean text and
fingerprint. Failed or cancelled file operations do not.

## Guarded document transitions

New, Open, file-input selection, drag/drop, and history restoration route
through one shared transition guard.

- Empty or clean documents transition immediately.
- Dirty documents open a modal with **Cancel** as the initial safe action and
  **Discard changes** as the explicit destructive action.
- Opening a file asks the user to select/read the candidate first, then applies
  the guard immediately before replacement. Cancelling selection never causes
  a warning.
- A dropped file follows the same candidate-read and guard path.
- Restoring history snapshots the current text before replacement, ensuring
  the pre-restore state remains recoverable through history and Undo.
- Confirming New, Open, or drop ends an active writing session and then resets
  document-specific history, Undo, file handle, title, and clean state
  together. History restore keeps the current document identity and history;
  it only replaces text after preserving the pre-restore state.

The application does not show an unload warning while local recovery is
healthy. If recovery is unhealthy and the document is dirty, the standard
browser `beforeunload` warning is enabled as a last-resort safety net.

## Persistence and failure handling

The existing localStorage design remains, including its in-memory fallback.
Persistence is ordered by importance:

1. Write current recovery text.
2. Write document metadata and clean fingerprint.
3. Write a history snapshot when needed.
4. Trim history to the existing count and storage budget.

If the recovery write fails, the application drops the oldest half of history,
persists the shortened history (deleting the history key if even that fails),
and retries recovery once. If recovery succeeds, a restrained status tells the
user that older versions were removed to preserve the current document. If it
still fails, history writes pause until a later recovery succeeds and a
persistent, accessible status says: "Local recovery unavailable—save to a
file."

The status remains until a later recovery write succeeds. It is visible but
subordinate to the document title and uses `role="status"` without announcing
every normal autosave. The settings storage note remains as supporting detail.

Persistence runs after the existing debounce and on `visibilitychange`,
`pagehide`, and explicit save/transition boundaries. Errors never change the
clean fingerprint, file title, or success status.

## File operations

The File System Access API remains a Chromium enhancement. File input and
download remain the universal fallback.

- Abort/cancel exits silently.
- A genuine file-picker or file-read failure shows a clear UTF-8 plain-text
  error and does not silently open a second picker.
- A successful connected-file write marks the document clean.
- The fallback action is named and described as "Download a copy" so it does
  not imply an ongoing connection to the downloaded file.
- Download initiation marks the current text as the last exported version;
  subsequent edits become dirty again.
- Unsupported fullscreen and file APIs fail quietly while their fallback path
  remains usable.

## Writing sessions

Goal and duration inputs are validated in HTML and JavaScript. Values must be
finite positive integers. Goals are bounded at 1,000,000 words or characters;
duration is bounded at 1,440 minutes. Invalid values keep the session dialog
open and show an inline error instead of silently coercing to unexpected
values.

The visual placeholder cap remains a performance limit, not a goal limit. The
ghost layer shows at most the next `CAP` units. As the visible window is
consumed, it rebuilds from the remaining goal so goals above 1,200 words never
appear visually complete early. Count and pace calculations always use the
full goal.

Character goals continue to count JavaScript string units in v2 to preserve
existing behavior. Grapheme-aware counting is deferred until multilingual
requirements justify the extra code.

## Responsive behavior

The layout uses conventional viewport-height fallbacks followed by `svh` and
`dvh` where available. Safe-area environment insets protect the title, editor,
find UI, clock, count, and pace indicator on notched and home-indicator devices.

The existing 760px reading width, type scale, and spacious desktop layout stay
unchanged. Mobile adjustments are limited to:

- 16px minimum text in focused form controls to prevent iOS page zoom;
- approximately 44px pointer targets on coarse-pointer devices;
- a compact grid for find/replace rather than uncontrolled wrapping;
- smaller vertical editor padding in short landscape viewports;
- dialog sizing based on dynamic viewport height;
- bottom readouts positioned above safe areas and virtual-keyboard resizing.

The title remains visually quiet but gains a subtle chevron, an accessible
"Open command palette" name, and a larger touch target. No persistent toolbar
is introduced.

## Accessibility and browser interaction

- `Tab` performs standard focus navigation instead of inserting a tab and
  trapping keyboard users in the editor.
- Every dialog has an explicit accessible label.
- The command palette exposes combobox/listbox/option semantics, active option
  state, and predictable arrow/Enter/Escape behavior.
- Persistence warnings and writing-session completion are announced through
  restrained live regions.
- Theme swatches retain keyboard focus and expose selected state correctly.
- Linen and Graphite secondary colors are adjusted to at least 4.5:1 contrast
  against their backgrounds at the existing small text sizes.
- Forced-colors mode restores native outlines, borders, and readable controls.
- Reduced-motion behavior remains explicit even though animation is minimal.
- System appearance uses modern `MediaQueryList.addEventListener` with the
  older Safari `addListener` fallback.

Browser-hostile overrides for bookmarking and address/search focus are
removed. Core document shortcuts remain, but global handling ignores modal
form controls unless the shortcut is intentionally valid there. The title
button ensures command discovery when a browser reserves a palette shortcut.

## Browser support

Acceptance targets the current stable releases of:

- Chrome and Edge on desktop;
- Firefox on desktop;
- Safari on macOS;
- Safari on iOS/iPadOS;
- Chrome on Android.

Opening, editing, recovery-status reporting, file input, and downloading a
copy must work everywhere in this matrix. Direct connected-file writes are
allowed to remain Chromium-only. The application must start from both
`file://` and GitHub Pages HTTPS. Browsers that block localStorage for local
files must fall back to memory and display the recovery warning.

## Licensing and attribution

The repository and standalone file must not imply affiliation or endorsement.
The README identifies the project as an unofficial web adaptation inspired by
JP Aumasson's Plaintext and links to the upstream repository.

The repository retains the upstream MIT copyright and licence, identifies the
web modifications separately, and includes the upstream third-party notices.
Because the four SIL OFL fonts are embedded in the distributable HTML, the
standalone file includes the relevant attribution and complete MIT/OFL licence
texts in a non-rendered inert template element. A comment cannot safely hold
the exact OFL text because that text contains double hyphens, which HTML comment
syntax forbids. Repository copies remain available for normal human reading.

## Verification

`tests/verify.mjs` uses only Node's standard library. It must fail when:

- `index.html` is missing;
- the inline JavaScript does not parse;
- required application elements or accessibility markers are absent;
- a font is no longer embedded;
- external runtime scripts, stylesheets, fonts, or media are introduced;
- upstream attribution or required licence markers disappear.

Functional acceptance covers:

- recovery after reload and after page visibility changes;
- simulated unavailable/quota-limited storage and visible warning behavior;
- clean versus dirty New/Open/drop/restore transitions;
- successful, cancelled, and failed open/save/download paths;
- Undo/Redo and pre-restore recovery;
- find/replace, themes, count, fullscreen fallback, and command shortcuts;
- valid, invalid, completed, expired, restored, and large writing sessions.

Responsive and accessibility acceptance covers 320px mobile, representative
phones and tablets, short landscape, desktop, 200% zoom, keyboard-only use,
coarse pointer targets, reduced motion, forced colors, and screen-reader names
and status announcements.

Network inspection must show zero runtime requests after the document itself
loads. The final build is tested from disk and through a local HTTP server
before GitHub Pages publication. The user performs the final visual/browser
acceptance pass before public release.

## Release sequence

1. Preserve the untouched original as the first Git commit.
2. Commit this approved design, then commit its implementation plan as the next
   planning checkpoint.
3. Rename the application to `index.html` and implement v2 in focused commits.
4. Run dependency-free verification and the browser acceptance matrix.
5. Obtain the user's visual acceptance.
6. Create and push the public `plaintext-web` GitHub repository.
7. Enable GitHub Pages from the root of `main` and verify the live URL.
8. Prepare a concise message linking the demo, source, upstream inspiration,
   and the major web-specific improvements for the original author.

## Success criteria

v2 is ready to publish when it remains a single offline HTML application,
passes the static and functional checks above, does not silently risk current
text, is usable at the target viewport sizes and input methods, contains clear
licensing and attribution, and has zero runtime network dependencies.
