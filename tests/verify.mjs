import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

export {
  appPath,
  extractInlineScript,
  extractTestableLogic,
  readApp,
  root,
  runtimeSource,
};
