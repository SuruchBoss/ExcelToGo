#!/usr/bin/env node
// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Renders `public/social-preview.png` — the 1280×640 image GitHub shows when the repo is pasted
 * into LinkedIn, Slack or a résumé.
 *
 * The app's own link preview (`src/app/opengraph-image.tsx`) is generated per request precisely so
 * that no binary can drift. GitHub's social preview cannot work that way: it is an upload in the
 * repository's settings, not a URL, so a committed file is the only option. What can be kept honest
 * is where its numbers come from — they are counted from the source here, by the same rules
 * `check:readme` uses, rather than typed into a design. The OG component had "505 automated tests"
 * painted into it for months, which is exactly the failure this avoids.
 *
 * Re-run after anything the card states changes: `npm run build:social`.
 *
 * Thai renders because the repo already carries Noto Sans Thai for the PDF export; it is inlined as
 * a data URI so the render does not depend on a font being installed on whatever machine runs this.
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { ROOT, counts } from "./counts.mjs";

const { engineFunctions, paletteFormulas, tests, securityTests } = counts();

const stats = [
  [String(engineFunctions), "ฟังก์ชันในเอนจิน", "engine functions"],
  [String(paletteFormulas), "สูตรพร้อมใช้", "ready-made formulas"],
  [String(tests), "เทสต์อัตโนมัติ", "automated tests"],
  [String(securityTests), "ด้านความปลอดภัย", "of them security"],
  ["0", "ไลบรารีคำนวณสูตร", "formula libraries"],
];

const thai = fs.readFileSync(path.join(ROOT, "public/fonts/NotoSansThai-Regular.ttf")).toString("base64");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Noto Sans Thai"; src: url(data:font/ttf;base64,${thai}) format("truetype"); font-weight: 400; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 1280px; height: 640px; background: #fbfaf7; color: #16181d;
       font-family: "Noto Sans Thai", sans-serif; -webkit-font-smoothing: antialiased; }
.page { height: 100%; padding: 46px 72px 44px; display: flex; flex-direction: column; }
.eyebrow { display: flex; align-items: center; gap: 14px; color: #0b6b4f; font-size: 23px; letter-spacing: .5px; }
.sq { width: 16px; height: 16px; background: #0b6b4f; }
h1 { font-size: 52px; line-height: 1.22; letter-spacing: -1px; margin-top: 22px; max-width: 1120px;
     font-weight: 400; -webkit-text-stroke: 1px #16181d; }
.mono { font-family: ui-monospace, "DejaVu Sans Mono", monospace; font-size: 21px; color: #0b6b4f;
       margin-top: 20px; padding: 11px 16px; border: 1px solid #e3e1da; background: #fff; display: inline-block; }
.sub { font-size: 22px; color: #6b6f76; margin-top: 16px; max-width: 1040px; line-height: 1.42; }
.spacer { flex: 1; }
.stats { display: flex; border-top: 2px solid #16181d; padding-top: 20px; }
.stat { flex: 1; padding-left: 22px; border-left: 1px solid #e3e1da; }
.stat:first-child { padding-left: 0; border-left: none; }
.n { font-size: 44px; color: #0b6b4f; -webkit-text-stroke: .9px #0b6b4f; line-height: 1.1; }
.l { font-size: 19px; color: #16181d; margin-top: 6px; }
.l small { display: block; font-size: 15px; color: #6b6f76; margin-top: 2px; }
.url { margin-top: 16px; font-size: 19px; color: #6b6f76; }
</style></head><body><div class="page">
  <div class="eyebrow"><div class="sq"></div><div>ExcelToGo · ไม่ต้องจำสูตร ไม่ต้องสมัคร ไม่ต้องอัปโหลด</div></div>
  <h1>พิมพ์เป็นภาษาไทย แล้วได้สูตร Excel ที่ใช้ได้จริง</h1>
  <div class="mono">“รวมยอดขายเฉพาะสาขาเหนือ”&nbsp;&nbsp;→&nbsp;&nbsp;=SUMIF(B2:B50,"เหนือ",D2:D50)</div>
  <div class="sub">Describe what you want and get a working Excel formula back, with an explanation. Or pick from ${paletteFormulas} ready-made formulas and drag across the cells instead of typing addresses.</div>
  <div class="url">excel-to-go.vercel.app</div>
  <div class="spacer"></div>
  <div class="stats">${stats
    .map(([n, th, en]) => `<div class="stat"><div class="n">${n}</div><div class="l">${th}<small>${en}</small></div></div>`)
    .join("")}</div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const out = "public/social-preview.png";
await page.screenshot({ path: path.join(ROOT, out) });
await browser.close();

console.log(`${out} — 1280x640 · ${stats.map(([n, , en]) => `${n} ${en}`).join(" · ")}`);
