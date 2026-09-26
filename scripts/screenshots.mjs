#!/usr/bin/env node
// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Takes every screenshot the READMEs and the landing page show, in either language, from a
 * production build.
 *
 *   npm run screenshots -- --lang en            one language (th → public/screenshots/,
 *                                               en → public/screenshots/en/)
 *   npm run screenshots -- --lang all           both
 *   npm run screenshots -- --only 05,20 --no-build
 *
 * Why this is a script and not a habit: the images used to be taken by hand, one throwaway script
 * per round, and the English README ended up showing the Thai interface in 43 of its 44 pictures.
 * Nobody chose that. Two sets taken by hand is two chances to forget one, every time the UI moves.
 * One scene per image, written once and played in both languages, makes the two sets the same
 * pictures by construction — and makes retaking them after a UI change one command instead of an
 * afternoon.
 *
 * Every scene drives the real app the way a person would. Nothing on screen is staged: no answer
 * is typed into the AI panel, no cell is painted to look computed. Where a scene needs something
 * the app cannot produce on its own — a file someone built in Excel, a source that pages past its
 * row limit — the script provides that *input* and photographs what the app does with it.
 *
 * One exception, and it is the same one `check:e2e` makes: an API that answers 429. The server
 * will not fetch a loopback address (`urlGuard.ts`; not something to weaken for a picture), and
 * nothing public rate-limits on cue, so scene 14 answers the app's own data route in the browser
 * with the exact body the server sends for an upstream 429. Everything on screen after that is
 * the panel's real handling of it.
 *
 * Two builds, because one screen depends on a build-time variable: cloud save only exists when a
 * Supabase project is configured, and the public demo has none. Scene 23 is taken from a build
 * with placeholder values (it shows the sign-in form, which sends nothing until submitted); every
 * other scene from a build without, so no other picture shows a button the demo does not have.
 * The plain build runs last, so `.next` is left the way `check:e2e` expects to find it.
 *
 * After retaking, look at every image, then `npm run check:screens -- --bless`.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const LANGS = (() => {
  const v = option("lang") ?? "all";
  if (v === "all") return ["th", "en"];
  if (v === "th" || v === "en") return [v];
  throw new Error(`--lang takes th, en or all, not ${v}`);
})();
const ONLY = option("only")?.split(",").map((s) => s.trim());
const BUILD = !flag("no-build");

const PORT = Number(process.env.SCREENSHOT_PORT || 3150);
const ORIGIN = `http://localhost:${PORT}`;
const TOKEN = randomBytes(12).toString("hex");
const outDir = (lang) => path.join(ROOT, "public/screenshots", lang === "th" ? "" : lang);

// ── The app's own words ─────────────────────────────────────────────────────────────────────────
// Scenes find buttons by the label a person reads, in the language being photographed. Taken from
// the i18n files themselves (bundled on the fly — they are TypeScript), so a renamed button fails
// here by name rather than a hand-kept copy of the labels quietly going stale.
async function loadMessages() {
  const { build } = await import("esbuild");
  const dir = mkdtempSync(path.join(tmpdir(), "exceltogo-shots-"));
  const outfile = path.join(dir, "messages.mjs");
  await build({
    entryPoints: [path.join(ROOT, "src/i18n/messages.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "warning",
  });
  const { MESSAGES } = await import(pathToFileURL(outfile).href);
  rmSync(dir, { recursive: true, force: true });
  return MESSAGES;
}

// ── Build and serve ─────────────────────────────────────────────────────────────────────────────
function run(cmd, cmdArgs, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, env: { ...process.env, ...env }, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${cmdArgs.join(" ")} exited ${code}`))));
  });
}

/** Unset rather than empty: a public-demo or cloud variable left in the shell would change the picture. */
const PLAIN_ENV = {
  NEXT_PUBLIC_DEMO_MODE: "",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
};
const CLOUD_ENV = {
  NEXT_PUBLIC_DEMO_MODE: "",
  NEXT_PUBLIC_SUPABASE_URL: "https://screenshots.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "screenshots-placeholder-key",
};

async function serve(env) {
  // Its own working directory, so the sources this run creates go in a scratch `data/` and never
  // near the repository's — which holds real credentials on a working install.
  const cwd = mkdtempSync(path.join(tmpdir(), "exceltogo-serve-"));
  const child = spawn(process.execPath, [path.join(ROOT, "node_modules/next/dist/bin/next"), "start", ROOT, "-p", String(PORT)], {
    cwd,
    env: { ...process.env, ...env, NODE_ENV: "production", SOURCES_ADMIN_TOKEN: TOKEN },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${ORIGIN}/app`)).ok) break;
    } catch {
      // Not listening yet.
    }
    await delay(400);
  }
  return {
    stop: async () => {
      child.kill("SIGTERM");
      await delay(500);
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}

// ── What a scene gets to work with ──────────────────────────────────────────────────────────────
function sceneKit(browser, lang, M) {
  const t = M[lang];
  const kit = {
    lang,
    t,
    /** A fresh visitor: empty storage, the language already chosen, nothing else. */
    async open(route = "/app", { width = 1360, height = 860, scale = 2, touch = false, unlocked = false, prepare } = {}) {
      const ctx = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: scale,
        hasTouch: touch,
        isMobile: touch,
        acceptDownloads: true,
      });
      await ctx.addInitScript(
        ({ lang, token, unlocked }) => {
          if (sessionStorage.getItem("__shot") === "1") return;
          sessionStorage.setItem("__shot", "1");
          localStorage.clear();
          localStorage.setItem("exceltogo-locale", JSON.stringify({ state: { locale: lang }, version: 0 }));
          if (unlocked) sessionStorage.setItem("exceltogo.sources-token", token);
        },
        { lang, token: TOKEN, unlocked }
      );
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log(`      page error: ${e.message}`));
      if (prepare) await prepare(page);
      await page.goto(ORIGIN + route, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await delay(300);
      kit.page = page;
      kit.ctx = ctx;
      return page;
    },
    cell: (r, c) => kit.page.locator(`td[data-row="${r}"][data-col="${c}"]`),
    /** Types through the cell editor. F2 first: Thai never fires keydown over CDP, English does. */
    async type(r, c, text) {
      await kit.cell(r, c).click();
      await kit.page.keyboard.press("F2");
      await kit.cell(r, c).locator("input").waitFor({ timeout: 5000 });
      await kit.page.keyboard.insertText(text);
      await kit.page.keyboard.press("Enter");
    },
    async fill(r0, c0, rows) {
      for (const [i, row] of rows.entries()) {
        for (const [j, v] of row.entries()) if (v !== "" && v !== null) await kit.type(r0 + i, c0 + j, String(v));
      }
    },
    /** Selects a block by dragging, which is how a person does it. */
    async select(r0, c0, r1, c1) {
      await kit.cell(r0, c0).click();
      await kit.cell(r1, c1).click({ modifiers: ["Shift"] });
    },
    button: (name, opts = {}) => kit.page.getByRole("button", { name, exact: true, ...opts }),
    byTitle: (title) => kit.page.locator(`[title="${title}"]`).first(),
    async settle(ms = 400) {
      await kit.page.evaluate(() => document.fonts.ready);
      await delay(ms);
    },
    async shot(file, options = {}) {
      // A button clicked near the right edge scrolls the toolbar to it; at a narrow width that
      // leaves the app's name cut off the left of the picture. The toolbar only — a panel a scene
      // scrolled on purpose stays where it was put.
      await kit.page.evaluate(() => document.querySelectorAll(".scroll-hint-x").forEach((el) => el.scrollTo(0, 0)));
      await kit.settle();
      const target = path.join(outDir(lang), file);
      await kit.page.screenshot({ path: target, ...options });
      return target;
    },
    /** A page region in document coordinates, so a sticky header never lies across a clip. */
    async boxOf(locator, pad = 0) {
      const b = await locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
      });
      return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 };
    },
    /** Every scrolled pane in the app back to its top-left corner. */
    async scrollHome() {
      await kit.page.evaluate(() => {
        for (const el of document.querySelectorAll("*")) {
          if (el.scrollLeft || el.scrollTop) el.scrollTo(0, 0);
        }
      });
      await delay(200);
    },
    created: [],
    async close() {
      await kit.ctx?.close();
      kit.ctx = undefined;
      for (const id of kit.created.splice(0)) {
        await fetch(`${ORIGIN}/api/sources/${id}`, { method: "DELETE", headers: { "x-sources-token": TOKEN } });
      }
    },
  };
  return kit;
}

// ── Words the scenes type ───────────────────────────────────────────────────────────────────────
// Content, not interface: what a person would type into the sheet in each language. The numbers
// are the same in both, so the two pictures of one scene show the same totals.
const W = {
  th: {
    header: ["สินค้า", "หมวดหมู่", "ราคา", "จำนวน", "รวม"],
    items: [["กาแฟลาเต้", "เครื่องดื่ม"]],
    findReplaceWith: "น้ำอัดลม",
    aiQuestion: "หาค่าเฉลี่ยราคา",
    ordersSource: "ออเดอร์ทั้งหมด",
    limitedSource: "API ที่จำกัดจำนวนครั้ง",
    branchMonths: [
      ["สาขา", "ม.ค.", "ก.พ.", "มี.ค."],
      ["กรุงเทพ", 182000, 205000, 246000],
      ["เชียงใหม่", 94000, 88000, 102000],
      ["ภูเก็ต", 141000, 163000, 158000],
      ["ขอนแก่น", 76000, 71000, 69000],
      ["หาดใหญ่", 52000, 61000, 58000],
    ],
    branchQuarters: [
      ["สาขา", "ไตรมาส 1", "ไตรมาส 2"],
      ["กรุงเทพ", 1240, 1580],
      ["เชียงใหม่", 620, 740],
      ["ภูเก็ต", 980, 1190],
      ["ขอนแก่น", 430, 510],
    ],
    comment: "รอบัญชียืนยันราคานี้อีกที ถ้าเกิน 50 ต้องขออนุมัติก่อน",
    reportTitle: "รายงานยอดขายประจำเดือน",
    month1: "ม.ค.",
    crashTabs: ["ยอดขาย", "งบประมาณ"],
    newItem: "ของหวาน",
    regions: [["ภาค", "ยอดขาย"], ["เหนือ", 1200], ["กลาง", 3400], ["ใต้", 900], ["เหนือ", 2100]],
    rangeName: "ยอดขาย",
    regionList: "เหนือ, กลาง, ใต้",
    totalLabel: "รวมทั้งหมด",
    template: {
      sheet: "ใบเสนอราคา",
      labels: ["ชื่อลูกค้า", "ความเร่งด่วน", "ราคาต่อหน่วย", "จำนวน", "ยอดก่อนภาษี", "ยอดรวม (VAT 7%)"],
      choices: "ด่วนมาก,ด่วน,ปกติ,ประหยัด",
    },
    quotation: {
      title: "ใบเสนอราคา — บริษัท ตัวอย่าง จำกัด",
      header: ["ลำดับ", "รายการ", "ราคา/หน่วย", "จำนวน", "รวม"],
      items: [["ออกแบบระบบรายงาน", 25000, 1], ["พัฒนาเว็บแอป", 180000, 1], ["อบรมการใช้งาน (ต่อวัน)", 12000, 3], ["ดูแลระบบรายปี", 48000, 1]],
      total: "รวมทั้งสิ้น",
    },
  },
  en: {
    header: ["Product", "Category", "Price", "Qty", "Total"],
    items: [["Caffè latte", "Drinks"]],
    findReplaceWith: "Beverages",
    aiQuestion: "Find the average price",
    ordersSource: "All orders",
    limitedSource: "Rate-limited API",
    branchMonths: [
      ["Branch", "Jan", "Feb", "Mar"],
      ["Bangkok", 182000, 205000, 246000],
      ["Chiang Mai", 94000, 88000, 102000],
      ["Phuket", 141000, 163000, 158000],
      ["Khon Kaen", 76000, 71000, 69000],
      ["Hat Yai", 52000, 61000, 58000],
    ],
    branchQuarters: [
      ["Branch", "Q1", "Q2"],
      ["Bangkok", 1240, 1580],
      ["Chiang Mai", 620, 740],
      ["Phuket", 980, 1190],
      ["Khon Kaen", 430, 510],
    ],
    comment: "Waiting on accounts to confirm this price — anything over 50 needs sign-off first",
    reportTitle: "Monthly sales report",
    month1: "Jan",
    crashTabs: ["Sales", "Budget"],
    newItem: "Desserts",
    regions: [["Region", "Sales"], ["North", 1200], ["Central", 3400], ["South", 900], ["North", 2100]],
    rangeName: "Sales",
    regionList: "North, Central, South",
    totalLabel: "Total",
    template: {
      sheet: "Quote",
      labels: ["Customer", "Urgency", "Unit price", "Quantity", "Before tax", "Total (VAT 7%)"],
      choices: "Rush,Urgent,Normal,Economy",
    },
    quotation: {
      title: "Quotation — Example Co., Ltd.",
      header: ["No.", "Item", "Unit price", "Qty", "Amount"],
      items: [["Reporting system design", 25000, 1], ["Web app development", 180000, 1], ["Training (per day)", 12000, 3], ["Annual support", 48000, 1]],
      total: "Grand total",
    },
  },
};

// ── Inputs the app is given ─────────────────────────────────────────────────────────────────────
const FIXTURES = mkdtempSync(path.join(tmpdir(), "exceltogo-fixtures-"));

/** Workbooks built the way someone builds them in Excel, with the ExcelJS the app itself ships. */
async function fixture(kind, lang) {
  const file = path.join(FIXTURES, `${kind}-${lang}.xlsx`);
  if (existsSync(file)) return file;
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  if (kind === "template") {
    // A protected quote form: white cells to fill, the rest locked, and a dropdown in B4.
    const w = W[lang].template;
    const ws = wb.addWorksheet(w.sheet);
    ws.getCell("A1").value = w.sheet;
    ws.getCell("A1").font = { bold: true, size: 18, color: { argb: "FF065F46" } };
    ws.mergeCells("A1:C1");
    w.labels.forEach((label, i) => {
      ws.getCell(`A${i + 3}`).value = label;
      ws.getCell(`A${i + 3}`).font = { bold: true };
    });
    ws.getCell("B5").value = 1200;
    ws.getCell("B6").value = 3;
    ws.getCell("B7").value = { formula: "B5*B6", result: 3600 };
    ws.getCell("B8").value = { formula: "B7*1.07", result: 3852 };
    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 14;
    for (const addr of ["B3", "B4", "B5", "B6"]) ws.getCell(addr).protection = { locked: false };
    ws.getCell("B4").dataValidation = { type: "list", allowBlank: true, formulae: [`"${w.choices}"`] };
    await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
  } else {
    // A styled quotation: merged title band, filled header, borders, number formats, a gold total.
    const q = W[lang].quotation;
    const ws = wb.addWorksheet(q.header[1] === "Item" ? "Quotation" : "ใบเสนอราคา");
    ws.columns = [{ width: 8 }, { width: 30 }, { width: 15 }, { width: 11 }, { width: 17 }];
    const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const thin = { style: "thin", color: { argb: "FF8A97A8" } };
    const box = { top: thin, left: thin, bottom: thin, right: thin };
    ws.mergeCells("A1:E1");
    Object.assign(ws.getCell("A1"), { value: q.title });
    ws.getCell("A1").fill = fill("FF1B5E3C");
    ws.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 30;
    q.header.forEach((h, i) => {
      const c = ws.getRow(2).getCell(i + 1);
      Object.assign(c, { value: h, fill: fill("FFDDEFE4"), font: { bold: true }, border: box, alignment: { horizontal: "center" } });
    });
    q.items.forEach(([name, price, qty], i) => {
      const r = ws.getRow(3 + i);
      r.getCell(1).value = i + 1;
      r.getCell(2).value = name;
      r.getCell(3).value = price;
      r.getCell(4).value = qty;
      r.getCell(5).value = { formula: `C${3 + i}*D${3 + i}` };
      for (let c = 1; c <= 5; c++) r.getCell(c).border = box;
      for (const c of [3, 4, 5]) r.getCell(c).numFmt = "#,##0.00";
    });
    ws.mergeCells("A7:D7");
    Object.assign(ws.getCell("A7"), { value: q.total, font: { bold: true }, alignment: { horizontal: "right" } });
    Object.assign(ws.getCell("E7"), { value: { formula: "SUM(E3:E6)" }, numFmt: "#,##0.00", font: { bold: true, size: 13 }, fill: fill("FFFFF2C7") });
    for (let c = 1; c <= 5; c++) ws.getRow(7).getCell(c).border = box;
  }
  await wb.xlsx.writeFile(file);
  return file;
}

/**
 * A source added through the API, the same call the setup dialog makes. Removed again when the
 * scene closes: the server keeps one list for every scene and both languages, and a source left
 * behind would turn up, in the wrong language, in the next picture of the panel.
 */
async function addSource(k, body) {
  const res = await fetch(`${ORIGIN}/api/sources`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sources-token": TOKEN },
    body: JSON.stringify({ method: "GET", ...body }),
  });
  if (!res.ok) throw new Error(`adding source "${body.name}" failed: ${res.status} ${await res.text()}`);
  const { id } = await res.json();
  k.created.push(id);
  return id;
}

// ── Steps several scenes share ──────────────────────────────────────────────────────────────────
async function startBlank(k) {
  await k.button(k.t.sampleNotice.startBlank).click();
  await k.settle(300);
}

async function openData(k, { blank = false, ...view } = {}) {
  await k.open("/app", { unlocked: true, ...view });
  if (blank) await startBlank(k);
  await k.button(k.t.toolbar.data).click();
  await k.button(k.t.data.use).first().waitFor({ timeout: 15_000 });
  await k.settle(600);
}

/** The picker for one source: by position in the panel, or by the name it was given. */
async function openPicker(k, which) {
  const use =
    typeof which === "number"
      ? k.button(k.t.data.use).nth(which)
      : k.page.locator("li, [data-source-row], div.rounded-lg").filter({ hasText: which }).last().getByRole("button", { name: k.t.data.use, exact: true });
  await use.click();
  await k.page.getByRole("dialog").waitFor();
  await k.settle(800);
}

async function insertFromSource(k, which) {
  await openPicker(k, which);
  await k.page.getByRole("dialog").getByRole("button", { name: k.t.data.picker.insert, exact: true }).click();
  await k.settle(800);
}

/** Hands the file to the import button's input, and waits until its first cell is on screen. */
async function importFile(k, file, firstCell) {
  await k.page.locator('input[type="file"]').first().setInputFiles(file);
  await k.page.waitForFunction(
    (text) => document.querySelector('td[data-row="0"][data-col="0"]')?.textContent?.trim() === text,
    firstCell,
    { timeout: 20_000 }
  );
  await k.settle(600);
}

/** Sample data → pivot by category, totalling the Total column → the new summary sheet. */
async function buildPivot(k) {
  await k.select(0, 0, 9, 4);
  await k.button(k.t.pivot.title).click();
  await pickPivotFields(k);
  await k.button(k.t.pivot.build).click();
  await k.settle(600);
}

/** Group by Category alone — the panel starts with the first column picked — and total Total. */
async function pickPivotFields(k) {
  const [first, category, , , total] = W[k.lang].header;
  const chip = (name) => k.page.getByRole("button", { name, exact: true }).first();
  await chip(first).click();
  await chip(category).click();
  await k.page.getByLabel(k.t.pivot.valueField).selectOption({ label: total });
}

/** A finger drag. Playwright's touchscreen only taps, so the touch events go straight over CDP. */
async function dragTouch(page, from, to) {
  const cdp = await page.context().newCDPSession(page);
  const at = (x, y) => [{ x, y, id: 1 }];
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(start.x, start.y) });
  for (let i = 1; i <= 10; i++) {
    const x = start.x + ((to.x - start.x) * i) / 10;
    const y = start.y + ((to.y - start.y) * i) / 10;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(x, y) });
    await delay(30);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Frames to an animated GIF, each held for as long as it was meant to be read. */
async function gif(frames, out, width) {
  const { default: sharp } = await import("sharp");
  const resized = await Promise.all(frames.map((f) => sharp(f.png).resize({ width }).png().toBuffer()));
  await sharp(resized, { join: { animated: true } })
    .gif({ delay: frames.map((f) => f.ms), loop: 0, colours: 128, effort: 7 })
    .toFile(out);
}

// ── The scenes ──────────────────────────────────────────────────────────────────────────────────
// In the order the files are numbered. `cloud: true` needs the build with cloud save configured.
const SCENES = [
  {
    file: "01-overview.png",
    async take(k) {
      await k.open();
      await k.shot(this.file);
    },
  },
  {
    // The parameter panel for SUM, with the range typed where a person would drag it out.
    file: "02-formula-panel.png",
    async take(k) {
      await k.open();
      await k.cell(11, 2).click();
      await k.page.locator('[aria-label^="SUM - "]').first().click();
      await k.page.getByPlaceholder(k.t.formulas.SUM.params.range.placeholder, { exact: true }).fill("C2:C4");
      await k.shot(this.file);
    },
  },
  {
    file: "03-after-insert.png",
    async take(k) {
      await k.open();
      await k.cell(11, 2).click();
      await k.page.locator('[aria-label^="SUM - "]').first().click();
      await k.page.getByPlaceholder(k.t.formulas.SUM.params.range.placeholder, { exact: true }).fill("C2:C4");
      await k.button(k.t.paramPanel.insert).click();
      await k.cell(11, 2).click();
      await k.shot(this.file);
    },
  },
  {
    file: "05-sheet-tabs.png",
    async take(k) {
      await k.open();
      const add = k.byTitle(k.t.sheetTabs.addTitle);
      await add.click();
      await add.click();
      await k.page.getByRole("tab").first().click().catch(async () => k.page.getByText("Sheet1", { exact: true }).first().click());
      await k.cell(10, 3).click();
      await k.shot(this.file);
    },
  },
  {
    // Currency on the Total column, and the Category filter open over it.
    file: "06-format-filter.png",
    async take(k) {
      await k.open();
      await k.select(1, 4, 9, 4);
      await k.page.getByRole("combobox", { name: k.t.formatBar.numberFormatTitle }).selectOption({ label: k.t.numberFormats.currency });
      await k.page.getByTitle(k.t.grid.filterColumnTitle).nth(1).click();
      await k.shot(this.file);
    },
  },
  {
    // The other language, one click away: the Thai README shows English and the English one Thai.
    file: "07-language-switch.png",
    async take(k) {
      await k.open();
      await k.page.getByRole("button", { name: k.t.app.languageToggleTitle }).click();
      await k.settle(600);
      await k.shot(this.file);
    },
  },
  {
    // Without a key this is the keyword matcher, and the panel says so under the answer. With
    // SCREENSHOT_ANTHROPIC_KEY set it asks the real Claude through the panel's own key box. Either
    // way it is the app's answer: nothing here types one in.
    file: "04-ai-assistant.png",
    async take(k) {
      await k.open();
      // Straight under the prices, so the range the app works out from the cursor is C2:C10.
      await k.cell(10, 2).click();
      await k.button(k.t.toolbar.askAi).first().click();
      const key = process.env.SCREENSHOT_ANTHROPIC_KEY;
      if (key) {
        await k.page.locator("#byok-key").fill(key);
        await k.button(k.t.ai.byok.save).click();
      }
      await k.page.getByPlaceholder(k.t.ai.textareaPlaceholder).fill(W[k.lang].aiQuestion);
      await k.button(k.t.ai.askButton).last().click();
      const insert = k.button(k.t.ai.insertAt("C11"));
      await insert.waitFor({ timeout: 30_000 });
      await insert.scrollIntoViewIfNeeded();
      await k.shot(this.file);
    },
  },
  {
    file: "08-live-data.png",
    async take(k) {
      await openData(k, { blank: true });
      await insertFromSource(k, 0);
      await k.cell(0, 0).click();
      await k.settle(800);
      await k.shot(this.file);
    },
  },
  {
    file: "09-source-setup.png",
    async take(k) {
      await openData(k, { width: 1100, height: 820 });
      await k.button(k.t.data.addSource).click();
      await k.page.getByRole("dialog").waitFor();
      await k.shot(this.file);
    },
  },
  {
    file: "10-picker-table.png",
    async take(k) {
      await openData(k);
      await openPicker(k, 0);
      await k.shot(this.file);
    },
  },
  {
    file: "11-block-toolbar.png",
    async take(k) {
      await openData(k, { blank: true });
      await insertFromSource(k, 0);
      await k.cell(2, 1).click();
      await k.settle(800);
      await k.shot(this.file);
    },
  },
  {
    file: "12-picker-values.png",
    async take(k) {
      await openData(k);
      await openPicker(k, 0);
      await k.page.getByRole("dialog").getByText(k.t.data.picker.summaryValue).click();
      await k.settle(600);
      await k.page.getByRole("dialog").locator("button").filter({ hasText: /^\d[\d,.]*/ }).first().click();
      await k.shot(this.file);
    },
  },
  {
    // The built-in order feed, capped under the 25 rows its first page already holds. (Not 40
    // across two pages: on localhost the server will not follow a next-page link, which is the
    // guard doing its job, so a cap only a second page could reach would never be hit.)
    file: "13-partial-data.png",
    async take(k) {
      await addSource(k, { name: W[k.lang].ordersSource, type: "rest", url: "/api/demo/orders", maxRows: 20, refreshSec: 30 });
      await openData(k, { blank: true });
      await openPicker(k, W[k.lang].ordersSource);
      await k.page.getByRole("dialog").getByText(k.t.data.partial(20)).first().waitFor();
      await k.shot(this.file);
    },
  },
  {
    // See the header: the app's data route answers with what the server sends for an upstream 429.
    file: "14-rate-limited.png",
    async take(k) {
      const id = await addSource(k, { name: W[k.lang].limitedSource, type: "rest", url: "https://api.example.com/orders", refreshSec: 10 });
      await openData(k, {
        prepare: (page) =>
          page.route(`**/api/sources/${id}/data**`, (route) =>
            route.fulfill({
              status: 429,
              headers: { "retry-after": "40" },
              contentType: "application/json",
              body: JSON.stringify({ error: "rate_limited", retryAfterSec: 40 }),
            })
          ),
      });
      // The countdown and "Try now" sit under the message; bring the whole notice into view.
      const retry = k.button(k.t.data.retryNow);
      await retry.waitFor({ timeout: 20_000 });
      await retry.scrollIntoViewIfNeeded();
      await k.settle(1200);
      await k.shot(this.file);
    },
  },
  {
    file: "15-template.png",
    async take(k) {
      await k.open();
      await importFile(k, await fixture("template", k.lang), W[k.lang].template.sheet);
      await k.cell(2, 1).click();
      await k.shot(this.file);
    },
  },
  {
    file: "16-template-dropdown.png",
    async take(k) {
      await k.open();
      await importFile(k, await fixture("template", k.lang), W[k.lang].template.sheet);
      await k.cell(3, 1).click();
      await k.shot(this.file);
    },
  },
  {
    file: "17-styled-import.png",
    async take(k) {
      await k.open();
      await importFile(k, await fixture("quotation", k.lang), W[k.lang].quotation.title);
      await k.cell(0, 0).click();
      await k.shot(this.file);
    },
  },
  {
    // A colour scale across the months and a data bar on the quarter's last one.
    file: "18-conditional-format.png",
    async take(k) {
      await k.open();
      await startBlank(k);
      await k.fill(0, 0, W[k.lang].branchMonths);
      await k.select(1, 1, 5, 2);
      await k.button(k.t.conditionalFormat.title).click();
      await k.page.locator("#cf-kind").selectOption("colorScale");
      await k.button(k.t.conditionalFormat.add).click();
      await k.select(1, 3, 5, 3);
      await k.page.locator("#cf-kind").selectOption("dataBar");
      await k.button(k.t.conditionalFormat.add).click();
      await k.select(1, 1, 5, 2);
      await k.shot(this.file);
    },
  },
  {
    file: "19-mobile.png",
    async take(k) {
      await k.open("/app", { width: 390, height: 844, scale: 3, touch: true });
      await k.shot(this.file);
    },
  },
  {
    file: "20-charts.png",
    async take(k) {
      await k.open();
      await startBlank(k);
      await k.fill(0, 0, W[k.lang].branchQuarters);
      await k.select(0, 0, 4, 2);
      await k.button(k.t.charts.title).click();
      const panel = k.page.getByText(k.t.charts.rangeHint).locator("xpath=..");
      await panel.getByRole("button", { name: k.t.charts.kinds.bar }).click();
      await k.select(0, 0, 4, 2);
      await panel.getByRole("button", { name: k.t.charts.kinds.pie }).click();
      await k.cell(0, 0).click();
      await k.shot(this.file);
    },
  },
  {
    // A finger: tap a cell, then pull the grip on its corner out to a range.
    file: "21-touch-select.png",
    async take(k) {
      await k.open("/app", { width: 420, height: 780, scale: 2, touch: true });
      await k.cell(1, 0).tap();
      const grip = k.page.getByLabel(k.t.grid.extendSelection).first();
      const from = await grip.boundingBox();
      const to = await k.cell(4, 1).boundingBox();
      await dragTouch(k.page, from, { x: to.x + to.width / 2, y: to.y + to.height / 2 });
      await k.shot(this.file);
    },
  },
  {
    file: "22-cell-comment.png",
    async take(k) {
      await k.open();
      await k.cell(1, 2).click();
      await k.button(k.t.comments.title).click();
      await k.page.getByPlaceholder(k.t.comments.placeholder).fill(W[k.lang].comment);
      await k.shot(this.file);
    },
  },
  {
    cloud: true,
    file: "23-cloud-save.png",
    async take(k) {
      await k.open();
      await k.button(k.t.cloud.title).first().click();
      await k.page.getByPlaceholder(k.t.cloud.emailPlaceholder).waitFor();
      await k.shot(this.file);
    },
  },
  {
    // No token: the panel asks for one, and nothing has been fetched.
    file: "24-sources-locked.png",
    async take(k) {
      await k.open();
      await k.button(k.t.toolbar.data).click();
      await k.page.getByPlaceholder(k.t.data.tokenPlaceholder).waitFor();
      await k.shot(this.file);
    },
  },
  {
    file: "25-landing.png",
    async take(k) {
      await k.open("/", { height: 900 });
      await k.shot(this.file);
    },
  },
  {
    // A formula below the insert point: =SUM(C2:C4) in G2 becomes =SUM(C2:C5) by itself.
    file: "26-insert-row.png",
    async take(k) {
      await k.open();
      await k.type(1, 6, "=SUM(C2:C4)");
      await k.cell(2, 0).click();
      await k.page.locator('tr[aria-rowindex="4"] > th').click({ button: "right" });
      await k.page.getByRole("button", { name: k.t.grid.insertRowAbove }).first().click();
      await k.cell(1, 6).click();
      await k.scrollHome();
      await k.shot(this.file, { clip: { x: 0, y: 0, width: 1360, height: 560 } });
    },
  },
  {
    file: "27-landing-stats.png",
    async take(k) {
      await k.open("/", { height: 900 });
      await k.shot(this.file, { fullPage: true, clip: await k.boxOf(k.page.locator("section.bg-ink")) });
    },
  },
  {
    file: "28-pivot-panel.png",
    async take(k) {
      await k.open();
      await k.select(0, 0, 9, 4);
      await k.button(k.t.pivot.title).click();
      await pickPivotFields(k);
      await k.shot(this.file);
    },
  },
  {
    file: "29-pivot-result.png",
    async take(k) {
      await k.open();
      await buildPivot(k);
      await k.shot(this.file, { clip: { x: 0, y: 0, width: 1100, height: 470 } });
    },
  },
  {
    file: "30-merge-cells.png",
    async take(k) {
      await k.open();
      await k.type(12, 0, W[k.lang].reportTitle);
      await k.select(12, 0, 12, 4);
      await k.button(k.t.merge.join).click();
      await k.shot(this.file, { clip: { x: 0, y: 0, width: 1360, height: 640 } });
    },
  },
  {
    // The source moves after the summary was built: the summary says so, and offers to catch up.
    file: "31-pivot-refresh.png",
    async take(k) {
      await k.open();
      await buildPivot(k);
      await k.page.getByText("Sheet1", { exact: true }).first().click();
      await k.type(2, 2, "99");
      await k.page.getByText(k.t.pivot.sheetName, { exact: true }).first().click();
      await k.page.getByText(k.t.pivot.sourceChanged).waitFor();
      await k.shot(this.file, { clip: { x: 0, y: 0, width: 1100, height: 470 } });
    },
  },
  {
    file: "32-landing-compare.png",
    async take(k) {
      await k.open("/", { height: 900 });
      const region = k.page.getByRole("region", { name: k.t.landing.compare.title });
      await k.shot(this.file, { fullPage: true, clip: await k.boxOf(region.locator("xpath=ancestor::section[1]/div")) });
    },
  },
  {
    // An obviously fake key: saving it only writes sessionStorage; nothing is sent until someone asks.
    file: "33-byok.png",
    async take(k) {
      await k.open("/app", { scale: 2.5 });
      await k.button(k.t.toolbar.askAi).first().click();
      await k.page.locator("#byok-key").fill("sk-ant-api03-demo-not-a-real-key-000000001234");
      await k.button(k.t.ai.byok.save).click();
      const panel = k.page.locator("div.rounded-md.border", { has: k.page.getByText(k.t.ai.byok.title, { exact: true }) }).first();
      await panel.waitFor();
      await k.settle();
      await panel.screenshot({ path: path.join(outDir(k.lang), this.file) });
    },
  },
  {
    // Recorded, not assembled: a blank sheet, the built-in sales feed inserted, then the cells
    // moving on their own as the feed changes every five seconds.
    file: "34-live-data.gif",
    async take(k) {
      await openData(k, { blank: true, width: 1180, height: 640, scale: 1.5 });
      const frames = [];
      // Scrolled home first: clicking a toolbar button scrolls the toolbar to it, which at this
      // width pushes the name off the left edge of every frame after.
      const grab = async (ms) => {
        await k.scrollHome();
        frames.push({ png: await k.page.screenshot(), ms });
      };
      await grab(1200);
      await openPicker(k, 0);
      await grab(1600);
      await k.page.getByRole("dialog").getByRole("button", { name: k.t.data.picker.insert }).click();
      await k.settle(600);
      for (let i = 0; i < 16; i++) {
        await grab(1000);
        await delay(1000);
      }
      await gif(frames, path.join(outDir(k.lang), this.file), 1000);
    },
  },
  {
    file: "35-shortcuts.png",
    async take(k) {
      await k.open();
      await k.cell(0, 0).click();
      await k.page.keyboard.press("Control+/");
      const dialog = k.page.getByRole("dialog");
      await dialog.waitFor();
      await k.settle();
      await dialog.screenshot({ path: path.join(outDir(k.lang), this.file) });
    },
  },
  {
    file: "36-find-replace.png",
    async take(k) {
      await k.open("/app", { height: 900 });
      await k.cell(0, 0).click();
      await k.page.keyboard.press("Control+f");
      await k.page.getByPlaceholder(k.t.find.searchPlaceholder, { exact: true }).fill(W[k.lang].items[0][1]);
      await k.page.getByPlaceholder(k.t.find.replacePlaceholder, { exact: true }).fill(W[k.lang].findReplaceWith);
      await k.page.keyboard.press("Enter");
      await k.shot(this.file);
    },
  },
  {
    // Caught mid-drag: the dashed outline is where the series will land when the mouse lets go.
    file: "37-fill-handle.png",
    async take(k) {
      await k.open("/app", { height: 900 });
      await k.type(13, 6, W[k.lang].month1);
      await k.type(13, 7, "1000");
      await k.select(13, 6, 13, 7);
      const box = await k.page.getByTitle(k.t.grid.fillHandle).first().boundingBox();
      const to = await k.cell(18, 7).boundingBox();
      await k.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await k.page.mouse.down();
      await k.page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
      await k.shot(this.file);
      await k.page.mouse.up();
    },
  },
  {
    file: "38-landing-problems.png",
    async take(k) {
      await k.open("/", { height: 900 });
      const section = await k.boxOf(k.page.locator("#pains-title").locator("xpath=ancestor::section[1]"));
      const first = await k.boxOf(k.page.locator("#formulas"));
      await k.shot(this.file, {
        fullPage: true,
        clip: { x: section.x, y: section.y, width: section.width, height: first.y + first.height - section.y + 24 },
      });
    },
  },
  {
    // The error screen, reached the way the error boundary is tested: `?crash=1` throws on render.
    // The workbook is what the store would have saved, so the rescue has something real to offer.
    file: "39-crash-rescue.png",
    async take(k) {
      const [first, second] = W[k.lang].crashTabs;
      await k.open("/app", {
        width: 960,
        height: 900,
        prepare: (page) =>
          page.addInitScript(
            ({ first, second, header }) => {
              const sheet = (cells) => ({ rows: cells.length, cols: cells[0].length, cells });
              localStorage.setItem(
                "exceltogo-sheet-v2",
                JSON.stringify({
                  state: {
                    sheets: [
                      { id: "a", name: first, sheet: sheet([header.slice(0, 3), ["1", "65", "=B2*2"]]) },
                      { id: "b", name: second, sheet: sheet([header.slice(0, 3), ["2", "45", "=B2*2"]]) },
                    ],
                    activeSheetId: "a",
                  },
                  version: 0,
                })
              );
            },
            { first, second, header: W[k.lang].header }
          ),
      });
      await k.page.goto(ORIGIN + "/app?crash=1", { waitUntil: "networkidle" });
      await k.page.locator("h1").first().waitFor();
      await k.shot(this.file);
    },
  },
  {
    file: "40-array-spill.png",
    async take(k) {
      await k.open();
      await k.type(0, 5, "=UNIQUE(B2:B10)");
      await k.type(0, 6, "=SORT(E2:E10,1,-1)");
      await k.type(0, 7, "=FILTER(A2:A10,E2:E10>1000)");
      await k.cell(0, 5).click();
      const grid = await k.boxOf(k.page.locator("table").first());
      await k.shot(this.file, { clip: { x: grid.x, y: grid.y, width: Math.min(grid.width, 950), height: 300 } });
    },
  },
  {
    file: "41-precedents.png",
    async take(k) {
      await k.open();
      await k.type(0, 5, "=SUM(C2:C5)+D2");
      await k.cell(0, 5).click();
      const bar = await k.boxOf(k.page.getByText("fx", { exact: true }).first().locator("xpath=.."));
      await k.shot(this.file, { clip: { x: 0, y: bar.y - 6, width: 1352, height: 300 } });
    },
  },
  {
    // The same refusal the e2e flow uses: storage throws the way a full quota does.
    file: "42-save-failed.png",
    async take(k) {
      await k.open();
      await k.page.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === "exceltogo-sheet-v2") throw new DOMException("Setting the value exceeded the quota.", "QuotaExceededError");
          return original.call(this, key, value);
        };
      });
      await k.type(13, 0, W[k.lang].newItem);
      await k.page.getByRole("alert").filter({ has: k.button(k.t.toolbar.exportExcel) }).waitFor({ timeout: 5000 });
      await k.shot(this.file);
    },
  },
  {
    // Both halves of "rules on a sheet": a name the total reads by, and a list column A accepts.
    file: "43-sheet-rules.png",
    async take(k) {
      await k.open();
      await startBlank(k);
      const w = W[k.lang];
      await k.fill(0, 0, w.regions);
      await k.select(1, 1, 4, 1);
      await k.button(k.t.names.short).click();
      await k.page.getByPlaceholder(k.t.names.namePlaceholder).fill(w.rangeName);
      await k.button(k.t.names.add).click();
      await k.page.keyboard.press("Escape");
      await k.select(1, 0, 4, 0);
      await k.button(k.t.validation.short).click();
      await k.page.getByPlaceholder(k.t.validation.listPlaceholder).fill(w.regionList);
      await k.button(k.t.validation.apply).click();
      await k.page.keyboard.press("Escape");
      await k.type(6, 0, w.totalLabel);
      await k.type(6, 1, `=SUM(${w.rangeName})`);
      await k.cell(6, 1).click();
      await k.button(k.t.names.short).click();
      await k.shot(this.file, { clip: { x: 0, y: 0, width: 1360, height: 600 } });
    },
  },
  {
    // The README's three steps, played in order on the sample: a price, a pivot, a stale pivot.
    file: "demo.gif",
    async take(k) {
      await k.open("/app", { width: 1180, height: 640, scale: 1.5 });
      const frames = [];
      // Scrolled home first: clicking a toolbar button scrolls the toolbar to it, which at this
      // width pushes the name off the left edge of every frame after.
      const grab = async (ms) => {
        await k.scrollHome();
        frames.push({ png: await k.page.screenshot(), ms });
      };
      await grab(1400);
      await k.cell(1, 2).click();
      await grab(600);
      await k.page.keyboard.press("F2");
      await k.page.keyboard.press("Control+a");
      await k.page.keyboard.insertText("100");
      await grab(700);
      await k.page.keyboard.press("Enter");
      await k.settle(300);
      await grab(2000);
      await k.select(0, 0, 9, 4);
      await k.button(k.t.pivot.title).click();
      await k.settle(300);
      await grab(1200);
      await pickPivotFields(k);
      await grab(1400);
      await k.button(k.t.pivot.build).click();
      await k.settle(500);
      await grab(2200);
      await k.page.getByText("Sheet1", { exact: true }).first().click();
      await k.settle(300);
      await grab(700);
      await k.type(2, 2, "99");
      await k.settle(300);
      await grab(1200);
      await k.page.getByText(k.t.pivot.sheetName, { exact: true }).first().click();
      await k.settle(400);
      await grab(2200);
      await k.button(k.t.pivot.refresh).click();
      await k.settle(400);
      await grab(3000);
      await gif(frames, path.join(outDir(k.lang), this.file), 1000);
    },
  },
];

SCENES.sort((a, b) => a.file.localeCompare(b.file));

// ── Run ─────────────────────────────────────────────────────────────────────────────────────────
const wanted = SCENES.filter((s) => !ONLY || ONLY.some((o) => s.file.startsWith(o)));
if (wanted.length === 0) throw new Error(`--only ${ONLY} matches no scene`);
for (const lang of LANGS) mkdirSync(outDir(lang), { recursive: true });

const M = await loadMessages();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--font-render-hinting=none"] });
const failed = [];

for (const cloud of [true, false]) {
  const batch = wanted.filter((s) => Boolean(s.cloud) === cloud);
  if (batch.length === 0) continue;
  if (BUILD) {
    console.log(`\nbuilding ${cloud ? "with cloud save configured" : "the plain app"}…`);
    await run("npx", ["next", "build"], cloud ? CLOUD_ENV : PLAIN_ENV);
  }
  const server = await serve(cloud ? CLOUD_ENV : PLAIN_ENV);
  for (const lang of LANGS) {
    const kit = sceneKit(browser, lang, M);
    for (const scene of batch) {
      const label = `${lang}/${scene.file}`;
      try {
        await scene.take(kit);
        console.log(`  ok    ${label}`);
      } catch (err) {
        failed.push(label);
        console.log(`  FAIL  ${label}\n        ${String(err.message).split("\n")[0]}`);
        // What the page looked like when it gave up, for whoever has to work out why.
        if (process.env.SCREENSHOT_DEBUG && kit.page) {
          await kit.page.screenshot({ path: path.join(process.env.SCREENSHOT_DEBUG, `${lang}-${scene.file}.png`) }).catch(() => {});
        }
      } finally {
        await kit.close();
      }
    }
  }
  await server.stop();
}
// Only cloud scenes were asked for: put the plain build back, which is the one every gate expects.
if (BUILD && wanted.every((s) => s.cloud)) {
  console.log("\nrestoring the plain build…");
  await run("npx", ["next", "build"], PLAIN_ENV);
}

await browser.close();
rmSync(FIXTURES, { recursive: true, force: true });
if (failed.length) {
  console.log(`\n${failed.length} scene(s) failed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log("\nLook at every image, then: npm run check:screens -- --bless");
