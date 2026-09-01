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

export {
  appPath,
  extractInlineScript,
  extractTestableLogic,
  readApp,
  root,
  runtimeSource,
};
