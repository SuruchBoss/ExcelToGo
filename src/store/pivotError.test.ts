// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { getMessages } from "@/i18n";
import { sheetFromGrid } from "@/lib/sheet";
import { computeTab, useSheetStore } from "./sheetStore";

/**
 * A pivot over a column with an error in it (#222). Sum, Average, Min and Max stepped over the error,
 * so North read 100 and the grand total 180 where Excel's PivotTable shows #DIV/0!.
 */
const state = () => useSheetStore.getState();

const setSource = (grid: string[][]) =>
  useSheetStore.setState((s) => ({
    sheets: s.sheets.map((t, i) => (i === 0 ? { ...t, sheet: sheetFromGrid(grid) } : t)),
  }));

beforeEach(() => {
  state().startBlank();
  setSource([
    ["Region", "Amount"],
    ["North", "100"],
    ["North", "=1/0"],
    ["South", "80"],
  ]);
  state().setSelection({ startRow: 0, startCol: 0, endRow: 3, endCol: 1, anchorRow: 0, anchorCol: 0 });
});

const pivotTab = () => state().sheets[state().sheets.length - 1];
const shown = () => computeTab(pivotTab().sheet, state().sheets).display;

describe("a pivot over an error shows the error (#222)", () => {
  it("in the group that holds it and in the grand total, for sum, average, min and max", () => {
    for (const agg of ["sum", "average", "min", "max"] as const) {
      state().setActiveSheet(state().sheets[0].id);
      state().setSelection({ startRow: 0, startCol: 0, endRow: 3, endCol: 1, anchorRow: 0, anchorCol: 0 });
      expect(state().buildPivotSheet({ rowFields: [0], colField: null, valueField: 1, agg }), agg).toBe(true);
      const display = shown();
      expect(display[1].slice(0, 2), agg).toEqual(["North", "#DIV/0!"]);
      expect(display[2].slice(0, 2), agg).toEqual(["South", "80"]);
      expect(display[3].slice(0, 2), agg).toEqual([getMessages().pivot.grandTotal, "#DIV/0!"]);
    }
  });

  it("after a refresh, once the source gains an error", () => {
    setSource([
      ["Region", "Amount"],
      ["North", "100"],
      ["North", "20"],
      ["South", "80"],
    ]);
    expect(state().buildPivotSheet({ rowFields: [0], colField: null, valueField: 1, agg: "sum" })).toBe(true);
    expect(shown()[1].slice(0, 2)).toEqual(["North", "120"]);

    setSource([
      ["Region", "Amount"],
      ["North", "100"],
      ["North", "=1/0"],
      ["South", "80"],
    ]);
    expect(state().refreshPivot()).toBe(true);
    expect(shown()[1].slice(0, 2)).toEqual(["North", "#DIV/0!"]);
    expect(shown()[3].slice(0, 2)).toEqual([getMessages().pivot.grandTotal, "#DIV/0!"]);
  });
});
