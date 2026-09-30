// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { computeTab, useSheetStore } from "./sheetStore";
import { useLocaleStore } from "./localeStore";

/**
 * Sorting keeps every row's formula on its own row (#48), and asks before a sort that cannot.
 *
 * Before this, a sort moved formula text unchanged: on the sample every visitor sees, 8 of 9 totals
 * read another row's price and quantity while the grand total still added up.
 */
const state = () => useSheetStore.getState();
const sheet = () => state().sheets.find((t) => t.id === state().activeSheetId)!.sheet;
const values = () => computeTab(sheet(), state().sheets).values;
const select = (r1: number, c1: number, r2 = r1, c2 = c1) =>
  state().setSelection({ startRow: r1, startCol: c1, endRow: r2, endCol: c2, anchorRow: r1, anchorCol: c1 });
const type = (cells: string[][]) => cells.forEach((row, r) => row.forEach((raw, c) => raw && state().setCellRaw(r, c, raw)));

beforeEach(() => {
  state().startBlank();
  state().dismissSortWarning();
});

describe("a formula sorts with its row (#48)", () => {
  it("fixes the QA's minimal case: every Double is still its own Score × 2", () => {
    type([
      ["Name", "Score", "Double"],
      ["a", "3", "=B2*2"],
      ["b", "1", "=B3*2"],
      ["c", "2", "=B4*2"],
    ]);
    select(1, 1);
    state().sortSelection(true);
    expect(values().slice(1, 4).map((r) => r.slice(0, 3))).toEqual([
      ["b", 1, 2],
      ["c", 2, 4],
      ["a", 3, 6],
    ]);
    expect(sheet().cells[1][2]).toBe("=B2*2");
  });

  it("sorting the text column Z→A keeps the header on row 1 and asks nothing (#49 with #48)", () => {
    // The header used to be sorted like data on a text column, and a header row inside the range
    // made its neighbours' formulas look like they pointed at another row.
    type([
      ["Name", "Score", "Double"],
      ["a", "3", "=B2*2"],
      ["b", "1", "=B3*2"],
      ["c", "2", "=B4*2"],
    ]);
    select(1, 0);
    state().sortSelection(false);
    expect(state().sortWarning).toBeNull();
    expect(values().slice(0, 4).map((r) => r.slice(0, 3))).toEqual([
      ["Name", "Score", "Double"],
      ["c", 2, 4],
      ["b", 1, 2],
      ["a", 3, 6],
    ]);
  });

  for (const locale of ["th", "en"] as const) {
    it(`keeps Price × Qty = Total on every row of the ${locale} sample, and the grand total unchanged`, () => {
      useLocaleStore.setState({ locale });
      state().openSample();
      const before = values()[11][4];
      for (const ascending of [false, true]) {
        select(1, 2); // Price
        state().sortSelection(ascending);
        expect(state().sortWarning).toBeNull();
        const v = values();
        for (let r = 1; r <= 9; r++) expect(v[r][4], `row ${r + 1}`).toBe((v[r][2] as number) * (v[r][3] as number));
        expect(v[11][4]).toBe(before);
      }
    });
  }
});

describe("what stays where it points (#48)", () => {
  it("a rate below the table, written without $, still reads the rate after a sort", () => {
    type([
      ["item", "net", "vat"],
      ["x", "300", "=B2*B6"],
      ["y", "100", "=B3*B6"],
      ["z", "200", "=B4*B6"],
      ["", "", ""],
      ["rate", "0.5", ""],
    ]);
    select(1, 1);
    state().sortSelection(true);
    expect(state().sortWarning).toBeNull();
    expect(values().slice(1, 4).map((r) => r[2])).toEqual([50, 100, 150]);
    expect(sheet().cells[1][2]).toBe("=B2*B6");
  });

  it("a pointer to another sheet keeps pointing at the same cell", () => {
    state().setCellRaw(0, 0, "70");
    state().addSheet();
    type([
      ["branch", "sales"],
      ["north", "100"],
      ["south", "=Sheet1!A1"],
    ]);
    select(1, 1);
    state().sortSelection(true);
    expect(state().sortWarning).toBeNull();
    expect(values().slice(1, 3).map((r) => r.slice(0, 2))).toEqual([
      ["south", 70],
      ["north", 100],
    ]);
  });
});

describe("asking before a sort that cannot keep a formula right (#48)", () => {
  const runningTotal = () =>
    type([
      ["item", "amount", "running"],
      ["x", "30", "=B2"],
      ["y", "10", "=C2+B3"],
      ["z", "20", "=C3+B4"],
    ]);

  it("does not sort a running total silently: it asks, and leaves the sheet as it was", () => {
    runningTotal();
    const cellsBefore = sheet().cells;
    select(1, 1);
    state().sortSelection(true);
    expect(state().sortWarning).toEqual({ ascending: true, formulas: 2 });
    expect(sheet().cells).toBe(cellsBefore);
  });

  it("sorts when asked again with force, and cancelling clears the question", () => {
    runningTotal();
    select(1, 1);
    state().sortSelection(true);
    state().dismissSortWarning();
    expect(state().sortWarning).toBeNull();
    state().sortSelection(true, true);
    expect(state().sortWarning).toBeNull();
    expect(values().slice(1, 4).map((r) => r[1])).toEqual([10, 20, 30]);
  });

  it("asks when the grand total is caught in the selected range", () => {
    state().openSample();
    select(0, 0, 11, 4);
    state().sortSelection(false);
    expect(state().sortWarning?.formulas).toBe(1);
  });

  it("asks when a row is fixed with $ inside the range, and not for $ outside it", () => {
    type([
      ["n", "rate"],
      ["2", "=A2*$B$6"],
      ["1", "=A3*$B$6"],
      ["", ""],
      ["", ""],
      ["", "0.5"],
    ]);
    select(1, 0, 2, 1);
    state().sortSelection(true);
    expect(state().sortWarning).toBeNull();
    state().setCellRaw(1, 1, "=A2*B$3");
    select(1, 0, 2, 1);
    state().sortSelection(true);
    expect(state().sortWarning?.formulas).toBe(1);
  });
});
