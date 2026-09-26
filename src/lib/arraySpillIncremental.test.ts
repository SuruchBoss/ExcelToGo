// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { createEmptySheet, setCellRaw, SheetModel } from "./sheet";
import { computeSheet, computeStats, resetComputeCache } from "./sheetCompute";
import { clearFormulaCache } from "./formulaEngine/formulaProgram";

/**
 * One array formula used to cost the whole sheet, every keystroke.
 *
 * `computeSheet` refused the incremental path outright once a sheet had any spill on it, because an
 * array writes into cells *outside* the closure the incremental pass recomputes, and an array that
 * shrinks has to clear what it used to fill. The bail-out was correct and expensive: a single
 * `FILTER` in a corner turned every edit anywhere into a full recompute.
 *
 * It is gone, so the two things it was protecting against are tested here rather than avoided:
 * that the incremental path really runs, and that what it produces is identical to a full pass.
 */

const fresh = () => {
  resetComputeCache();
  clearFormulaCache();
};

/** Ten rows of data with an array formula reading them, which is the shape this is all about. */
function sheetWithArray(rows = 10): SheetModel {
  let sheet = createEmptySheet(rows + 6, 6);
  for (let r = 0; r < rows; r++) {
    sheet = setCellRaw(sheet, r, 0, String(r + 1));
    sheet = setCellRaw(sheet, r, 1, String((r * 7) % 13));
  }
  // Spills down column D, and E1 reads the whole spill region back.
  sheet = setCellRaw(sheet, 0, 3, `=SORT(A1:A${rows})`);
  sheet = setCellRaw(sheet, 0, 4, `=SUM(D1:D${rows})`);
  return sheet;
}

/** The same sheet computed from cold, which is the answer the incremental one has to match. */
function fullOf(sheet: SheetModel) {
  fresh();
  const result = computeSheet(sheet);
  return { display: result.display.map((row) => [...row]), spill: new Map(result.spill) };
}

function sameAsFull(sheet: SheetModel, incremental: ReturnType<typeof computeSheet>) {
  const full = fullOf(sheet);
  expect(incremental.display.map((row) => [...row])).toEqual(full.display);
  expect([...incremental.spill.entries()].sort()).toEqual([...full.spill.entries()].sort());
}

describe("editing a sheet that has an array on it", () => {
  it("takes the incremental path at all, which is the whole point", () => {
    fresh();
    const sheet = sheetWithArray();
    computeSheet(sheet);
    const before = computeStats.incremental;

    // An edit nowhere near the array. This used to force a full recompute purely because a spill
    // existed somewhere on the sheet.
    const next = setCellRaw(sheet, 14, 5, "หมายเหตุ");
    computeSheet(next);
    expect(computeStats.incremental).toBe(before + 1);
  });

  it("leaves the array alone when the edit has nothing to do with it", () => {
    fresh();
    const sheet = sheetWithArray();
    computeSheet(sheet);
    const next = setCellRaw(sheet, 14, 5, "หมายเหตุ");
    const result = computeSheet(next);

    expect(result.display[0][3]).toBe("1");
    expect(result.display[9][3]).toBe("10");
    sameAsFull(next, result);
  });

  it("re-spills when the data the array reads changes", () => {
    fresh();
    const sheet = sheetWithArray();
    computeSheet(sheet);
    const next = setCellRaw(sheet, 0, 0, "99");
    const result = computeSheet(next);

    // SORT puts the new value last.
    expect(result.display[9][3]).toBe("99");
    expect(result.display[0][4]).toBe("153");
    sameAsFull(next, result);
  });

  it("reports #SPILL! when something is typed into the region", () => {
    // The direction that needs the reverse index: the edited cell is not the formula, but the
    // formula has to run again because its landing ground is no longer clear.
    fresh();
    const sheet = sheetWithArray();
    computeSheet(sheet);
    const next = setCellRaw(sheet, 4, 3, "ขวางทาง");
    const result = computeSheet(next);

    expect(result.display[0][3]).toBe("#SPILL!");
    sameAsFull(next, result);
  });

  it("clears what the array filled when the array is deleted", () => {
    // The other direction, and the one the old bail-out existed for: the cells being cleared are
    // outside the closure of the cell that changed.
    fresh();
    const sheet = sheetWithArray();
    computeSheet(sheet);
    const next = setCellRaw(sheet, 0, 3, "");
    const result = computeSheet(next);

    expect(result.display[0][3]).toBe("");
    expect(result.display[5][3]).toBe("");
    expect(result.spill.size).toBe(0);
    sameAsFull(next, result);
  });

  it("clears the tail when the array comes back shorter", () => {
    // A shrinking array leaves the map the same size or smaller, which is why the second sweep is
    // triggered by an array having been written rather than by the map having grown.
    fresh();
    const sheet = sheetWithArray();
    computeSheet(sheet);
    const next = setCellRaw(sheet, 0, 3, "=SORT(A1:A4)");
    const result = computeSheet(next);

    expect(result.display[3][3]).toBe("4");
    expect(result.display[4][3]).toBe("");
    expect(result.display[9][3]).toBe("");
    sameAsFull(next, result);
  });

  it("grows the region when the array comes back longer", () => {
    fresh();
    let sheet = sheetWithArray();
    sheet = setCellRaw(sheet, 0, 3, "=SORT(A1:A4)");
    computeSheet(sheet);
    const next = setCellRaw(sheet, 0, 3, "=SORT(A1:A10)");
    const result = computeSheet(next);

    expect(result.display[9][3]).toBe("10");
    sameAsFull(next, result);
  });

  it("keeps a formula that reads the region in step with it", () => {
    fresh();
    const sheet = sheetWithArray();
    computeSheet(sheet);
    const next = setCellRaw(sheet, 0, 3, "=SORT(A1:A4)");
    const result = computeSheet(next);

    // SUM(D1:D10) now covers four values and six blanks.
    expect(result.display[0][4]).toBe("10");
    sameAsFull(next, result);
  });

  it("survives a run of edits without drifting from a full recompute", () => {
    // Each pass builds on the last one's snapshot, so an error here compounds rather than showing
    // up once — which is exactly the failure mode a single-edit test would miss.
    fresh();
    let sheet = sheetWithArray();
    computeSheet(sheet);
    const edits: [number, number, string][] = [
      [2, 0, "42"],
      [0, 3, "=SORT(A1:A6)"],
      [7, 3, "ขวาง"],
      [7, 3, ""],
      [0, 3, "=UNIQUE(B1:B10)"],
      [9, 1, "3"],
      [0, 5, "=D1+1"],
    ];
    for (const [r, c, raw] of edits) {
      sheet = setCellRaw(sheet, r, c, raw);
      const result = computeSheet(sheet);
      sameAsFull(sheet, result);
    }
  });
});

describe("what it costs now", () => {
  it("does not pay for the whole sheet on an edit that misses the array", () => {
    // The measurement the change was made for. A thousand formula rows with one array in a corner:
    // before, every keystroke was a full recompute of all of them.
    fresh();
    let sheet = createEmptySheet(1000, 6);
    for (let r = 0; r < 1000; r++) {
      sheet = setCellRaw(sheet, r, 0, String(r + 1));
      sheet = setCellRaw(sheet, r, 1, `=A${r + 1}*2`);
      sheet = setCellRaw(sheet, r, 2, `=SUM(A${r + 1}:B${r + 1})`);
    }
    sheet = setCellRaw(sheet, 0, 4, "=SEQUENCE(20)");
    computeSheet(sheet);

    const times: number[] = [];
    for (let i = 0; i < 9; i++) {
      const next = setCellRaw(sheet, 500, 0, String(1000 + i));
      const t0 = performance.now();
      computeSheet(next);
      times.push(performance.now() - t0);
      sheet = next;
    }
    times.sort((a, b) => a - b);

    // Loose on purpose: a shared CI runner is not a benchmark rig. The old behaviour on this sheet
    // was tens of milliseconds per keystroke, not single digits.
    expect(times[4]).toBeLessThan(25);
    expect(computeStats.incremental).toBeGreaterThan(0);
  });
});
