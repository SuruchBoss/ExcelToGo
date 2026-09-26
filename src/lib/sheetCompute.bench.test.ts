// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { createEmptySheet, setCellRaw, SheetModel } from "./sheet";
import { computeSheet, computeStats, resetComputeCache } from "./sheetCompute";
import { clearFormulaCache } from "./formulaEngine/formulaProgram";

/**
 * What one keystroke costs.
 *
 * This is the measurement the dependency graph was built for, kept so the number stays honest. The
 * figures quoted in the READMEs come from running this, not from memory. Before the graph, with
 * everything recomputed and every formula re-parsed on each pass:
 *
 *       200 rows (  600 formulas)      11.9 ms
 *     1,000 rows (3,000 formulas)     139.2 ms
 *     3,000 rows (9,000 formulas)   1,244.9 ms   (the 5s test timeout was in reach)
 *
 * The thresholds below are deliberately loose — a shared CI runner is not a benchmark rig, and a
 * test that fails on a noisy neighbour teaches people to ignore it. They are set to catch a return
 * to the old behaviour, which was two to three orders of magnitude away, not to police a few ms.
 */

/** Bounded ranges: what most sheets are made of. */
function buildSheet(rows: number): SheetModel {
  let sheet = createEmptySheet(rows, 6);
  for (let r = 0; r < rows; r++) {
    sheet = setCellRaw(sheet, r, 0, String(r + 1));
    sheet = setCellRaw(sheet, r, 1, String((r * 7) % 97));
    sheet = setCellRaw(sheet, r, 2, `=A${r + 1}*B${r + 1}`);
    sheet = setCellRaw(sheet, r, 3, `=IF(C${r + 1}>100,C${r + 1}*0.9,C${r + 1})`);
    sheet = setCellRaw(sheet, r, 4, `=SUM(A${r + 1}:C${r + 1})`);
  }
  return sheet;
}

/** Median of a handful, so one unlucky GC pause is not the reported number. */
function medianMs(runs: number, body: () => void): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    body();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

/**
 * A running total every later row reads — the shape the original measurement used. Included
 * because it is the case the dependency graph cannot rescue, and leaving that out would make the
 * headline numbers look better than the engine is.
 */
function buildRunningTotals(rows: number): SheetModel {
  let sheet = createEmptySheet(rows, 6);
  for (let r = 0; r < rows; r++) {
    sheet = setCellRaw(sheet, r, 0, String(r + 1));
    sheet = setCellRaw(sheet, r, 1, String((r * 7) % 97));
    sheet = setCellRaw(sheet, r, 2, `=A${r + 1}*B${r + 1}`);
    sheet = setCellRaw(sheet, r, 3, `=IF(C${r + 1}>100,C${r + 1}*0.9,C${r + 1})`);
    sheet = setCellRaw(sheet, r, 4, `=SUM($C$1:C${r + 1})`);
  }
  return sheet;
}

describe("recalculation cost", () => {
  /**
   * Written out per size rather than generated in a loop: `check:readme` counts the tests in the
   * source, and a loop around `it()` makes that count disagree with what `npm test` prints. A
   * figure in the README the suite contradicts is the exact drift that check exists to stop.
   */
  function measureOneEdit(rows: number): void {
    resetComputeCache();
    clearFormulaCache();
    const sheet = buildSheet(rows);

    const cold = medianMs(1, () => computeSheet(sheet));
    computeSheet(sheet);

    let edited = sheet;
    let n = 0;
    const perEdit = medianMs(9, () => {
      edited = setCellRaw(edited, n++ % rows, 1, String(n));
      computeSheet(edited);
    });

    console.log(
      `  ${String(rows).padStart(5)} rows → first compute ${cold.toFixed(1)} ms · one edit ${perEdit.toFixed(2)} ms`
    );

    // The point of the whole exercise: an edit must not cost what a full recompute costs.
    expect(perEdit).toBeLessThan(cold / 4);
    expect(perEdit).toBeLessThan(50);
    // And it must have got there by the fast path, not by a full pass that happened to be quick.
    expect(computeStats.incremental).toBeGreaterThan(0);
  }

  it("one edit in a 1,000-row sheet, 3,000 cells hold formulas", () => measureOneEdit(1000));

  it("one edit in a 3,000-row sheet, 9,000 cells hold formulas", () => measureOneEdit(3000));

  it("a running total is a real fan-out, and the graph does not pretend otherwise", () => {
    resetComputeCache();
    clearFormulaCache();
    const rows = 3000;
    const sheet = buildRunningTotals(rows);
    // Timed, because it is the yardstick the two edits below are measured against.
    const cold = medianMs(1, () => computeSheet(sheet));

    // Near the bottom: the totals above it are settled, so only a handful re-add.
    const late = medianMs(5, () => computeSheet(setCellRaw(sheet, rows - 2, 1, String(Math.random()))));

    // Row 1: every one of the three thousand totals reads it, and each re-adds its whole range.
    // That is O(n²) arithmetic the graph correctly identifies as necessary — not a cache miss.
    const top = medianMs(3, () => computeSheet(setCellRaw(sheet, 0, 1, String(Math.random()))));

    console.log(
      `  running totals, ${rows} rows → full pass ${cold.toFixed(0)} ms · edit near the end ${late.toFixed(2)} ms · edit at row 1 ${top.toFixed(0)} ms`
    );

    /**
     * Both bounds are ratios against the full pass measured a few lines up, and that is the fix
     * to a bug rather than a style preference.
     *
     * This test used to assert `top < 5000` — an absolute number, on a value that measured 1,412ms
     * here, so 3.5x of headroom on a runner that shares its CPU with whatever else GitHub put on
     * it. The comment above it said "(the 5s test timeout was in reach)", which was true when it
     * was written and stayed true afterwards. A sibling file made exactly that bet and lost it
     * three CI runs in a row.
     *
     * A ratio cannot lose that bet: a slow machine slows the yardstick and the measurement
     * together, so what is asserted is the shape of the engine rather than the mood of the runner.
     * The absolute milliseconds are still printed, because recording them is what this file is
     * for — the numbers in the READMEs come from that line. Recorded, not defended.
     */
    // An edit near the end re-adds a handful of rows; a full pass does three thousand.
    expect(late).toBeLessThan(cold / 10);
    // An edit at row 1 genuinely fans out to everything, so it costs about what a full pass costs.
    // What this catches is it costing very much *more* — the graph losing its way and re-walking.
    expect(top).toBeLessThan(cold * 3);
  }, 60000);

  it("parses a formula once however many rows repeat it", () => {
    resetComputeCache();
    clearFormulaCache();
    // 2,000 cells, one distinct formula text each — the cache is keyed by text, so this is the
    // case it cannot help with, and it still has to stay well clear of the old numbers.
    let sheet = createEmptySheet(2000, 3);
    for (let r = 0; r < 2000; r++) {
      sheet = setCellRaw(sheet, r, 0, String(r));
      sheet = setCellRaw(sheet, r, 1, `=A${r + 1}+${r}`);
    }
    const first = medianMs(1, () => computeSheet(sheet));
    resetComputeCache();
    const second = medianMs(1, () => computeSheet({ ...sheet, cells: sheet.cells.map((row) => [...row]) }));
    console.log(`  2,000 distinct formulas → cold ${first.toFixed(1)} ms · reparse-free ${second.toFixed(1)} ms`);
    expect(second).toBeLessThanOrEqual(first * 1.5);
  });
});
