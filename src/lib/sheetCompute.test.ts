// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptySheet, setCellRaw, setRangeFormat, SheetModel } from "./sheet";
import { computeSheet, computeStats, resetComputeCache } from "./sheetCompute";
import { FormulaError } from "./formulaEngine/types";

/** Fixed seed: a failure has to be reproducible, and "it passed last time" is not a test. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const ROWS = 24;
const COLS = 6;

/** A sheet with literals, cell-to-cell formulas, ranges, and a few cells nothing reads. */
function seedSheet(random: () => number): SheetModel {
  let sheet = createEmptySheet(ROWS, COLS);
  for (let r = 0; r < ROWS; r++) {
    sheet = setCellRaw(sheet, r, 0, String(Math.floor(random() * 100)));
    sheet = setCellRaw(sheet, r, 1, String(Math.floor(random() * 100)));
    sheet = setCellRaw(sheet, r, 2, `=A${r + 1}+B${r + 1}`);
    sheet = setCellRaw(sheet, r, 3, `=IF(C${r + 1}>100,C${r + 1}*2,C${r + 1})`);
    sheet = setCellRaw(sheet, r, 4, `=SUM(A${r + 1}:C${r + 1})`);
  }
  sheet = setCellRaw(sheet, 0, 5, `=SUM(C1:C${ROWS})`);
  sheet = setCellRaw(sheet, 1, 5, `=AVERAGE(D1:D${ROWS})`);
  sheet = setCellRaw(sheet, 2, 5, "=MAX(E1:E24)");
  return sheet;
}

/** An edit of the kind a person makes: retype a number, rewrite a formula, empty a cell. */
function randomEdit(sheet: SheetModel, random: () => number): SheetModel {
  const r = Math.floor(random() * ROWS);
  const roll = random();
  if (roll < 0.45) return setCellRaw(sheet, r, Math.floor(random() * 2), String(Math.floor(random() * 200)));
  if (roll < 0.6) return setCellRaw(sheet, r, 2, `=A${r + 1}*${1 + Math.floor(random() * 4)}`);
  if (roll < 0.72) return setCellRaw(sheet, r, 3, `=SUM(A${r + 1}:B${r + 1})`);
  if (roll < 0.82) return setCellRaw(sheet, r, Math.floor(random() * 3), "");
  if (roll < 0.9) return setCellRaw(sheet, r, 2, "=NOPE(");            // mid-typing, does not parse
  return setCellRaw(sheet, r, 4, `=C${r + 1}&"x"`);
}

/**
 * The same sheet, computed with nothing remembered.
 *
 * A structural copy, because the engine keys its identity cache on the object and would otherwise
 * hand back the very answer under test.
 */
function fromScratch(sheet: SheetModel): ReturnType<typeof computeSheet> {
  resetComputeCache();
  const copy: SheetModel = { ...sheet, cells: sheet.cells.map((row) => [...row]), formats: sheet.formats.map((row) => [...row]) };
  return computeSheet(copy);
}

/** FormulaError has no useful equality, so compare what a cell would actually read as. */
function shape(result: ReturnType<typeof computeSheet>) {
  return {
    values: result.values.map((row) => row.map((v) => (v instanceof FormulaError ? v.code : v))),
    display: result.display,
  };
}

describe("incremental recalculation", () => {
  beforeEach(() => resetComputeCache());

  it("agrees with a full recompute after every single edit", () => {
    const random = rng(20260917);
    let sheet = seedSheet(random);
    computeSheet(sheet);

    let incrementalPasses = 0;
    for (let step = 0; step < 120; step++) {
      sheet = randomEdit(sheet, random);
      const before = computeStats.incremental;
      const fast = shape(computeSheet(sheet));
      if (computeStats.incremental > before) incrementalPasses++;
      expect(fast, `step ${step}`).toEqual(shape(fromScratch(sheet)));
    }

    // Without this the test would pass just as happily if the fast path never ran at all.
    expect(incrementalPasses).toBeGreaterThan(100);
  });

  it("agrees after a long chain of edits stacked on each other", () => {
    const random = rng(7);
    let sheet = seedSheet(random);
    computeSheet(sheet);
    for (let step = 0; step < 200; step++) {
      sheet = randomEdit(sheet, random);
      computeSheet(sheet);
    }
    expect(computeStats.incremental).toBeGreaterThan(150);
    const chained = shape(computeSheet(sheet));
    expect(chained).toEqual(shape(fromScratch(sheet)));
  });

  it("recomputes a cell that reads a changed cell, and leaves the rest alone", () => {
    let sheet = createEmptySheet(4, 3);
    sheet = setCellRaw(sheet, 0, 0, "2");
    sheet = setCellRaw(sheet, 0, 1, "=A1*10");
    sheet = setCellRaw(sheet, 1, 0, "5");
    const first = computeSheet(sheet);
    expect(first.values[0][1]).toBe(20);

    sheet = setCellRaw(sheet, 0, 0, "3");
    const second = computeSheet(sheet);
    expect(second.values[0][1]).toBe(30);
    expect(computeStats.incremental).toBe(1);
    // The untouched row is the same array object, not an equal copy: nothing rebuilt it.
    expect(second.values[2]).toBe(first.values[2]);
  });

  it("follows a range, not just a named cell", () => {
    let sheet = createEmptySheet(5, 2);
    for (let r = 0; r < 4; r++) sheet = setCellRaw(sheet, r, 0, String(r + 1));
    sheet = setCellRaw(sheet, 4, 1, "=SUM(A1:A4)");
    expect(computeSheet(sheet).values[4][1]).toBe(10);

    sheet = setCellRaw(sheet, 2, 0, "30");
    expect(computeSheet(sheet).values[4][1]).toBe(37);
    expect(computeStats.incremental).toBe(1);
  });

  it("drops a dependency when the formula stops naming it", () => {
    let sheet = createEmptySheet(3, 3);
    sheet = setCellRaw(sheet, 0, 0, "1");
    sheet = setCellRaw(sheet, 0, 1, "2");
    sheet = setCellRaw(sheet, 0, 2, "=A1");
    expect(computeSheet(sheet).values[0][2]).toBe(1);

    sheet = setCellRaw(sheet, 0, 2, "=B1");
    expect(computeSheet(sheet).values[0][2]).toBe(2);

    // A1 is no longer read, so changing it must not disturb C1.
    sheet = setCellRaw(sheet, 0, 0, "999");
    expect(computeSheet(sheet).values[0][2]).toBe(2);
  });

  it("still reports a circular reference after an incremental pass", () => {
    let sheet = createEmptySheet(3, 2);
    sheet = setCellRaw(sheet, 0, 0, "1");
    computeSheet(sheet);
    sheet = setCellRaw(sheet, 0, 0, "=B1");
    sheet = setCellRaw(sheet, 0, 1, "=A1");
    const values = computeSheet(sheet).values;
    expect(values[0][0]).toBeInstanceOf(FormulaError);
    expect((values[0][0] as FormulaError).code).toBe("#CIRCULAR!");
  });

  it("keeps a clock-reading formula from freezing", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-01T09:00:00Z"));
      let sheet = createEmptySheet(3, 2);
      sheet = setCellRaw(sheet, 0, 0, "=TODAY()");
      sheet = setCellRaw(sheet, 1, 1, "1");
      expect(computeSheet(sheet).values[0][0]).toBe("2026-03-01");

      // A day passes, and the only cell edited is one =TODAY() does not read. A cache that trusted
      // the dependency graph alone would hand back yesterday, forever.
      vi.setSystemTime(new Date("2026-03-02T09:00:00Z"));
      sheet = setCellRaw(sheet, 1, 1, "2");
      expect(computeSheet(sheet).values[0][0]).toBe("2026-03-02");
      expect(computeStats.incremental).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-renders a cell whose number format changed without recomputing its value", () => {
    let sheet = createEmptySheet(3, 2);
    sheet = setCellRaw(sheet, 0, 0, "1234.5");
    expect(computeSheet(sheet).display[0][0]).toBe("1234.5");

    sheet = setRangeFormat(sheet, 0, 0, 0, 0, { numberFormat: "currency" });
    const after = computeSheet(sheet);
    expect(after.display[0][0]).not.toBe("1234.5");
    expect(after.values[0][0]).toBe(1234.5);
  });

  it("falls back to a full pass when the sheet changes shape", () => {
    let sheet = createEmptySheet(3, 2);
    sheet = setCellRaw(sheet, 0, 0, "=1+1");
    computeSheet(sheet);
    const fullsBefore = computeStats.full;
    sheet = { ...sheet, rows: 4, cells: [...sheet.cells, ["", ""]], formats: [...sheet.formats, [undefined, undefined]] };
    expect(computeSheet(sheet).values[0][0]).toBe(2);
    expect(computeStats.full).toBe(fullsBefore + 1);
  });
});
