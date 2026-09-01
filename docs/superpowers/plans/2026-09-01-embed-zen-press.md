# Embedded Zen Press Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the synthetic Soft tap with the exact CC0 UI SFX `zen/press.mp3` while preserving the single-file offline app, browser-safe cancellation, and the existing Typewriter sound.

**Architecture:** Pin and embed the 1,714-byte MP3 as base64 inside `index.html`, decode it lazily through the shared AudioContext, and cache the resulting AudioBuffer. Keep request-token and live-mode checks before and after asynchronous decoding so muted or superseded sounds never play later.

**Tech Stack:** One HTML file, vanilla JavaScript, Web Audio API, embedded MP3 data, Node.js built-in test runner.

## Global Constraints

- Source: `romainsimon/uisfx` commit `99d287a1d27ef49c02a5262184a7fda91612321e`, path `packages/uisfx/sounds/zen/press.mp3`.
- Exact size: 1,714 bytes. Exact SHA-256: `e323f95066734d3fccbb369d18699aba97ac4cea62f09a3fcfa5b27e7c9843a2`.
- Upstream metadata: mono one-shot, 0.155 seconds, default volume `0.2`.
- Embed the asset in `index.html`; add no runtime request, release-side audio file, dependency, or service.
- Keep the label **Soft tap**, stored value `tap`, Typewriter coefficients and gain `0.16`, typing-key set, and 25 ms throttle.
- Preference changes must invalidate resume and decode work already in flight.
- Audio failures must never interrupt typing.
- Add exact UI SFX provenance and CC0 attribution to repository and standalone notices.
- Stop for user audio acceptance before publishing GitHub Pages.

---

### Task 1: Embed and Decode UI SFX Zen Press

**Files:**

- Modify: `index.html`
- Modify: `tests/verify.mjs`
- Modify: `THIRD_PARTY_NOTICES.md`
- Create: `ThirdPartyLicenses/UISFX-CC0.txt`

**Interfaces:**

- Consumes: pinned MP3 bytes, `createSoundPlayer(now, createContext, getMode, tapBytes)`, and `AudioContext.decodeAudioData(arrayBuffer)`.
- Produces: `decodeBase64(base64, decode) -> ArrayBuffer`, `TAP_AUDIO_BASE64`, one cached decoded tap buffer, and complete UI SFX legal provenance.

- [ ] **Step 1: Add failing asset and legal tests**

Import `createHash` from `node:crypto`, add
`ThirdPartyLicenses/UISFX-CC0.txt` to `legalFiles`, and append:

```js
test("soft tap embeds the pinned UI SFX zen press asset", () => {
  const html = readApp();
  const script = extractInlineScript(html);
  const match = html.match(/const TAP_AUDIO_BASE64 = "([A-Za-z0-9+/=]+)";/);
  assert.ok(match, "embedded zen press MP3 is missing");
  const bytes = Buffer.from(match[1], "base64");
  assert.equal(bytes.length, 1714);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "e323f95066734d3fccbb369d18699aba97ac4cea62f09a3fcfa5b27e7c9843a2",
  );
  assert.match(html, /romainsimon\/uisfx/);
  assert.match(html, /packages\/uisfx\/sounds\/zen\/press\.mp3/);
  assert.match(html, /99d287a1d27ef49c02a5262184a7fda91612321e/);
  assert.match(html, /CC0 1\.0/);
  assert.doesNotMatch(script, /function buildTap\s*\(/);
});
```

- [ ] **Step 2: Add failing behavioral decode tests**

First add a pure-decoder test:

```js
test("base64 decoder returns the exact local bytes", () => {
  const { decodeBase64 } = extractTestableLogic(readApp(), ["decodeBase64"]);
  const bytes = new Uint8Array(decodeBase64("AAEC/w==", atob));
  assert.deepEqual([...bytes], [0, 1, 2, 255]);
});
```

Extend `soundHarness` with `decodeAudioData`, a `decodes` counter, a stable
`tapBuffer`, and controllable `resolveDecode` / `rejectDecode` hooks. Have
`decodeAudioData` increment `decodes`, retain the supplied `ArrayBuffer`, and
return one controlled promise. Return those values and hooks from the harness.
Update every tap call to pass a non-null `tapBytes` argument into
`createSoundPlayer`. Add tests proving:

- after the first tap resolves and starts, a second tap at least 25 ms later
  calls `decodeAudioData` only once, reuses the identical `tapBuffer`, and the
  two starts both use gain `0.2`;
- changing injected current mode to Off while decode is pending produces zero
  starts after decode resolves, without requiring a direct `play("off")` call;
- rejected decode and a throw after decode remain contained;
- Typewriter emits immediately without calling `decodeAudioData`.

Use `await new Promise(setImmediate)` after settling controlled promises. Keep
the existing suspended-resume, request invalidation, 25 ms throttle, context
creation failure, and sound-preference tests green; update their tap-specific
buffer assertions to compare against `tapBuffer` and gain `0.2`.

- [ ] **Step 3: Run focused RED**

Run:

```bash
node --test --test-name-pattern='soft tap|UI SFX' tests/verify.mjs
```

Expected: failures for the missing base64 asset, legal file, decode cache,
gain `0.2`, and async cancellation behavior.

- [ ] **Step 4: Retrieve and verify the pinned bytes**

Read the base64 with:

```bash
gh api 'repos/romainsimon/uisfx/contents/packages/uisfx/sounds/zen/press.mp3?ref=99d287a1d27ef49c02a5262184a7fda91612321e' --jq .content
```

Remove only API line wrapping. Verify before editing:

```bash
gh api 'repos/romainsimon/uisfx/contents/packages/uisfx/sounds/zen/press.mp3?ref=99d287a1d27ef49c02a5262184a7fda91612321e' --jq .content | base64 --decode | shasum -a 256
```

Expected output starts with the exact SHA-256 in Global Constraints. Assign the
unwrapped API content to one `const TAP_AUDIO_BASE64` JavaScript string. The
Step 1 test rejects any other bytes.

- [ ] **Step 5: Add the pure local decoder**

Inside the `@testable` block add:

```js
function decodeBase64(base64, decode) {
  const binary = decode(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
```

Pass the locally decoded bytes into production without `fetch`:

```js
const sound = createSoundPlayer(
  () => performance.now(),
  () => new (window.AudioContext || window.webkitAudioContext)(),
  () => settings.sound,
  decodeBase64(TAP_AUDIO_BASE64, atob),
);
```

- [ ] **Step 6: Replace synthetic tap generation with cached MP3 decoding**

Change the factory signature to accept `tapBytes = null`. Delete `buildTap()`
and leave `buildTypewriter()` byte-for-byte unchanged. Add:

```js
let tapBufferPromise = null;

function loadTap() {
  if (!tapBytes) return Promise.reject(new Error("tap audio unavailable"));
  if (!tapBufferPromise) {
    tapBufferPromise = ctx.decodeAudioData(tapBytes.slice(0)).catch((error) => {
      tapBufferPromise = null;
      throw error;
    });
  }
  return tapBufferPromise;
}
```

Keep the current request-token and live-mode guard. Centralize emission and
repeat that guard after decode:

```js
const emit = (buffer, value) => {
  if (current !== request || getMode() !== mode) return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = value;
  src.buffer = buffer;
  src.connect(gain).connect(ctx.destination);
  src.start();
};

if (mode === "tap") {
  void loadTap().then((buffer) => emit(buffer, 0.2)).catch(() => {});
  return;
}
if (!buffers.typewriter) buffers.typewriter = buildTypewriter();
emit(buffers.typewriter, 0.16);
```

Keep the resume chain caught so failures thrown after resumption remain silent.

- [ ] **Step 7: Add exact UI SFX attribution**

Create `ThirdPartyLicenses/UISFX-CC0.txt` with the complete upstream
`LICENSE-AUDIO` text:

```text
UI SFX audio assets are dedicated to the public domain under the Creative
Commons CC0 1.0 Universal Public Domain Dedication.

To the extent possible under law, Yuki Capital has waived all copyright and
related or neighboring rights to the procedurally generated audio files in
`packages/uisfx/sounds`.

You may copy, modify, distribute, and use these files, including for commercial
purposes, without asking permission. Attribution is appreciated but not
required.

This dedication does not apply to files under `.generated`, including any
provider-backed research or evaluation output.

Legal code: https://creativecommons.org/publicdomain/zero/1.0/legalcode
SPDX identifier: CC0-1.0
```

Append to `THIRD_PARTY_NOTICES.md`:

```md
Plaintext also embeds UI SFX `zen/press.mp3` as the Soft tap key sound. The
asset comes from `romainsimon/uisfx`, path
`packages/uisfx/sounds/zen/press.mp3`, pinned at commit
`99d287a1d27ef49c02a5262184a7fda91612321e`. UI SFX audio is dedicated to the
public domain under CC0 1.0; attribution is appreciated but not required.
```

Embed the complete updated notice and exact CC0 file verbatim inside
`#legalNotices`, preserving the existing normalization rule.

- [ ] **Step 8: Run focused GREEN and the full gate**

Run:

```bash
node --test --test-name-pattern='soft tap|UI SFX' tests/verify.mjs
node --test tests/verify.mjs
git diff --check
```

Expected: all tests pass, the embedded hash is exact, legal files match the
standalone block, the zero-network invariant remains green, and diff checking
is silent.

- [ ] **Step 9: Commit and stop for audio acceptance**

Run:

```bash
git add index.html tests/verify.mjs THIRD_PARTY_NOTICES.md ThirdPartyLicenses/UISFX-CC0.txt
git commit -m "feat: embed UI SFX soft tap"
```

Restart the local preview. Ask the user to confirm Soft tap is the chosen Zen
press sound, plainly differs from Typewriter, remains responsive under repeated
typing, stays silent after Off, survives reload, and creates no runtime network
request. Do not resume GitHub Pages publication before explicit acceptance.
