/**
 * The end-to-end gate: the app driven the way a person drives it.
 *
 * 923 unit tests cover the functions. Not one of them opens the app. Every bug this project found
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
