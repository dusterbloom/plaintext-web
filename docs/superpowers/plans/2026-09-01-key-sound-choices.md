# Key Sound Choices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the key-sound checkbox with an accessible Off / Typewriter / Soft tap selector and add a genuinely gentler synthesized tap that stays inside the single offline HTML file.

**Architecture:** Keep preference parsing as pure testable logic, migrate the legacy enabled value to a canonical enum, and let the existing lazy Web Audio closure own two deterministic buffers. The native selector persists the enum and previews audible choices from its user-initiated change event.

**Tech Stack:** One HTML file, embedded CSS, vanilla JavaScript, Web Audio API, Node.js built-in test runner.

## Global Constraints

- `index.html` remains the only runtime application artifact.
- Add no dependencies, audio files, downloads, or runtime network requests.
- First-run and unknown preferences resolve to Off.
- The legacy stored value `soft` resolves to Typewriter and is rewritten as `typewriter` when storage is available.
- Canonical values are exactly `off`, `typewriter`, and `tap`.
- Preserve the current Typewriter waveform character, typing-key set, and 25 ms throttle.
- Optional audio failure must never interrupt typing.
- Do not begin public repository publication until the user accepts the updated visual and audio build.

---

### Task 1: Add the Sound Selector and Soft Tap

**Files:**

- Modify: `index.html:327`
- Modify: `index.html:444-542`
- Modify: `index.html:568-669`
- Modify: `index.html:1111-1185`
- Modify: `tests/verify.mjs`

**Interfaces:**

- Consumes: `store.get(key)`, `store.set(key, value)`, `K.sound`, the existing `settings` object, and the browser's `AudioContext` or `webkitAudioContext`.
- Produces: `resolveSoundPreference(value) -> "off" | "typewriter" | "tap"`, `sound(mode = settings.sound, preview = false)`, and the `#soundPick` native selector.

- [ ] **Step 1: Add failing preference and markup tests**

Append focused tests to `tests/verify.mjs`:

```js
test("key sound preferences preserve legacy users and reject unknown values", () => {
  const { resolveSoundPreference } = extractTestableLogic(readApp(), [
    "resolveSoundPreference",
  ]);

  assert.equal(resolveSoundPreference(null), "off");
  assert.equal(resolveSoundPreference("off"), "off");
  assert.equal(resolveSoundPreference("soft"), "typewriter");
  assert.equal(resolveSoundPreference("typewriter"), "typewriter");
  assert.equal(resolveSoundPreference("tap"), "tap");
  assert.equal(resolveSoundPreference("loud"), "off");
});

test("settings expose one accessible three-state key sound selector", () => {
  const html = readApp();
  assert.match(html, /<label for="soundPick">Key sound<\/label>/);
  assert.match(
    html,
    /<select id="soundPick">[\s\S]*value="off"[\s\S]*value="typewriter"[\s\S]*value="tap"[\s\S]*<\/select>/,
  );
  assert.doesNotMatch(html, /id="soundToggle"/);
});
```

- [ ] **Step 2: Add a failing sound-engine wiring test**

Append:

```js
test("key sound selection stores canonical values and previews distinct buffers", () => {
  const html = readApp();
  const script = extractInlineScript(html);
  assert.match(script, /function buildTypewriter\(/);
  assert.match(script, /function buildTap\(/);
  assert.match(script, /buffers\[mode\]/);
  assert.match(
    script,
    /\$\("soundPick"\)\.addEventListener\("change",[\s\S]{0,260}store\.set\(K\.sound, settings\.sound\)[\s\S]{0,160}sound\(settings\.sound, true\)/,
  );
  assert.match(
    script,
    /if \(storedSound === "soft"\) store\.set\(K\.sound, "typewriter"\)/,
  );
});
```

- [ ] **Step 3: Run the focused tests and confirm RED**

Run:

```bash
node --test --test-name-pattern='key sound' tests/verify.mjs
```

Expected: the preference function, `#soundPick`, distinct buffer builders,
canonical persistence, preview call, and migration assertions fail against the
checkbox implementation.

- [ ] **Step 4: Implement the pure preference parser and migration**

Add this inside the existing `@testable` block:

```js
function resolveSoundPreference(value) {
  if (value === "soft") return "typewriter";
  if (value === "typewriter" || value === "tap") return value;
  return "off";
}
```

Read once before constructing `settings`, use the parser, and normalize the
legacy value:

```js
const storedSound = store.get(K.sound);
const settings = {
  theme: THEMES[store.get(K.theme)] ? store.get(K.theme) : "paper",
  font: FONTS[store.get(K.font)] ? store.get(K.font) : "literata",
  sound: resolveSoundPreference(storedSound),
  count: store.get(K.count) === "true",
  light: rememberedTheme(K.light, "paper", false),
  dark: rememberedTheme(K.dark, "ink", true),
  match: store.get(K.match) === null
    ? store.get(K.theme) === null
    : store.get(K.match) === "true",
};
if (storedSound === "soft") store.set(K.sound, "typewriter");
```

- [ ] **Step 5: Replace the checkbox with the native selector**

Replace the old toggle with:

```html
<div class="group">
  <div class="label"><label for="soundPick">Key sound</label></div>
  <select id="soundPick">
    <option value="off">Off</option>
    <option value="typewriter">Typewriter</option>
    <option value="tap">Soft tap</option>
  </select>
</div>
```

In `buildSettings()`, assign `$("soundPick").value = settings.sound`. Replace
the old checkbox listener with:

```js
$("soundPick").addEventListener("change", (event) => {
  settings.sound = resolveSoundPreference(event.target.value);
  store.set(K.sound, settings.sound);
  if (settings.sound !== "off") sound(settings.sound, true);
});
```

- [ ] **Step 6: Add the distinct synthesized buffer**

Keep the current Typewriter buffer math in `buildTypewriter()`. Add a separate
`buildTap()` that returns a roughly 40 ms mono buffer using deterministic noise,
a 2 ms soft attack, rapid decay, smoothing, no sine-wave body, and a lower
output level. Simplify the closure constant to `const RATE = 44100` because
each builder owns its duration. Cache both by canonical mode:

```js
const buffers = Object.create(null);

function buildTypewriter() {
  const buffer = ctx.createBuffer(1, Math.floor(RATE * 0.058), RATE);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const t = i / RATE;
    const low =
      (noise(i) + noise(i - 1) + noise(i - 2) + noise(i - 3) + noise(i - 4)) / 5;
    const cushion = low * Math.exp(-t / 0.018) * 0.20;
    const warmth = Math.sin(2 * Math.PI * 235 * t) * Math.exp(-t / 0.024) * 0.10;
    data[i] = Math.max(-1, Math.min(1, (cushion + warmth) * 0.60));
  }
  return buffer;
}

function buildTap() {
  const duration = 0.040;
  const buffer = ctx.createBuffer(1, Math.floor(RATE * duration), RATE);
  const data = buffer.getChannelData(0);
  let smooth = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / RATE;
    smooth += (noise(i) - smooth) * 0.18;
    const attack = Math.min(1, t / 0.002);
    const decay = Math.exp(-t / 0.010);
    data[i] = smooth * attack * decay * 0.28;
  }
  return buffer;
}
```

Update the closure's public function to accept a mode and preview flag. Off
returns immediately. Normal typing keeps the 25 ms throttle; preview bypasses
it. Create the context lazily, choose `buildTypewriter` or `buildTap`, cache the
result in `buffers[mode]`, use a lower gain for tap, and start only after a
suspended context resumes:

```js
return function play(mode = settings.sound, preview = false) {
  if (mode === "off") return;
  const now = performance.now();
  if (!preview && now - last < 25) return;
  last = now;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    const start = () => {
      if (!buffers[mode]) {
        buffers[mode] = mode === "tap" ? buildTap() : buildTypewriter();
      }
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = mode === "tap" ? 0.12 : 0.16;
      src.buffer = buffers[mode];
      src.connect(gain).connect(ctx.destination);
      src.start();
    };
    if (ctx.state === "suspended") void ctx.resume().then(start, () => {});
    else start();
  } catch (_) { /* audio unavailable; typing continues */ }
};
```

- [ ] **Step 7: Run focused GREEN and the complete release gate**

Run:

```bash
node --test --test-name-pattern='key sound' tests/verify.mjs
node --test tests/verify.mjs
git diff --check
```

Expected: focused sound tests pass, every release test passes, and whitespace
checking is silent.

- [ ] **Step 8: Perform manual browser acceptance**

Restart `python3 -m http.server 4173 --bind 127.0.0.1`, reload
`http://127.0.0.1:4173/`, and confirm:

- selecting Typewriter previews the unchanged typewriter sound;
- selecting Soft tap previews a clearly gentler, distinct paper/felt tap;
- typing uses the selected choice after closing Settings;
- Off is silent;
- reloading preserves the canonical choice;
- the control fits desktop, narrow portrait, and short landscape views;
- the browser network panel shows no runtime request beyond `index.html`.

If browser control is unavailable, report these as explicit user-acceptance
items and do not claim a pass.

- [ ] **Step 9: Commit the implementation**

Run:

```bash
git add index.html tests/verify.mjs
git commit -m "feat: add soft typing sound"
```

Expected: one focused implementation commit. Stop for user audio/visual
acceptance before resuming public GitHub Pages publication.
