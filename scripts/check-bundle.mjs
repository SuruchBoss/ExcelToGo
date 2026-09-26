#!/usr/bin/env node
// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * What this app actually asks a browser to download, with a budget attached.
 *
 * A bundle does not get large in one commit. It gets large the way a room gets untidy — one
 * reasonable-looking import at a time, each defensible on its own — and nobody notices until the
 * page is slow on a phone. Lighthouse notices eventually, but Lighthouse is a number somebody runs
 * by hand and writes into a README, which is how this project already shipped a stale one twice.
 *
 * So the size is a gate with a written budget. The budgets are set from a measured build with a
 * little headroom: enough that ordinary work does not trip them, tight enough that a library
 * arriving by accident does.
 *
 * Reads the build output rather than a network trace, so it needs no browser and no server. The
 * companion question — whether a chunk that *exists* is ever actually fetched — is the cloud
 * library check in `check-e2e.mjs`, which does need both.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHUNKS = path.join(ROOT, ".next", "static", "chunks");

/**
 * Measured on the build this was written against, rounded up.
 *
 * `total` is everything built, including chunks a visitor may never fetch — the cloud library and
 * the PDF writer are both on-demand. It is a ceiling on the project, not on a page load.
 * `largest` is the one number that catches a new library: a dependency added carelessly lands in
 * one chunk and shows up here first.
 */
const BUDGET_KB = {
  total: Number(process.env.BUNDLE_TOTAL_KB ?? 4200),
  largest: Number(process.env.BUNDLE_LARGEST_KB ?? 1300),
};

function jsFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) out.push(full);
    }
  };
  walk(dir);
  return out;
}

let files;
try {
  files = jsFiles(CHUNKS);
} catch {
  console.log("check:bundle — no build to measure. Run `npm run build` first.");
  process.exit(1);
}

const sized = files
  .map((file) => ({ file: path.relative(ROOT, file), kb: statSync(file).size / 1024 }))
  .sort((a, b) => b.kb - a.kb);
const total = sized.reduce((sum, f) => sum + f.kb, 0);

console.log(`check:bundle — ${sized.length} chunks, ${total.toFixed(0)} KB built\n`);
for (const { file, kb } of sized.slice(0, 5)) {
  console.log(`  ${kb.toFixed(0).padStart(6)} KB  ${file}`);
}

/**
 * The claim the README makes out loud, checked rather than repeated.
 *
 * The Supabase client is imported with `import()` so a deployment with no cloud configured — the
 * default, and the public demo — never downloads it. This half asserts it is somewhere a browser
 * has to ask for on purpose: in a chunk of its own, not folded into one the page loads anyway.
 */
const LIBRARY_MARKERS = ["SupabaseClient", "GoTrueClient", "RealtimeClient"];
const cloudChunks = sized.filter(({ file }) => {
  const text = readFileSync(path.join(ROOT, file), "utf8");
  return LIBRARY_MARKERS.every((marker) => text.includes(marker));
});

const failures = [];
if (total > BUDGET_KB.total) failures.push(`total ${total.toFixed(0)} KB is over the ${BUDGET_KB.total} KB budget`);
if (sized[0].kb > BUDGET_KB.largest) {
  failures.push(`largest chunk ${sized[0].kb.toFixed(0)} KB (${sized[0].file}) is over the ${BUDGET_KB.largest} KB budget`);
}
if (cloudChunks.length === 0) {
  failures.push("the Supabase client is not in a chunk of its own — the dynamic import may have been flattened");
} else if (cloudChunks.length > 1) {
  failures.push(`the Supabase client appears in ${cloudChunks.length} chunks, so at least one of them is not on-demand`);
} else {
  console.log(`\n  cloud client is one chunk of its own: ${cloudChunks[0].kb.toFixed(0)} KB, fetched only when asked for`);
}

if (failures.length > 0) {
  console.log("\ncheck:bundle failed:");
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\ncheck:bundle — within budget (${total.toFixed(0)}/${BUDGET_KB.total} KB, largest ${sized[0].kb.toFixed(0)}/${BUDGET_KB.largest} KB)`);
