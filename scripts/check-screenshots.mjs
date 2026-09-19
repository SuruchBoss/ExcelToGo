#!/usr/bin/env node
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
  "07-english-ui.png": [],
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
  "demo.gif": [],
};

const bless = process.argv.includes("--bless");
const now = counts();
const files = readdirSync(SHOTS).filter((f) => f !== "screenshots.json");

const failures = [];
for (const file of files) {
  if (!(file in SHOWS)) {
    failures.push(`${file} is not in SHOWS — say which counted figures it prints, or \`[]\` if none`);
  }
}
for (const file of Object.keys(SHOWS)) {
  if (!files.includes(file)) failures.push(`${file} is listed in SHOWS but is not in public/screenshots/`);
}

let record = {};
try {
  record = JSON.parse(readFileSync(RECORD, "utf8"));
} catch {
  if (!bless) failures.push("screenshots.json is missing — run `npm run check:screens -- --bless` after taking them");
}

if (bless) {
  const next = {};
  for (const [file, keys] of Object.entries(SHOWS)) {
    if (keys.length === 0) continue;
    next[file] = Object.fromEntries(keys.map((key) => [key, now[key]]));
  }
  writeFileSync(RECORD, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`check:screens — recorded today's figures for ${Object.keys(next).length} screenshots.`);
  process.exit(0);
}

let checked = 0;
for (const [file, keys] of Object.entries(SHOWS)) {
  if (keys.length === 0) continue;
  const was = record[file];
  if (!was) {
    failures.push(`${file} shows ${keys.join(", ")} but nothing was recorded for it`);
    continue;
  }
  for (const key of keys) {
    checked++;
    if (was[key] !== now[key]) {
      failures.push(`${file} was taken when ${key} was ${was[key]}; it is ${now[key]} now — retake it`);
    }
  }
}

console.log(`check:screens — ${files.length} screenshots, ${checked} printed figures checked`);
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
