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

test("session form exposes limits, errors, and a rolling window", () => {
  const html = readApp();
  assert.match(html, /id="goalAmount"[^>]*max="1000000"/);
  assert.match(html, /id="goalMinutes"[^>]*max="1440"/);
  assert.match(html, /id="sessionError"[^>]*role="alert"/);
  assert.match(html, /windowBaseline/);
});

export {
  appPath,
  extractInlineScript,
  extractTestableLogic,
  readApp,
  root,
  runtimeSource,
};
