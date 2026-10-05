// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import type { TableData } from "@/lib/dataSources/types";
import { useSheetStore } from "./sheetStore";

/**
 * A sort over a live block (#235).
 *
 * The sort moved whole rows, live cells and all, and was said as done. The next refresh wrote the
 * block back in the source's order while the notes typed beside it stayed sorted, so a note sat on
 * another product's row without a word. A sort whose range reaches a live cell is refused whole.
 */
const state = () => useSheetStore.getState();
const cells = () => state().sheets[0].sheet.cells;
const select = (startRow: number, startCol: number, endRow = startRow, endCol = startCol) =>
  state().setSelection({ startRow, startCol, endRow, endCol, anchorRow: startRow, anchorCol: startCol });
const column = (c: number, from = 1, to = 3) => cells().slice(from, to + 1).map((r) => r[c]);

const TABLE: TableData = {
  columns: [
    { key: "sku", label: "sku", numeric: false },
    { key: "price", label: "price", numeric: true },
  ],
  rows: [
    ["CF-01", 50],
    ["BK-01", 30],
    ["BK-02", 40],
  ],
  fetchedAt: new Date(0).toISOString(),
};
const refresh = () => state().applyLiveData("sales", TABLE);

beforeEach(() => {
  state().startBlank();
  state().dismissRefusal();
  useSheetStore.temporal.getState().clear();
  // The block is A1:B4 (header + three rows); C2:C4 are the person's notes, one per product.
  select(0, 0);
  state().addLiveBlock({ sourceId: "sales", anchorRow: 0, anchorCol: 0, kind: "table" }, TABLE);
  state().setCellRaw(1, 2, "n-CF-01");
  state().setCellRaw(2, 2, "n-BK-01");
  state().setCellRaw(3, 2, "n-BK-02");
});

describe("a sort that reaches a live block is refused whole and said (#235)", () => {
  it("from a live column: nothing moves, the note names the cells, and a refresh leaves every note on its product", () => {
    select(1, 1);
    state().sortSelection(false);
    expect(column(0)).toEqual(["CF-01", "BK-01", "BK-02"]);
    expect(column(2)).toEqual(["n-CF-01", "n-BK-01", "n-BK-02"]);
    expect(state().announcement?.text).toMatch(/^A2:B4 (เป็นข้อมูลสด|is live data)/);
    expect(state().refusal).toMatchObject({ row: 1, col: 1 });
    refresh();
    expect(column(0)).toEqual(["CF-01", "BK-01", "BK-02"]);
    expect(column(2)).toEqual(["n-CF-01", "n-BK-01", "n-BK-02"]);
  });

  it("from the person's own column beside it, whose rows the sort would take the block with", () => {
    select(2, 2);
    state().sortSelection(true);
    expect(column(2)).toEqual(["n-CF-01", "n-BK-01", "n-BK-02"]);
    expect(state().refusal).toMatchObject({ row: 2, col: 2 });
  });

  it("a range that does not reach the block sorts as before", () => {
    state().setCellRaw(6, 0, "3");
    state().setCellRaw(7, 0, "1");
    state().setCellRaw(8, 0, "2");
    // Beside the block's rows too, as long as the selected range stays out of its columns.
    select(1, 3, 3, 3);
    state().setCellRaw(1, 3, "9");
    state().setCellRaw(2, 3, "7");
    state().setCellRaw(3, 3, "8");
    select(1, 3, 3, 3);
    state().sortSelection(true);
    expect(column(3)).toEqual(["7", "8", "9"]);
    expect(column(0)).toEqual(["CF-01", "BK-01", "BK-02"]);
    select(7, 0);
    state().sortSelection(true);
    expect(column(0, 6, 8)).toEqual(["1", "2", "3"]);
    expect(state().refusal).toBeNull();
  });
});
