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
  for (const [from, to] of OPERATORS) {
    let at = source.indexOf(from);
    while (at !== -1) {
      // Word-ish operators must not match inside an identifier (`trueish`, `offset`).
      const wordy = /^[a-z]+$/.test(from.trim());
      const clean = !wordy || !/[\w$]/.test(source[at - 1] ?? " ") && !/[\w$]/.test(source[at + from.length] ?? " ");
      if (clean && inCode(ranges, at, from.length)) found.push({ file, at, from, to });
      at = source.indexOf(from, at + 1);
    }
  }
  return found;
}

/** mulberry32, the same one the property tests use, so a sample is reproducible from its seed. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample(all, count, seed) {
  if (count <= 0 || count >= all.length) return all;
  const next = rng(seed);
  const picked = all.slice();
  // Fisher-Yates with the seeded generator: a stable sample, and a different one per seed.
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked.slice(0, count);
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
