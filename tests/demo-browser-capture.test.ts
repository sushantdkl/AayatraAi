import assert from "node:assert/strict";
import { existsSync, mkdtempSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PlaywrightDemoBrowser } from "../lib/demo-browser";

const chromePath = process.env.CHROME_PATH ?? ["/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((path) => existsSync(path));

test("recorder logs in synthetically, walks read-only routes and captures frames", { skip: !chromePath }, async () => {
  process.env.CHROME_PATH = chromePath;
  let posts = 0;
  const server = createServer((req, res) => {
    const authed = /session=ok/.test(req.headers.cookie ?? "");
    if (req.method === "POST" && req.url === "/login") { posts++; res.writeHead(302, { "Set-Cookie": "session=ok; Path=/", Location: "/dashboard" }); return res.end(); }
    if (req.url === "/login") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end('<form method="post" action="/login"><input id="u" name="u"><input id="p" name="p" type="password"><button id="go">Sign in</button></form>'); }
    if (!authed) { res.writeHead(302, { Location: "/login" }); return res.end(); }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h1 id="ok">${req.url}</h1><nav><a href="/kot">KOT</a></nav><form method="post" action="/void"><button>Void</button></form>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const origin = `http://127.0.0.1:${port}`;
  const browser = new PlaywrightDemoBrowser(async () => ({ origin, hostname: "127.0.0.1", address: "127.0.0.1" }));
  const dir = mkdtempSync(join(tmpdir(), "demo-capture-"));
  try {
    const frames = await browser.capture(origin, [
      { action: "OPEN_ROUTE", route: "/dashboard", caption: null, isMutating: false },
      { action: "CAPTURE", route: "/dashboard", caption: "Overview", isMutating: false },
      { action: "OPEN_ROUTE", route: "/kot", caption: null, isMutating: false },
      { action: "WAIT", route: null, selector: "#ok", caption: null, isMutating: false },
      { action: "CAPTURE", route: "/kot", caption: "Kitchen tickets", isMutating: false },
    ], dir, { loginUrl: `${origin}/login`, username: "demo", password: "synthetic", usernameSelector: "#u", passwordSelector: "#p", submitSelector: "#go", successSelector: "#ok" });
    assert.equal(frames.length, 2);
    assert.ok(statSync(frames[1].path).size > 1000);
    assert.equal(frames[1].url, `${origin}/kot`);
    assert.equal(posts, 1);
    await assert.rejects(browser.capture(origin, [{ action: "CLICK", route: null, caption: null, isMutating: true }], dir), /Mutating/);
  } finally { server.close(); }
});
