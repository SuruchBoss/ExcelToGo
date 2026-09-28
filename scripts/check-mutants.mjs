#!/usr/bin/env node
// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Mutation testing for the formula engine, with nothing installed to do it.
 *
 * "1,077 tests" is a number anyone can print. It says how many assertions exist, not whether they
 * would notice a bug — and a suite can be large and still asleep. This gate answers the other
 * question by breaking the engine on purpose, one small change at a time, and checking that the
 * suite goes red. A change the suite does not notice is a *survivor*, and survivors are the honest
 * measure of a test suite's reach.
 *
 * Hand-written rather than Stryker for the same reason the property tests carry a hand-written
 * PRNG: the repository's `package.json` stays small, the whole thing is readable in one sitting,
 * and the parts that matter — where a mutation may be applied, and what counts as killed — are
 * decisions this project makes rather than inherits.
 *
 *   npm run check:mutants              a seeded sample, the size CI runs
 *   SEED=7 npm run check:mutants       a different sample, reproducibly
 *   MUTANTS=40 npm run check:mutants   a longer run
 *   MUTANTS=0 npm run check:mutants    every site, which takes a while
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * The engine, and only the engine.
 *
 * Mutation testing is slow — a whole test run per mutant — so it is pointed at the code where a
 * quiet wrong answer costs the most. A spreadsheet that renders oddly is a complaint; a spreadsheet
 * that adds up wrong is a decision made on a bad number.
 */
const TARGETS = [
  "src/lib/formulaEngine/tokenizer.ts",
  "src/lib/formulaEngine/parser.ts",
  "src/lib/formulaEngine/evaluator.ts",
  "src/lib/formulaEngine/functions.ts",
  "src/lib/formulaEngine/coerce.ts",
  "src/lib/formulaEngine/address.ts",
  "src/lib/formulaEngine/shift.ts",
  "src/lib/formulaEngine/structuralShift.ts",
];

/** The suites that should notice. Kept narrow so one mutant costs a second, not a minute. */
const SUITES = ["src/lib/formulaEngine", "src/lib/arrayFormulas.test.ts", "src/lib/sheetCompute.test.ts"];

/**
 * What to change.
 *
 * Each operator is a swap between two things a person could plausibly get wrong: an off-by-one in a
 * comparison, an inverted condition, a boundary that should have been inclusive. Deliberately not
 * "delete a random line" — a mutant that makes the file throw on import is killed by everything and
 * measures nothing.
 */
const OPERATORS = [
  ["<=", "<"],
  [">=", ">"],
  ["<", "<="],
  [">", ">="],
  ["===", "!=="],
  ["!==", "==="],
  ["&&", "||"],
  ["||", "&&"],
  ["true", "false"],
  ["false", "true"],
  [" + ", " - "],
  [" - ", " + "],
  [" * ", " / "],
];

/**
 * The byte ranges that are code, rather than a comment or a string.
 *
 * Without this the first mutant is a swapped `<` inside a doc comment, which changes nothing and
 * counts as a survivor — a lie in the direction that flatters the suite.
 */
function codeRanges(source) {
  const ranges = [];
  let start = 0;
  let i = 0;
  const push = (end) => {
    if (end > start) ranges.push([start, end]);
  };
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (two === "//") {
      push(i);
      while (i < source.length && source[i] !== "\n") i++;
      start = i;
      continue;
    }
    if (two === "/*") {
      push(i);
      i = source.indexOf("*/", i + 2);
      i = i === -1 ? source.length : i + 2;
      start = i;
      continue;
    }
    const q = source[i];
    if (q === '"' || q === "'" || q === "`") {
      push(i);
      i++;
      while (i < source.length && source[i] !== q) i += source[i] === "\\" ? 2 : 1;
      i++;
      start = i;
      continue;
    }
    // A regular expression literal, recognised by what can precede one. Skipped wholesale: a
    // mutated character class is a syntax error more often than it is a bug.
    if (q === "/" && /[=(,:[!&|?{;]\s*$/.test(source.slice(Math.max(0, i - 12), i))) {
      push(i);
      i++;
      while (i < source.length && source[i] !== "/") i += source[i] === "\\" ? 2 : 1;
      i++;
      start = i;
      continue;
    }
    i++;
  }
  push(source.length);
  return ranges;
}

const inCode = (ranges, at, length) => ranges.some(([a, b]) => at >= a && at + length <= b);

/** Every place a mutation could be applied, as {file, at, from, to}. */
function sites(file) {
  const source = readFileSync(path.join(ROOT, file), "utf8");
  const ranges = codeRanges(source);
  const found = [];
  const seen = new Map();
  for (const [from, to] of OPERATORS) {
    let at = source.indexOf(from);
    while (at !== -1) {
      // Word-ish operators must not match inside an identifier (`trueish`, `offset`).
      const wordy = /^[a-z]+$/.test(from.trim());
      const clean = !wordy || !/[\w$]/.test(source[at - 1] ?? " ") && !/[\w$]/.test(source[at + from.length] ?? " ");
      if (clean && inCode(ranges, at, from.length) && !markedEquivalent(source, at, from, to)) {
        found.push({ file, at, from, to, key: keyOf(source, file, at, from, to, seen) });
      }
      at = source.indexOf(from, at + 1);
    }
  }
  return found;
}

/**
 * A swap marked, on the line above it, as one no test can notice:
 *
 *     // equivalent-mutant: "<" → "<=" — cmp is never 0 here; that case returned a line earlier.
 *
 * An *equivalent* mutant changes the code without changing what it computes, so it survives every
 * suite there could be — and with 32 draws and a 90% floor, four of them in one sample fail the
 * gate on nothing. Marking one takes a written reason next to the code, where a reviewer sees it,
 * and excludes only that exact swap on that one line: the line's other operators are still drawn.
 * The same bargain `check:deps` makes for an accepted advisory.
 */
function markedEquivalent(source, at, from, to) {
  const lineStart = source.lastIndexOf("\n", at - 1) + 1;
  const prevStart = source.lastIndexOf("\n", lineStart - 2) + 1;
  const previous = source.slice(prevStart, lineStart);
  const mark = /\/\/ equivalent-mutant: "([^"]+)" → "([^"]+)" — \S/.exec(previous);
  return mark !== null && mark[1] === from.trim() && mark[2] === to.trim();
}

/**
 * What a site *is*, as opposed to where it is: the file, the text of its line, the swap, and which
 * occurrence of that same swap on that same line text it is. Nothing positional — so adding a
 * function to `functions.ts` leaves every other site's key, and so the sample, where it was.
 */
function keyOf(source, file, at, from, to, seen) {
  const lineStart = source.lastIndexOf("\n", at - 1) + 1;
  const lineEnd = source.indexOf("\n", at);
  const line = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
  const base = `${file}|${line}|${from}|${to}`;
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return `${base}|${n}`;
}

function sample(all, count, seed) {
  if (count <= 0 || count >= all.length) return all;
  // Each site ranked by a seeded hash of its key, not shuffled by position. A shuffle of the whole
  // list redraws all 32 the moment any engine file gains or loses a site: the first commit to add
  // date handling to functions.ts turned 31/32 into 22/32 by drawing a different sample, not by
  // weakening a single test. Ranked by key, an edit only moves the sites it actually touched.
  return all
    .map((site) => ({ site, rank: hash(site.key, seed) }))
    .sort((a, b) => a.rank - b.rank || (a.site.key < b.site.key ? -1 : 1))
    .slice(0, count)
    .map((x) => x.site);
}

/** FNV-1a, 32 bits, with the seed folded in first: small, dependency-free, and stable across runs. */
function hash(text, seed) {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function suiteFails() {
  try {
    execFileSync("npx", ["vitest", "run", ...SUITES, "--silent", "--reporter=dot"], {
      cwd: ROOT,
      stdio: "pipe",
      env: { ...process.env, CI: "1" },
    });
    return false;
  } catch {
    return true;
  }
}

/**
 * The sample is pinned, on purpose.
 *
 * A gate that picks different mutants every run is a gate that fails for reasons unrelated to the
 * commit in front of it, and people learn to re-run it rather than read it. So CI always runs the
 * same 32, and finding *new* gaps is a thing somebody does deliberately with another seed:
 *
 *     SEED=13 MUTANTS=60 npm run check:mutants
 *
 * Both seeds below were run while this was written. Seed 1 killed every mutant; seed 7 left six
 * alive, and six tests were written from them — a COUNTIFS that counted one cell past each row, a
 * `SEQUENCE(0)` that was allowed through, a `VLOOKUP` approximate match that skipped an exact hit,
 * a number-versus-text comparison that went NaN, the text `"FALSE"` read as true, and a `FIND`
 * start position of zero behaving like one. None of those had a test before.
 */
const seed = Number(process.env.SEED ?? 7);
const limit = process.env.MUTANTS === undefined ? 32 : Number(process.env.MUTANTS);
const all = TARGETS.flatMap(sites);
const chosen = sample(all, limit, seed);

console.log(`check:mutants — ${chosen.length} of ${all.length} mutation sites (seed ${seed})\n`);

const survivors = [];
let killed = 0;

for (const [n, mutant] of chosen.entries()) {
  const full = path.join(ROOT, mutant.file);
  const original = readFileSync(full, "utf8");
  const mutated = original.slice(0, mutant.at) + mutant.to + original.slice(mutant.at + mutant.from.length);
  const line = original.slice(0, mutant.at).split("\n").length;
  const where = `${mutant.file}:${line}  ${JSON.stringify(mutant.from)} → ${JSON.stringify(mutant.to)}`;
  try {
    writeFileSync(full, mutated);
    if (suiteFails()) {
      killed++;
      process.stdout.write(`  killed   ${where}\n`);
    } else {
      survivors.push(where);
      process.stdout.write(`  SURVIVED ${where}\n`);
    }
  } finally {
    // Restoring in `finally` is the whole safety story: an interrupted run must not leave a
    // deliberately broken engine in the working tree.
    writeFileSync(full, original);
  }
  if ((n + 1) % 8 === 0) process.stdout.write(`  … ${n + 1}/${chosen.length}\n`);
}

const score = chosen.length === 0 ? 100 : Math.round((killed / chosen.length) * 100);
/**
 * Measured, not wished for.
 *
 * The pinned sample kills 31 of 32. The one survivor is *equivalent*: extending SUMPRODUCT's row
 * loop one past the end reads a row that is not there, and a missing cell contributes zero to a
 * product that is then added to the total — the arithmetic cannot tell. No test can kill it, and
 * chasing it would mean writing one that asserts an implementation detail instead of a result.
 *
 * So the floor is 90%, a little under what the sample actually scores: the job is to notice the
 * suite getting *worse*, not to demand a perfect number that a legitimate refactor could cost.
 */
const FLOOR = Number(process.env.MUTATION_FLOOR ?? 90);

console.log(`\ncheck:mutants — ${killed}/${chosen.length} killed (${score}%), floor ${FLOOR}%`);
if (survivors.length > 0) {
  console.log("\nsurvivors — each is a change to the engine that no test noticed:");
  for (const s of survivors) console.log(`  ${s}`);
}
if (score < FLOOR) {
  console.log(`\ncheck:mutants failed: ${score}% is below the ${FLOOR}% floor.`);
  process.exit(1);
}
