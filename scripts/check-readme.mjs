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

// ----------------------------------------------------------------------------------------------
for (const n of notes) console.log("  ok  " + n);
if (problems.length > 0) {
  console.error("\nREADME check failed:");
  for (const p of problems) console.error("  ✗ " + p);
  console.error("\nUpdate the READMEs (both languages) before pushing.");
  process.exit(1);
}
console.log("\nREADME check passed.");
