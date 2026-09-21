# Durable autosave design

**Date:** 2026-09-21  
**Projects:** Plaintext Web and Ledger  
**Status:** Approved for implementation planning

## Goal

Users must not lose their work when Chrome clears, migrates, corrupts, or replaces
site storage. Plaintext's current localStorage autosave is a working cache, not a
backup. A user-selected workspace directory is the durable source of truth.

This design targets installed Chrome apps and browsers that implement the File
System Access API. A browser that cannot write to a user-selected location cannot
provide the required guarantee and must remain read-only.

## Shared durability contract

1. Editing is locked until the user selects or reconnects one durable workspace
   directory.
2. Selection is initiated by an explicit user action, as required by browser
   security.
3. Every persisted revision has a stable revision ID, timestamp, schema version,
   and content digest in its recovery metadata.
4. A revision is reported as saved only after the Markdown write is closed and
   verified and the browser cache records the same revision.
5. The UI always exposes one of four states: `Connecting`, `Saving`, `Saved to
   disk`, or `Backup disconnected`.
6. Permission loss or an I/O failure immediately changes the state to `Backup
   disconnected`; further edits are locked until reconnection.
7. On startup, the app compares valid disk and browser revisions. It restores the
   newer revision when ancestry is clear. Divergent revisions are presented to
   the user; neither copy is overwritten silently.
8. Immutable recovery snapshots are created at session start, before conflict
   resolution, and at least daily while changes continue. The first release does
   not delete snapshots automatically.
9. Manual Save As and Download remain available as additional portable backup
   mechanisms.

The workspace handle may be cached in IndexedDB for convenience. Losing browser
storage can therefore require the user to reconnect the directory, but it cannot
destroy the external copies.

## Plaintext layout and behavior

The user selects one workspace directory. Plaintext creates the editable Markdown
document and recovery data inside it:

```text
Plaintext/
  document.md
  recovery/
    latest.json
    snapshots/
      2026-09-21T19-30-00.000Z-<revision>.md
      2026-09-21T19-30-00.000Z-<revision>.json
```

The Markdown document remains ordinary UTF-8 text and may be renamed through the
app. Opening a file outside the workspace imports it into the durable document;
the app never implies that an arbitrary external file is protected by the
workspace. `latest.json` stores revision, digest, timestamp, document identity,
and format metadata; it does not become a second editable document.

Input updates the editor immediately and schedules a serialized disk write. The
normal debounce remains one second. Navigation, visibility changes, and explicit
save trigger an immediate flush attempt. A newer edit cannot be marked saved by
completion of an older write. The Markdown write becomes authoritative only after
`createWritable()`, `close()`, and read-back digest validation succeed. Recovery
metadata and the browser cache are then advanced to the same revision.

Plaintext keeps its current in-browser history as a convenience, but that history
does not satisfy the durability contract. Undo and history remain available only
for states whose persistence status is accurately represented.

## Ledger contract

Ledger implements the same contract in its own repository. It mirrors complete
portable JSON revisions to `Ledger/latest.json`, retains immutable snapshots, and
does not permit fragment mutations while durable backup is disconnected.

## Recovery and conflicts

Startup considers four cases:

- Disk only: restore disk into the browser cache.
- Browser only: require durable targets, snapshot the browser revision, then write
  it to disk before enabling edits.
- Same revision: open normally.
- Different revisions: preserve both, show timestamps and summaries, and require
  an explicit choice or merge.

Malformed or digest-invalid metadata is never trusted automatically. Existing
Markdown remains readable and untouched. A valid snapshot can restore the active
document, but restoration first snapshots every valid conflicting state.

## Tests

Implementation follows red-to-green TDD. Automated tests cover:

- first launch and reconnection gating;
- unsupported File System Access API behavior;
- successful disk persistence and truthful status transitions;
- rapid typing and out-of-order write completion;
- permission revocation and external I/O failure;
- interruption before `close()` and failed read-back validation;
- browser storage deletion followed by disk restoration;
- disk deletion with a valid browser revision;
- equal, newer, stale, divergent, malformed, and digest-invalid revisions;
- session-start and daily snapshot creation;
- existing open, Save As, download, history, and recovery behavior;
- multi-tab writes without lost updates;
- page-hide and visibility flush behavior.

Tests use fake filesystem handles for deterministic failures and a real temporary
directory where the browser harness supports it. All existing editing, history,
audio, appearance, file-open, and persistence tests remain green.

## Non-goals

- Cloud synchronization.
- Silent writes without user-granted filesystem access.
- Treating OPFS, IndexedDB, localStorage, or Cache Storage as backups.
- Automatic snapshot deletion in the first release.
- A native companion process or browser extension.
