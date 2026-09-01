import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

function extractFunctionSource(html, name) {
  const script = extractInlineScript(html);
  const start = script.indexOf("function " + name + "(");
  assert.notEqual(start, -1, name + " function missing");
  const body = script.indexOf("{", start);
  let depth = 0;
  for (let index = body; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  assert.fail(name + " function is not balanced");
}

function writingSessionHarness(saved, { progress, now }) {
  const html = readApp();
  const {
    isValidFinishedSession,
    parseBoundedInteger,
    sessionCompletionReason,
  } = extractTestableLogic(html, [
    "isValidFinishedSession",
    "parseBoundedInteger",
    "sessionCompletionReason",
  ]);
  const calls = [];
  const persisted = [];
  const nodes = {
    clock: { hidden: true, textContent: "" },
    ghost: { hidden: false },
    pace: { hidden: true },
    sessionStatus: { textContent: "" },
  };
  const session = {
    active: false,
    finished: null,
    goal: 10,
    unit: "words",
    minutes: 1,
    baseline: 0,
    windowBaseline: 0,
    startedAt: 0,
    endsAt: 0,
    bars: [],
    cum: [],
    spent: 0,
    timer: 0,
    frame: 0,
  };
  const store = {
    get() {
      return JSON.stringify(saved);
    },
    set(key, value) {
      calls.push("set");
      persisted.push({ key, value: JSON.parse(value) });
      return true;
    },
    del() {
      calls.push("delete");
    },
  };
  const context = {
    $: (id) => nodes[id],
    Date: { now: () => now },
    K: { session: "session" },
    buildBars: () => calls.push("build"),
    cancelAnimationFrame() {},
    clearInterval() {},
    doc: { text: "" },
    formatLeft: String,
    isValidFinishedSession,
    paintBars: () =>
      calls.push("paint:" + (session.finished ? session.finished.reason : "active")),
    parseBoundedInteger,
    renderCount: () => calls.push("render"),
    session,
    sessionCompletionReason,
    sessionProgress: () => progress,
    setInterval() {
      calls.push("timer");
      return 1;
    },
    store,
    tickClock: () => calls.push("tick"),
    updatePace: () => calls.push("pace"),
    wordsIn: () => 0,
  };
  const source = [
    "finishSession",
    "persistSession",
    "startSession",
    "restoreSession",
  ]
    .map((name) => extractFunctionSource(html, name))
    .join("\n");
  const runtime = new Function(
    ...Object.keys(context),
    source + "; return { restoreSession };",
  )(...Object.values(context));

  return { ...runtime, calls, nodes, persisted, session };
}

function savedSession(overrides = {}) {
  return {
    goal: 10,
    unit: "words",
    minutes: 1,
    baseline: 0,
    startedAt: 1,
    endsAt: 100,
    finished: null,
    ...overrides,
  };
}

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

function normalizeNotice(source) {
  return source.replace(/[ \t]+$/gm, "").replace(/\r\n/g, "\n").replace(/\n+$/, "");
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

test("repository and standalone app retain required legal notices", () => {
  const html = readApp();
  const embedded = legalBlock(html);

  for (const relative of legalFiles) {
    const path = resolve(root, relative);
    assert.ok(existsSync(path), relative + " is missing");
    const notice = normalizeNotice(readFileSync(path, "utf8"));
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

test("paused recovery probes once without trimming history again", () => {
  const html = readApp();
  const { writeRecoveryWithFallback } = extractTestableLogic(html, [
    "writeRecoveryWithFallback",
  ]);
  const history = [1, 2];
  let recoveryWrites = 0;
  let historyWrites = 0;
  let historyDeletes = 0;
  const store = {
    set(key) {
      if (key === "r") recoveryWrites += 1;
      else historyWrites += 1;
      return false;
    },
    del() {
      historyDeletes += 1;
    },
  };

  const result = writeRecoveryWithFallback(
    store,
    { recovery: "r", history: "h" },
    "current",
    history,
    true,
  );

  assert.deepEqual(result, { ok: false, history, trimmed: false });
  assert.equal(recoveryWrites, 1);
  assert.equal(historyWrites, 0);
  assert.equal(historyDeletes, 0);
});

test("file writer closes only after writing exact text", async () => {
  const html = readApp();
  const { writeToHandle } = extractTestableLogic(html, ["writeToHandle"]);
  const calls = [];
  const handle = {
    async createWritable() {
      calls.push("create");
      return {
        async write(text) {
          calls.push(["write", text]);
        },
        async close() {
          calls.push("close");
        },
      };
    },
  };

  await writeToHandle(handle, "current");
  assert.deepEqual(calls, ["create", ["write", "current"], "close"]);
});

test("document write marks only the captured snapshot clean", async () => {
  const html = readApp();
  const { writeDocumentSnapshot } = extractTestableLogic(html, [
    "writeDocumentSnapshot",
  ]);
  let releaseClose;
  let signalWrite;
  const closeGate = new Promise((resolve) => {
    releaseClose = resolve;
  });
  const writeStarted = new Promise((resolve) => {
    signalWrite = resolve;
  });
  let writtenText = null;
  const handle = {
    async createWritable() {
      return {
        async write(text) {
          writtenText = text;
          signalWrite();
        },
        async close() {
          await closeGate;
        },
      };
    },
  };
  const documentState = {
    text: "written snapshot",
    cleanText: null,
  };

  const saving = writeDocumentSnapshot(handle, documentState);
  await writeStarted;
  documentState.text = "typed while saving";
  releaseClose();
  await saving;

  assert.equal(writtenText, "written snapshot");
  assert.equal(documentState.cleanText, "written snapshot");
  assert.equal(documentState.text, "typed while saving");
});

test("failed download click revokes its object URL immediately", () => {
  const html = readApp();
  const { initiateDownload } = extractTestableLogic(html, [
    "initiateDownload",
  ]);
  let revocations = 0;
  let schedules = 0;
  const failure = new Error("download blocked");
  const documentState = { text: "exported", cleanText: null };

  assert.throws(
    () =>
      initiateDownload(
        {
          click() {
            throw failure;
          },
        },
        () => {
          revocations += 1;
        },
        () => {
          schedules += 1;
        },
        documentState,
        "exported",
      ),
    failure,
  );
  assert.equal(revocations, 1);
  assert.equal(schedules, 0);
  assert.equal(documentState.cleanText, null);
});

test("download marks only the captured export snapshot clean", () => {
  const html = readApp();
  const { initiateDownload } = extractTestableLogic(html, [
    "initiateDownload",
  ]);
  const documentState = {
    text: "exported snapshot",
    cleanText: null,
  };
  const exportedText = documentState.text;

  initiateDownload(
    {
      click() {
        documentState.text = "changed during click";
      },
    },
    () => {},
    () => {},
    documentState,
    exportedText,
  );

  assert.equal(documentState.cleanText, "exported snapshot");
  assert.equal(documentState.text, "changed during click");
});

test("abort detection recognizes only browser cancellation errors", () => {
  const html = readApp();
  const { isAbort } = extractTestableLogic(html, ["isAbort"]);

  assert.equal(isAbort({ name: "AbortError" }), true);
  assert.equal(isAbort(new Error("disk full")), false);
  assert.equal(isAbort(null), null);
});

test("persistence health has an accessible visible status", () => {
  const html = readApp();
  assert.match(html, /id="persistenceStatus"[^>]*role="status"/);
  assert.match(html, /Local recovery unavailable—save to a file\./);
  assert.match(html, /pagehide/);
  assert.match(html, /beforeunload/);
});

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

test("session completion gives the goal precedence over the deadline", () => {
  const html = readApp();
  const { sessionCompletionReason } = extractTestableLogic(html, [
    "sessionCompletionReason",
  ]);

  assert.equal(sessionCompletionReason(9, 10, 99, 100), null);
  assert.equal(sessionCompletionReason(9, 10, 100, 100), "time");
  assert.equal(sessionCompletionReason(10, 10, 99, 100), "goal");
  assert.equal(sessionCompletionReason(10, 10, 100, 100), "goal");
});

test("finished session records are safe, bounded, and reason-consistent", () => {
  const html = readApp();
  const { isValidFinishedSession } = extractTestableLogic(html, [
    "isValidFinishedSession",
  ]);
  const validGoal = { reason: "goal", count: 10, elapsed: 60_000 };
  const validTime = { reason: "time", count: 9, elapsed: 60_000 };

  assert.equal(isValidFinishedSession(null, 10, 1), true);
  assert.equal(isValidFinishedSession(validGoal, 10, 1), true);
  assert.equal(isValidFinishedSession(validTime, 10, 1), true);
  assert.equal(
    isValidFinishedSession({ ...validTime, count: -1 }, 10, 1),
    false,
  );
  assert.equal(
    isValidFinishedSession({ ...validGoal, count: 10.5 }, 10, 1),
    false,
  );
  assert.equal(
    isValidFinishedSession(
      { ...validGoal, count: Number.MAX_SAFE_INTEGER + 1 },
      10,
      1,
    ),
    false,
  );
  assert.equal(
    isValidFinishedSession({ ...validGoal, elapsed: -1 }, 10, 1),
    false,
  );
  assert.equal(
    isValidFinishedSession({ ...validGoal, elapsed: 1.5 }, 10, 1),
    false,
  );
  assert.equal(
    isValidFinishedSession(
      { ...validGoal, elapsed: Number.MAX_SAFE_INTEGER + 1 },
      10,
      1,
    ),
    false,
  );
  assert.equal(
    isValidFinishedSession({ ...validGoal, elapsed: 60_001 }, 10, 1),
    false,
  );
  assert.equal(
    isValidFinishedSession({ ...validGoal, count: 9 }, 10, 1),
    false,
  );
  assert.equal(
    isValidFinishedSession({ ...validTime, count: 10 }, 10, 1),
    false,
  );
});

test("restored unfinished sessions decide before rendering or timing", () => {
  const active = writingSessionHarness(savedSession(), {
    progress: 9,
    now: 99,
  });
  active.restoreSession();
  assert.equal(active.session.finished, null);
  assert.equal(active.calls.includes("build"), true);
  assert.equal(active.calls.includes("timer"), true);
  assert.equal(active.calls.includes("tick"), true);

  const expired = writingSessionHarness(savedSession(), {
    progress: 9,
    now: 100,
  });
  expired.restoreSession();
  assert.equal(expired.session.finished.reason, "time");
  assert.equal(expired.calls.includes("build"), false);
  assert.equal(expired.calls.includes("timer"), false);
  assert.equal(expired.calls.includes("paint:time"), true);
  assert.equal(expired.calls.includes("paint:active"), false);
  assert.equal(expired.nodes.ghost.hidden, true);
  assert.equal(expired.persisted.at(-1).value.finished.reason, "time");

  const goalMet = writingSessionHarness(savedSession(), {
    progress: 10,
    now: 99,
  });
  goalMet.restoreSession();
  assert.equal(goalMet.session.finished.reason, "goal");
  assert.equal(goalMet.calls.includes("build"), false);
  assert.equal(goalMet.calls.includes("timer"), false);
  assert.equal(goalMet.calls.includes("paint:goal"), true);
  assert.equal(goalMet.calls.includes("paint:active"), false);
  assert.equal(goalMet.persisted.at(-1).value.finished.reason, "goal");

  const bothMet = writingSessionHarness(savedSession(), {
    progress: 10,
    now: 100,
  });
  bothMet.restoreSession();
  assert.equal(bothMet.session.finished.reason, "goal");
  assert.equal(bothMet.calls.includes("build"), false);
  assert.equal(bothMet.calls.includes("timer"), false);
  assert.equal(bothMet.calls.includes("paint:goal"), true);
  assert.equal(bothMet.calls.includes("paint:active"), false);
  assert.equal(bothMet.persisted.at(-1).value.finished.reason, "goal");
});

test("restored timestamps cannot create invalid finished records", () => {
  const fractional = writingSessionHarness(
    savedSession({ startedAt: 1.5 }),
    { progress: 10, now: 99 },
  );
  fractional.restoreSession();
  assert.deepEqual(fractional.calls, ["delete"]);
  assert.equal(fractional.persisted.length, 0);

  const future = writingSessionHarness(
    savedSession({ startedAt: 200, endsAt: 300 }),
    { progress: 10, now: 100 },
  );
  future.restoreSession();
  assert.equal(future.session.finished.reason, "goal");
  assert.equal(future.session.finished.elapsed, 0);
  assert.equal(future.persisted.at(-1).value.finished.elapsed, 0);
});

test("valid finished restores retain their terminal state", () => {
  for (const finished of [
    { reason: "goal", count: 10, elapsed: 50 },
    { reason: "time", count: 9, elapsed: 60 },
  ]) {
    const restored = writingSessionHarness(savedSession({ finished }), {
      progress: 0,
      now: 200,
    });
    restored.restoreSession();
    assert.deepEqual(restored.session.finished, finished);
    assert.equal(restored.calls.includes("delete"), false);
    assert.equal(restored.calls.includes("timer"), false);
    assert.equal(restored.nodes.ghost.hidden, true);
    assert.deepEqual(restored.persisted.at(-1).value.finished, finished);
  }
});

test("invalid finished restores are deleted without starting", () => {
  const validGoal = { reason: "goal", count: 10, elapsed: 60_000 };
  const validTime = { reason: "time", count: 9, elapsed: 60_000 };
  const invalidRecords = [
    { ...validTime, count: -1 },
    { ...validGoal, count: 10.5 },
    { ...validGoal, count: Number.MAX_SAFE_INTEGER + 1 },
    { ...validGoal, elapsed: -1 },
    { ...validGoal, elapsed: 1.5 },
    { ...validGoal, elapsed: Number.MAX_SAFE_INTEGER + 1 },
    { ...validGoal, elapsed: 60_001 },
    { ...validGoal, count: 9 },
    { ...validTime, count: 10 },
  ];

  for (const finished of invalidRecords) {
    const rejected = writingSessionHarness(savedSession({ finished }), {
      progress: 0,
      now: 99,
    });
    rejected.restoreSession();
    assert.deepEqual(rejected.calls, ["delete"]);
    assert.equal(rejected.session.active, false);
    assert.equal(rejected.persisted.length, 0);
  }
});

test("session form exposes limits, errors, and a rolling window", () => {
  const html = readApp();
  assert.match(html, /id="goalAmount"[^>]*max="1000000"/);
  assert.match(html, /id="goalMinutes"[^>]*max="1440"/);
  assert.match(html, /id="sessionError"[^>]*role="alert"/);
  assert.match(html, /windowBaseline/);
});

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

test("mobile form overrides beat existing find and number field typography", () => {
  const html = readApp();
  const mobile = html.match(/@media \(max-width:600px\)\{([\s\S]*?)\n\}/);
  assert.ok(mobile, "mobile form media query missing");
  assert.match(mobile[1], /\.find input,input\.num\{font-size:max\(16px,1em\)\}/);
});

test("forced colors overrides component borders", () => {
  const html = readApp();
  const forced = html.match(/@media \(forced-colors:active\)\{([\s\S]*?)\n\}/);
  assert.ok(forced, "forced-colors media query missing");
  assert.match(
    forced[1],
    /button,input,select,dialog,\.panel\{border:1px solid ButtonText!important\}/,
  );
});

test("short landscape editor padding does not repeat the safe-area inset", () => {
  const html = readApp();
  const landscape = html.match(
    /@media \(max-height:500px\) and \(orientation:landscape\)\{([\s\S]*?)\n\}/,
  );
  assert.ok(landscape, "short-landscape media query missing");
  assert.match(landscape[1], /padding-bottom:2\.5rem/);
  assert.doesNotMatch(landscape[1], /safe-bottom/);
});

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

test("selection, announcements, and motion wiring stay scoped", () => {
  const html = readApp();
  const script = extractInlineScript(html);
  const settingsSource = extractFunctionSource(html, "buildSettings");
  const sessionSource = extractFunctionSource(html, "finishSession");

  assert.match(
    html,
    /\.palette \[role="option"\]\[aria-selected="true"\]/,
  );
  assert.doesNotMatch(html, /\.palette li\[aria-selected="true"\]/);
  assert.match(script, /function syncPaletteSelection\(/);
  assert.match(script, /removeAttribute\(["']aria-activedescendant["']\)/);
  assert.match(script, /setAttribute\(["']aria-expanded["'],\s*["']true["']\)/);
  assert.match(script, /setAttribute\(["']aria-expanded["'],\s*["']false["']\)/);
  assert.doesNotMatch(
    settingsSource,
    /addEventListener\(["']click["'][\s\S]*buildSettings\(\)/,
  );
  assert.match(script, /\$\(["']themes["']\)\.addEventListener\(["']keydown["']/);
  assert.match(sessionSource, /\$\(["']sessionStatus["']\)\.textContent/);
  assert.match(html, /\.sr-only\s*\{[\s\S]*clip-path:\s*inset\(50%\)/);
  assert.match(
    html,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\*::before[\s\S]*animation-iteration-count:\s*1\s*!important/,
  );
});

export {
  appPath,
  extractInlineScript,
  extractTestableLogic,
  readApp,
  root,
  runtimeSource,
};
