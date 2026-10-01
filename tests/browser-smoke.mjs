import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chromium = process.env.CHROMIUM_BIN || "/opt/homebrew/bin/chromium";
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8" };
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

/* @testable-runner:start */
async function runCleanups(actions) {
  const errors = [];
  for (const action of actions) {
    try {
      await action();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, "Browser cleanup failed");
}

function browserFailureFromEvent(method, params) {
  if (method === "Runtime.exceptionThrown") {
    const details = params?.exceptionDetails;
    return details?.exception?.description || details?.text || "Uncaught page exception";
  }
  if (method === "Runtime.consoleAPICalled" && ["error", "assert"].includes(params?.type)) {
    return (params.args || []).map((argument) => argument.value ?? argument.description ?? "[value]").join(" ")
      || "Page console error";
  }
  return null;
}
/* @testable-runner:end */

function withDeadline(promise, deadline, message) {
  let timeout;
  const expired = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), Math.max(1, deadline - Date.now()));
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timeout));
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen(server.address()));
  });
}

function close(server) {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolveClose) => server.close(resolveClose));
}

function launchChromium(args) {
  const child = spawn(chromium, args, { detached: true, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  let settled = false;
  let resolveDevtools;
  let rejectDevtools;
  const devtools = new Promise((resolvePromise, rejectPromise) => {
    resolveDevtools = resolvePromise;
    rejectDevtools = rejectPromise;
  });
  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true;
      rejectDevtools(new Error("Timed out waiting for Chromium DevTools URL\n" + stderr));
    }
  }, 10000);

  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    stderr += chunk;
    const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (!settled && match) {
      const url = new URL(match[1]);
      settled = true;
      clearTimeout(timeout);
      if (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]") {
        resolveDevtools(url);
      } else {
        rejectDevtools(new Error("DevTools must be loopback-only"));
      }
    }
  });
  child.once("error", (error) => {
    if (!settled) {
      settled = true;
      clearTimeout(timeout);
      rejectDevtools(error);
    }
  });
  child.once("exit", (code, signal) => {
    if (!settled) {
      settled = true;
      clearTimeout(timeout);
      rejectDevtools(new Error(`Chromium exited before DevTools was ready (${code ?? signal})\n${stderr}`));
    }
  });

  return { child, devtools, stderr: () => stderr };
}

async function stopChromium(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolveExit) => child.once("close", resolveExit));
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
  await Promise.race([exited, wait(2000)]);
  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    await exited;
  }
}

async function findHarness(devtoolsUrl, harnessUrl, deadline) {
  const listUrl = `http://${devtoolsUrl.host}/json/list`;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(listUrl, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(1000, deadline - Date.now()))),
      });
      if (!response.ok) throw new Error(`DevTools target list returned ${response.status}`);
      const targets = await response.json();
      const target = targets.find((candidate) => candidate.type === "page" && candidate.url === harnessUrl);
      if (target?.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
    } catch (error) {
      lastError = error;
    }
    await wait(50);
  }
  throw new Error("Timed out locating browser harness" + (lastError ? `: ${lastError.message}` : ""));
}

async function connectCdp(url, deadline) {
  const socket = new WebSocket(url);
  await withDeadline(new Promise((resolveOpen, reject) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", () => reject(new Error("DevTools WebSocket failed to open")), { once: true });
  }), deadline, "Timed out opening DevTools WebSocket");

  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolveCall, rejectCall } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rejectCall(new Error(message.error.message));
      else resolveCall(message.result);
      return;
    }
    for (const listener of listeners.get(message.method) || []) listener(message.params);
  });
  socket.addEventListener("close", () => {
    for (const { rejectCall } of pending.values()) rejectCall(new Error("DevTools WebSocket closed"));
    pending.clear();
  });

  return {
    close: () => socket.close(),
    on(method, listener) {
      if (!listeners.has(method)) listeners.set(method, new Set());
      listeners.get(method).add(listener);
      return () => listeners.get(method)?.delete(listener);
    },
    call(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolveCall, rejectCall) => {
        pending.set(id, { resolveCall, rejectCall });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function evaluate(cdp, expression, deadline) {
  const response = await withDeadline(
    cdp.call("Runtime.evaluate", { expression, returnByValue: true }),
    deadline,
    "Timed out evaluating browser harness",
  );
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function waitForHarness(cdp, deadline) {
  while (Date.now() < deadline) {
    const status = await evaluate(cdp, "document.body?.dataset.status || 'running'", deadline);
    if (status === "pass") return;
    if (status === "fail") {
      const result = await evaluate(cdp, "document.querySelector('#result').textContent", deadline);
      const frame = await evaluate(cdp, `(() => {
        const iframe = document.querySelector("iframe");
        return JSON.stringify({
          href: iframe?.contentWindow.location.href,
          title: iframe?.contentDocument.title,
          body: iframe?.contentDocument.body?.innerText.slice(-500),
        });
      })()`, deadline);
      throw new Error("Browser harness failed: " + result + "\nFrame: " + frame);
    }
    await wait(50);
  }
  const result = await evaluate(cdp, "document.querySelector('#result').textContent", Date.now() + 1000);
  throw new Error("Browser harness timed out: " + result);
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const path = resolve(root, "." + pathname);
    if (path !== root && !path.startsWith(root + sep)) throw new Error("outside root");
    const info = await stat(path);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": mime[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end("not found");
  }
});

let profile;
let browser;
let cdp;
try {
  const address = await listen(server);
  profile = await mkdtemp(resolve(tmpdir(), "plaintext-browser-"));
  const harnessUrl = `http://127.0.0.1:${address.port}/tests/browser-harness.html`;
  browser = launchChromium([
    "--headless=new",
    "--disable-gpu",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    harnessUrl,
  ]);
  const deadline = Date.now() + 30000;
  const devtoolsUrl = await browser.devtools;
  const targetUrl = await findHarness(devtoolsUrl, harnessUrl, deadline);
  cdp = await connectCdp(targetUrl, deadline);
  const browserFailures = [];
  for (const method of ["Runtime.exceptionThrown", "Runtime.consoleAPICalled"]) {
    cdp.on(method, (params) => {
      const failure = browserFailureFromEvent(method, params);
      if (failure) browserFailures.push(failure);
    });
  }
  await cdp.call("Runtime.enable");
  await waitForHarness(cdp, deadline);
  if (browserFailures.length) throw new Error("Browser page errors:\n" + browserFailures.join("\n"));
  console.log("PASS: " + await evaluate(cdp, "document.querySelector('#result').textContent", Date.now() + 1000));
} catch (error) {
  if (browser?.stderr()) error.message += "\n" + browser.stderr();
  throw error;
} finally {
  await runCleanups([
    async () => cdp?.close(),
    async () => stopChromium(browser?.child),
    async () => close(server),
    async () => { if (profile) await rm(profile, { recursive: true, force: true }); },
  ]);
}
