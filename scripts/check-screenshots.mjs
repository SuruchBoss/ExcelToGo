#!/usr/bin/env node
// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * A screenshot makes claims, and no other gate can read one.
 *
 * `check:readme` counts tests in *text*, so a landing-page image reading "519 tests" passed every
 * gate for days while the real figure was 577. It happened again at 980. Both times the image was
 * correct when it was taken and quietly stopped being correct afterwards, which is the whole
 * difficulty: nothing was wrong at the moment anyone looked.
 *
 * So each screenshot declares which counted figures it *shows*, and `screenshots.json` records
 * what those figures were when it was last taken. When a count moves and an image that shows it
 * has not been retaken, this says so by name. It cannot read the pixels; it can notice that the
 * world moved under them, which is the part that went wrong twice.
 *
 * Every file in `public/screenshots/` must appear below, including the ones that show no figure at
 * all — an empty list is a decision, a missing entry is an oversight, and the difference is
 * exactly what this is for.
 *
 * There is a set per language — Thai at the root, English in `en/` — and each must hold every
 * scene below, no more and no fewer. The English README showed the Thai app in 43 of its 44
 * pictures because nothing counted the pictures by language; now a scene missing from one set
 * fails here. The figures are checked in every set, since a stale number reads as stale in either.
 *
 *   npm run check:screens            check
 *   npm run check:screens -- --bless record today's figures, after retaking
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { counts } from "./counts.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SHOTS = path.join(ROOT, "public", "screenshots");
const RECORD = path.join(SHOTS, "screenshots.json");

/** Which counted figures each image has printed on it. `[]` means "read it, and it shows none". */
const SHOWS = {
  "01-overview.png": [],
  "02-formula-panel.png": [],
  "03-after-insert.png": [],
  "04-ai-assistant.png": [],
  "05-sheet-tabs.png": [],
  "06-format-filter.png": [],
  // The other language, one click away: the Thai set shows it in English, the English set in Thai.
  "07-language-switch.png": [],
  "08-live-data.png": [],
  "09-source-setup.png": [],
  "10-picker-table.png": [],
  "11-block-toolbar.png": [],
  "12-picker-values.png": [],
  "13-partial-data.png": [],
  "14-rate-limited.png": [],
  "15-template.png": [],
  "16-template-dropdown.png": [],
  "17-styled-import.png": [],
  "18-conditional-format.png": [],
  "19-mobile.png": [],
  "20-charts.png": [],
  "21-touch-select.png": [],
  "22-cell-comment.png": [],
  "23-cloud-save.png": [],
  "24-sources-locked.png": [],
  // The hero: the eyebrow prints the test count, the paragraph under it the palette's size.
  "25-landing.png": ["tests", "paletteFormulas"],
  "26-insert-row.png": [],
  // The stat strip. All four figures, which is why this is the one that went wrong twice.
  "27-landing-stats.png": ["paletteFormulas", "engineFunctions", "tests", "securityTests"],
  // Nothing counted is printed on it — the numbers in the sheet are the sheet's own.
  "43-sheet-rules.png": [],
  "28-pivot-panel.png": [],
  "29-pivot-result.png": [],
  "30-merge-cells.png": [],
  "31-pivot-refresh.png": [],
  "32-landing-compare.png": [],
  "33-byok.png": [],
  "34-live-data.gif": [],
  "35-shortcuts.png": [],
  "36-find-replace.png": [],
  "37-fill-handle.png": [],
  // "เลือกจากสูตรพร้อมใช้ 37 แบบ", in the first scenario.
  "38-landing-problems.png": ["paletteFormulas"],
  "39-crash-rescue.png": [],
  "40-array-spill.png": [],
  "41-precedents.png": [],
  // The alert a refused save raises. The sheet's numbers are the sample's own, not counted figures.
  "42-save-failed.png": [],
  "demo.gif": [],
};

const bless = process.argv.includes("--bless");
const now = counts();
/** One folder per language; the key each image is recorded under is its path inside public/screenshots/. */
const SETS = ["", "en"];
const failures = [];
let total = 0;
for (const set of SETS) {
  const dir = path.join(SHOTS, set);
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name !== "screenshots.json")
    .map((e) => e.name);
  total += files.length;
  const where = `public/screenshots/${set ? `${set}/` : ""}`;
  for (const file of files) {
    if (!(file in SHOWS)) {
      failures.push(`${where}${file} is not in SHOWS — say which counted figures it prints, or \`[]\` if none`);
    }
  }
  for (const file of Object.keys(SHOWS)) {
    if (!files.includes(file)) failures.push(`${file} is listed in SHOWS but is not in ${where} — take it with \`npm run screenshots\``);
  }
}
const keyOf = (set, file) => (set ? `${set}/${file}` : file);

let record = {};
try {
  record = JSON.parse(readFileSync(RECORD, "utf8"));
} catch {
  if (!bless) failures.push("screenshots.json is missing — run `npm run check:screens -- --bless` after taking them");
}

if (bless) {
  const next = {};
  for (const set of SETS) {
    for (const [file, keys] of Object.entries(SHOWS)) {
      if (keys.length === 0) continue;
      next[keyOf(set, file)] = Object.fromEntries(keys.map((key) => [key, now[key]]));
    }
  }
  writeFileSync(RECORD, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`check:screens — recorded today's figures for ${Object.keys(next).length} screenshots.`);
  process.exit(0);
}

let checked = 0;
for (const set of SETS) {
  for (const [file, keys] of Object.entries(SHOWS)) {
    if (keys.length === 0) continue;
    const key = keyOf(set, file);
    const was = record[key];
    if (!was) {
      failures.push(`${key} shows ${keys.join(", ")} but nothing was recorded for it`);
      continue;
    }
    for (const figure of keys) {
      checked++;
      if (was[figure] !== now[figure]) {
        failures.push(`${key} was taken when ${figure} was ${was[figure]}; it is ${now[figure]} now — retake it`);
      }
    }
  }
}

console.log(`check:screens — ${total} screenshots in ${SETS.length} languages, ${checked} printed figures checked`);
if (failures.length > 0) {
  console.log("\ncheck:screens failed:");
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(
    "\nRetake the image from a production build, then run `npm run check:screens -- --bless`.\n" +
      "Bless without retaking and this gate is worth nothing — that is the one way to misuse it."
  );
  process.exit(1);
}
console.log("check:screens — every figure printed on a screenshot still matches the source.");
