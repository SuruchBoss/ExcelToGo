#!/usr/bin/env node
/**
 * Checks the two READMEs against the repo before a push.
 *
 * Written after the docs drifted three separate ways: a module landed without an entry in the
 * project-structure listing, the test count in the badge went stale, and whole features were
 * documented but left out of the table of contents so nobody could find them. Each of those is
 * mechanical to catch and easy to miss by eye.
 *
 * Deliberately dependency-free so it can run in any checkout without an install step.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Not `import.meta.dirname`: that only exists from Node 20.11, and package.json declares 20.9 as the
// floor. CI runs the floor, which is how the difference surfaced.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const READMES = ["README.md", "README.en.md"];
const problems = [];
const notes = [];

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const fail = (msg) => problems.push(msg);

/**
 * GitHub's heading-anchor rule: lowercase, keep letters/digits/marks plus "-" and "_", drop
 * everything else, spaces become hyphens. Thai vowel and tone signs are combining marks, so
 * matching on \w would quietly mangle every Thai anchor — hence the explicit category test.
 */
function slug(heading) {
  let out = "";
  for (const ch of heading.toLowerCase()) {
    if (/\p{L}|\p{M}|\p{N}/u.test(ch) || ch === "-" || ch === "_") out += ch;
    else if (ch === " ") out += "-";
  }
  return "#" + out;
}

const docs = Object.fromEntries(READMES.map((f) => [f, read(f)]));

// --- 1. Internal links must resolve to a real heading -----------------------------------------
for (const [file, text] of Object.entries(docs)) {
  const headings = new Set([...text.matchAll(/^#{2,4} (.+)$/gm)].map((m) => slug(m[1])));
  const links = new Set([...text.matchAll(/\]\((#[^)]+)\)/g)].map((m) => m[1]));
  for (const link of links) {
    if (!headings.has(link)) fail(`${file}: link ${link} points at no heading`);
  }
  notes.push(`${file}: ${links.size} internal links resolve`);
}

// --- 2. Screenshots: referenced ones exist, and none are orphaned ------------------------------
const shotDir = path.join(ROOT, "public/screenshots");
const onDisk = fs.existsSync(shotDir) ? fs.readdirSync(shotDir).filter((f) => f.endsWith(".png")) : [];
const referenced = new Set();
for (const [file, text] of Object.entries(docs)) {
  for (const m of text.matchAll(/public\/screenshots\/([\w.-]+\.png)/g)) {
    referenced.add(m[1]);
    if (!onDisk.includes(m[1])) fail(`${file}: references public/screenshots/${m[1]}, which doesn't exist`);
  }
}
for (const f of onDisk) {
  if (!referenced.has(f)) fail(`public/screenshots/${f} is in the repo but no README shows it`);
}
notes.push(`${onDisk.length} screenshots, all referenced`);

// --- 3. Test counts quoted in the docs must match the suite ------------------------------------
function countTests(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countTests(full);
    else if (entry.name.endsWith(".test.ts")) n += (fs.readFileSync(full, "utf8").match(/^\s*it\(/gm) ?? []).length;
  }
  return n;
}
const actualTests = countTests(path.join(ROOT, "src"));
const quoted = new Set();
for (const text of Object.values(docs)) {
  for (const m of text.matchAll(/tests-(\d+)%20passing|(\d+)\s*(?:automated tests|เคส|cases)/g)) {
    quoted.add(Number(m[1] ?? m[2]));
  }
}
for (const n of quoted) {
  // Per-file counts in the testing table are small; only the whole-suite figures are checked.
  if (n > 50 && n !== actualTests) fail(`READMEs claim ${n} tests, but the suite has ${actualTests}`);
}
notes.push(`${actualTests} tests in src/, matching the figure quoted in the docs`);

// The suite's *file* count is quoted too, next to the case count, and nothing was watching it: the
// READMEs said "27 files" while src/ held 35. Same drift as the case count, one line of gate away.
function countTestFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countTestFiles(path.join(dir, entry.name));
    else if (entry.name.endsWith(".test.ts")) n++;
  }
  return n;
}
const actualTestFiles = countTestFiles(path.join(ROOT, "src"));
let sawFileCount = false;
for (const [file, text] of Object.entries(docs)) {
  for (const m of text.matchAll(/(?:ใน|across)\s*(\d+)\s*(?:ไฟล์|files\b)/g)) {
    sawFileCount = true;
    if (Number(m[1]) !== actualTestFiles) fail(`${file}: says "${m[0].trim()}", but src/ has ${actualTestFiles} test files`);
  }
}
if (!sawFileCount) fail("neither README states how many test files the suite has");
notes.push(`${actualTestFiles} test files, matching the figure quoted in the docs`);

// --- 4. Every lib module should appear in the project-structure listing ------------------------
const libDir = path.join(ROOT, "src/lib");
const libModules = fs
  .readdirSync(libDir, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".test.ts"))
  .map((e) => e.name);
for (const mod of libModules) {
  for (const [file, text] of Object.entries(docs)) {
    if (!text.includes(mod)) fail(`${file}: src/lib/${mod} isn't mentioned — new module missing from the structure listing?`);
  }
}
notes.push(`${libModules.length} lib modules, all documented`);

// --- 5. The two languages must describe the same set of features ------------------------------
const featureCount = (text, start, end) => {
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from === -1 || to === -1) return null;
  return (text.slice(from, to).match(/^### /gm) ?? []).length;
};
const thFeatures = featureCount(docs["README.md"], "## ✨ ฟีเจอร์", "## 🛠 เทคโนโลยีที่ใช้");
const enFeatures = featureCount(docs["README.en.md"], "## ✨ Features", "## 🛠 Tech stack");
if (thFeatures === null || enFeatures === null) fail("couldn't locate the Features section in one of the READMEs");
else if (thFeatures !== enFeatures) fail(`Features sections are out of sync: Thai has ${thFeatures}, English has ${enFeatures}`);
else notes.push(`${thFeatures} feature sections, matching in both languages`);

// --- 6. …and every feature section should be reachable from the contents -----------------------
for (const [file, text, start, end] of [
  ["README.md", docs["README.md"], "## ✨ ฟีเจอร์", "## 🛠 เทคโนโลยีที่ใช้"],
  ["README.en.md", docs["README.en.md"], "## ✨ Features", "## 🛠 Tech stack"],
]) {
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from === -1 || to === -1) continue;
  for (const m of text.slice(from, to).matchAll(/^### (.+)$/gm)) {
    if (!text.includes(`(${slug(m[1])})`)) fail(`${file}: "${m[1]}" isn't linked from the table of contents`);
  }
}

// --- 7. The landing page quotes numbers too, and nothing was checking them --------------------
// Found by looking at a screenshot of the live page: it still said "319 tests" long after the
// suite had passed 400, and claimed 25 palette formulas and 42 engine functions when the real
// figures were 32 and 49. The README's counts were being kept honest by this script while the
// page every visitor sees first drifted for months.
const countMatches = (file, pattern) => (read(file).match(pattern) ?? []).length;
const engineFunctions = countMatches("src/lib/formulaEngine/functions.ts", /^  [A-Z][A-Z0-9.]*:/gm);
const paletteFormulas = countMatches("src/lib/formulaCatalog.ts", /^    id: "[A-Z][A-Z0-9.]*",/gm);

// The security figure is quoted on the landing page and all through the README's security section,
// and it is the one number a reader is most entitled to be suspicious of. Counted from the files
// that hold those tests rather than trusted, the same as every other figure here.
const SECURITY_TEST_FILES = [
  "src/lib/server/urlGuard.test.ts",
  "src/lib/server/executeSource.test.ts",
  "src/lib/server/secretBox.test.ts",
  "src/lib/server/rateLimiter.test.ts",
  "src/lib/server/sourcesAuth.test.ts",
  "src/app/api/sources/validate.test.ts",
  "src/app/api/ai/formula/route.test.ts",
];
const securityTests = SECURITY_TEST_FILES.reduce((n, f) => n + countMatches(f, /^\s*it\(/gm), 0);

for (const locale of ["th", "en"]) {
  const source = read(`src/i18n/${locale}.ts`);
  const stat = (label) => {
    const m = new RegExp(`\\{ value: "(\\d+)", label: "[^"]*${label}[^"]*" \\}`).exec(source);
    return m ? Number(m[1]) : null;
  };
  const eyebrow = /eyebrow: "[^"]*?(\d+)[^"]*"/.exec(source);

  for (const [what, actual, found] of [
    ["engine functions", engineFunctions, stat(locale === "th" ? "ฟังก์ชันในเอนจิน" : "engine functions")],
    ["palette formulas", paletteFormulas, stat(locale === "th" ? "สูตรพร้อมใช้" : "ready-made formulas")],
    ["tests", actualTests, stat(locale === "th" ? "เทสต์อัตโนมัติ" : "automated tests")],
    ["security tests", securityTests, stat(locale === "th" ? "เทสต์ด้านความปลอดภัย" : "security tests")],
    ["tests (eyebrow)", actualTests, eyebrow ? Number(eyebrow[1]) : null],
  ]) {
    if (found === null) fail(`src/i18n/${locale}.ts: couldn't find the landing page's ${what} figure`);
    else if (found !== actual) fail(`src/i18n/${locale}.ts: landing page says ${found} ${what}, but there are ${actual}`);
  }
}

// Checking only `stats` and `eyebrow` was not enough, twice over.
//
// First: the same counts are written out in prose inside the landing page's feature copy, and that
// prose still read "25 formulas" and "42 functions" one commit after the stat tiles were fixed.
// Second: so are they in the READMEs — a mermaid node, a bilingual feature paragraph, the sentence
// contrasting the palette with the engine — and those were being fixed by hand each time somebody
// happened to notice. Both files get the same sweep now: find every figure standing directly in
// front of one of the words these counts are quoted with, and make it answer for itself.
const QUOTED = {
  "engine functions": {
    actual: engineFunctions,
    th: [/(\d+)\s*ฟังก์ชัน/g],
    en: [/(\d+)\s+(?:engine\s+)?functions\b/gi],
  },
  "palette formulas": {
    actual: paletteFormulas,
    th: [/(\d+)\s*(?:รายการ)?พร้อมใช้/g, /(\d+)\s*สูตร(?!ที่|พร้อม)/g, /สูตรทั้ง\s*(\d+)/g],
    en: [/(\d+)\s+(?:ready-made\s+)?formulas?\b/gi],
  },
  tests: {
    actual: actualTests,
    // The lookahead keeps this off the security figure, which is a different count in the same words.
    th: [/(\d+)\s*เทสต์(?!\s*ด้านความปลอดภัย)/g],
    en: [/(\d+)\s+(?:automated\s+)?tests\b/gi],
  },
  "security tests": {
    actual: securityTests,
    th: [/(\d+)\s*เทสต์ด้านความปลอดภัย/g],
    en: [/(\d+)\s+security\s+tests\b/gi],
  },
};

/** Every place a count is quoted in words, paired with the language its patterns are written in. */
const quotingTexts = [];
for (const locale of ["th", "en"]) {
  const file = `src/i18n/${locale}.ts`;
  const block = /\n  landing: \{\n([\s\S]*?)\n  \},\n/.exec(read(file));
  if (block) quotingTexts.push({ file, locale, text: block[1] });
  else fail(`${file}: couldn't find the landing block to scan for quoted counts`);
}
quotingTexts.push({ file: "README.md", locale: "th", text: read("README.md") });
quotingTexts.push({ file: "README.en.md", locale: "en", text: read("README.en.md") });

for (const { file, locale, text } of quotingTexts) {
  for (const [what, spec] of Object.entries(QUOTED)) {
    for (const pattern of spec[locale]) {
      for (const m of text.matchAll(pattern)) {
        if (Number(m[1]) !== spec.actual) {
          fail(`${file}: says "${m[0].trim()}", but there are ${spec.actual} ${what}`);
        }
      }
    }
  }
}

notes.push(`${engineFunctions} functions / ${paletteFormulas} palette formulas / ${actualTests} tests / ${securityTests} of them security — counted, and every place the docs or the landing page say so out loud agrees`);

// --- 8. The two link-preview cards quote the same figures, and neither is read by a human ---------
// `opengraph-image.tsx` had "505 automated tests" painted into it long after the suite passed 600.
// Nobody re-reads a card that renders correctly, so the number has to answer to something.
const OG = "src/app/opengraph-image.tsx";
const OG_LABELS = {
  "engine functions": engineFunctions,
  "palette formulas": paletteFormulas,
  "automated tests": actualTests,
  "of them security": securityTests,
  "formula libraries": 0,
};
const ogStats = [...read(OG).matchAll(/\["(\d+)", "([^"]+)"\]/g)];
if (ogStats.length === 0) fail(`${OG}: couldn't find the stat tiles to check`);
for (const [, value, label] of ogStats) {
  if (!(label in OG_LABELS)) fail(`${OG}: stat "${label}" isn't one this check knows how to verify`);
  else if (Number(value) !== OG_LABELS[label]) fail(`${OG}: card says ${value} ${label}, but there are ${OG_LABELS[label]}`);
}
notes.push(`${ogStats.length} stat tiles on the link-preview card, all counted`);

// GitHub's social preview can't be generated per request the way the OG card is — it is an upload,
// so a committed PNG is the only option. Check the one thing that can be checked from here: that it
// exists and is still the size GitHub crops to. Its numbers come from `npm run build:social`, which
// counts them from source rather than trusting a design.
const SOCIAL = "public/social-preview.png";
const socialPath = path.join(ROOT, SOCIAL);
if (!fs.existsSync(socialPath)) fail(`${SOCIAL} is missing — run \`npm run build:social\``);
else {
  const head = fs.readFileSync(socialPath).subarray(16, 24);
  const [w, h] = [head.readUInt32BE(0), head.readUInt32BE(4)];
  if (w !== 1280 || h !== 640) fail(`${SOCIAL} is ${w}x${h}, but GitHub's social preview wants 1280x640`);
  else notes.push(`${SOCIAL} is 1280x640`);
}

// ----------------------------------------------------------------------------------------------
for (const n of notes) console.log("  ok  " + n);
if (problems.length > 0) {
  console.error("\nREADME check failed:");
  for (const p of problems) console.error("  ✗ " + p);
  console.error("\nUpdate the READMEs (both languages) before pushing.");
  process.exit(1);
}
console.log("\nREADME check passed.");
