# Plaintext Durable Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a verified external Markdown workspace so browser storage is never Plaintext's only copy.

**Architecture:** Extend the existing one-second autosave with a serialized File System Access writer. A selected `Plaintext` workspace owns `document.md`, revision metadata, and immutable snapshots; localStorage remains only a cache.

**Tech Stack:** HTML, browser JavaScript, localStorage, File System Access API, Web Crypto, Node test runner.

## Global Constraints

- No dependencies or native companion.
- Unsupported browsers are read-only.
- Never report saved before close and read-back validation.
- Never delete recovery snapshots in this release.
- Opening an outside file imports it; it is not silently claimed as protected.

---

### Task 1: Revision metadata and comparison

**Files:** Modify `index.html`; test `tests/verify.mjs`.

**Interfaces:** Produce `digestText(text, subtle)`, `makeDocumentRevision(text, name, now, revision, digest)`, `validateDocumentRevision(value)`, and `compareDocumentRevisions(disk, cache)`.

- [ ] Add failing literal-fixture tests for valid metadata, digest mismatch, same/newer/divergent states, and malformed metadata.
- [ ] Run `node --test tests/verify.mjs`; confirm failure because the interfaces are absent.
- [ ] Implement exact-field validation, SHA-256 through injected Web Crypto, and ancestry comparison.
- [ ] Run the full Node suite and confirm green.
- [ ] Commit with `feat: add Plaintext disk revisions`.

### Task 2: Workspace and verified writes

**Files:** Modify `index.html`; test `tests/verify.mjs`.

**Interfaces:** Produce `createPlaintextWorkspace(directory)`, `writeVerifiedFile(handle, text)`, and `writeDocumentRevision(workspace, snapshot)`.

- [ ] Add failing filesystem-handle fakes proving directory layout, close-before-read, mismatch rejection, and error propagation.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement `Plaintext/document.md`, `recovery/latest.json`, and `recovery/snapshots`; verify every closed write by reading it back.
- [ ] Run focused and complete Node tests.
- [ ] Commit with `feat: verify Plaintext disk writes`.

### Task 3: Mandatory connection and autosave queue

**Files:** Modify `index.html`; test `tests/verify.mjs`.

**Interfaces:** Produce `connectWorkspace()`, async `persistNow()`, `flushPersistence()`, and `durableState = {kind, workspace, revision, queue}`.

- [ ] Add failing tests proving the editor is locked before connection, one-second debounce writes the newest text, stale completions do not mark clean, and permission errors relock editing.
- [ ] Run tests and confirm failures describe the missing contract.
- [ ] Add Connect workspace UI and the four durability statuses; serialize disk writes and update localStorage only to the verified revision.
- [ ] Make visibility/page-hide request an immediate flush without falsely claiming completion after unload.
- [ ] Run `node --test tests/verify.mjs` and commit with `feat: require Plaintext workspace`.

### Task 4: Recovery, conflict UI, and documentation

**Files:** Modify `index.html`, `README.md`; test `tests/verify.mjs`.

**Interfaces:** Consume revision comparison; produce `reconcileWorkspace(disk, cache)` and `writeRecoverySnapshot(workspace, revision)`.

- [ ] Add failing tests for deleted localStorage restored from disk, cache-only recovery, equal revisions, divergent content, corrupt metadata, and session/daily snapshots.
- [ ] Run tests and confirm the recovery cases fail.
- [ ] Implement startup/reconnect recovery, preserve both sides on conflict, and require an explicit user choice.
- [ ] Document workspace contents, reconnect behavior, and unsupported-browser read-only mode.
- [ ] Run the complete Node suite and `git diff --check`.
- [ ] Commit with `feat: recover Plaintext from disk`.

