// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMessages } from "@/i18n";
import { sheetFromGrid } from "@/lib/sheet";
import { computeTab, useSheetStore } from "./sheetStore";

/**
 * A pivot sheet as big as its answer (#56).
 *
 * The result was written into a new sheet of the default 30×10 and whatever did not fit was dropped:
 * a breakdown of 35 products kept 29 of them and lost its Grand total row, and twelve months across the
 * top lost three and the Grand total column. What was left looked complete.
 */
const state = () => useSheetStore.getState();

/** QA's source: 60 rows, 35 products, two regions, twelve months, every Amount 10. */
const source = (): string[][] => {
  const grid = [["Product", "Region", "Month", "Amount"]];
  for (let i = 0; i < 60; i++) {
    const product = `P${String((i % 35) + 1).padStart(2, "0")}`;
    const month = `M${String((i % 12) + 1).padStart(2, "0")}`;
    grid.push([product, i % 2 === 0 ? "North" : "South", month, "10"]);
  }
  return grid;
};

beforeEach(() => {
  state().startBlank();
  useSheetStore.setState((s) => ({
    sheets: s.sheets.map((t) => (t.id === s.activeSheetId ? { ...t, sheet: sheetFromGrid(source()) } : t)),
  }));
  state().setSelection({ startRow: 0, startCol: 0, endRow: 60, endCol: 3, anchorRow: 0, anchorCol: 0 });
});

const pivotTab = () => state().sheets[state().sheets.length - 1];
const shown = () => computeTab(pivotTab().sheet, state().sheets);

describe("a pivot sheet holds the whole result (#56)", () => {
  it("keeps all 35 products and the Grand total row", () => {
    expect(state().buildPivotSheet({ rowFields: [0], colField: null, valueField: 3, agg: "sum" })).toBe(true);
    const { values, display } = shown();
    const products = display.slice(1, 36).map((r) => r[0]);
    expect(products[0]).toBe("P01");
    expect(products[34]).toBe("P35");
    expect(display[36][0]).toBe(getMessages().pivot.grandTotal);
    expect(values[36][1]).toBe(600);
    // The bold that marks the closing row reaches it too.
    expect(pivotTab().sheet.formats[36][0]).toEqual({ bold: true });
  });

  it("keeps all twelve months and the Grand total column", () => {
    expect(state().buildPivotSheet({ rowFields: [1], colField: 2, valueField: 3, agg: "sum" })).toBe(true);
    const { values, display } = shown();
    expect(display[0].slice(1, 14)).toEqual([
      "M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10", "M11", "M12",
      getMessages().pivot.grandTotal,
    ]);
    // North is every even row: 30 rows of 10.
    expect(display[1][0]).toBe("North");
    expect(values[1][13]).toBe(300);
    expect(values[3][13]).toBe(600);
  });

  it("refreshes to the whole result as well", () => {
    expect(state().buildPivotSheet({ rowFields: [0], colField: null, valueField: 3, agg: "sum" })).toBe(true);
    const pivotId = pivotTab().id;
    useSheetStore.setState((s) => ({
      sheets: s.sheets.map((t) =>
        t.id === pivotId ? { ...t, sheet: { ...t.sheet, pivot: { ...t.sheet.pivot!, hash: "stale" } } } : t
      ),
    }));
    expect(state().refreshPivot()).toBe(true);
    const { values, display } = shown();
    expect(display[36][0]).toBe(getMessages().pivot.grandTotal);
    expect(values[36][1]).toBe(600);
  });

  it("still opens with room to work in when the result is small", () => {
    state().setSelection({ startRow: 0, startCol: 0, endRow: 4, endCol: 3, anchorRow: 0, anchorCol: 0 });
    expect(state().buildPivotSheet({ rowFields: [1], colField: null, valueField: 3, agg: "sum" })).toBe(true);
    expect(pivotTab().sheet.rows).toBe(30);
    expect(pivotTab().sheet.cols).toBe(10);
  });
});

describe("a pivot too big for a sheet is said, not cut (#56)", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** 2,000 rows, each its own group and its own column: a 2,002 × 2,002 result. */
  const tooWide = () => {
    const grid = [["Key", "Split", "Amount"]];
    for (let i = 0; i < 2000; i++) grid.push([`k${i}`, `s${i}`, "1"]);
    return grid;
  };

  it("builds nothing, and says how big it would have been", () => {
    useSheetStore.setState((s) => ({
      sheets: s.sheets.map((t) => (t.id === s.activeSheetId ? { ...t, sheet: sheetFromGrid(tooWide()) } : t)),
    }));
    state().setSelection({ startRow: 0, startCol: 0, endRow: 2000, endCol: 2, anchorRow: 0, anchorCol: 0 });
    const before = state().sheets;
    const answer = state().buildPivotSheet({ rowFields: [0], colField: 1, valueField: 2, agg: "sum" });
    expect(answer).toBe(getMessages().pivot.tooBig(2002, 2002));
    expect(answer).toContain("2,002");
    expect(state().sheets).toBe(before);
  });

  it("a refresh that would not fit keeps the pivot it had, and says why", () => {
    expect(state().buildPivotSheet({ rowFields: [1], colField: 0, valueField: 3, agg: "sum" })).toBe(true);
    const pivotId = pivotTab().id;
    const kept = pivotTab().sheet;
    // The source grows into 2,000 products, each one in its own column.
    const sourceId = state().sheets[0].id;
    const grown = [["Product", "Region", "Month", "Amount"]];
    for (let i = 0; i < 2000; i++) grown.push([`P${i}`, `R${i}`, "M01", "10"]);
    useSheetStore.setState((s) => ({
      sheets: s.sheets.map((t) =>
        t.id === sourceId
          ? { ...t, sheet: sheetFromGrid(grown) }
          : t.id === pivotId
            ? { ...t, sheet: { ...t.sheet, pivot: { ...t.sheet.pivot!, range: { startRow: 0, startCol: 0, endRow: 2000, endCol: 3 } } } }
            : t
      ),
    }));
    const alerts: string[] = [];
    vi.stubGlobal("alert", (message: string) => void alerts.push(message));
    expect(state().refreshPivot()).toBe(false);
    expect(alerts).toEqual([getMessages().pivot.tooBig(2002, 2002)]);
    expect(pivotTab().sheet.cells).toBe(kept.cells);
  });
});
