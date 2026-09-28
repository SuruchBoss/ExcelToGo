// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TableData } from "@/lib/dataSources/types";
import { undoSheet, useSheetStore } from "./sheetStore";

/**
 * Rows and columns inserted or deleted around a live block (#46).
 *
 * The cells moved and the block's anchor did not, so the next refresh cleared the block's *old*
 * area and wrote it back there — over whatever of the person's had moved into that space. Nothing
 * said so, and autosave had kept the loss by the time anyone looked. Tested through the store
 * actions the row/column menu calls, then a refresh, which is where the loss happened.
 */
const state = () => useSheetStore.getState();
const cells = () => state().sheets[0].sheet.cells;
const blocks = () => state().sheets[0].liveBlocks ?? [];
const select = (r: number, c = 0) => state().setSelection({ startRow: r, startCol: c, endRow: r, endCol: c, anchorRow: r, anchorCol: c });

const TABLE: TableData = {
  columns: [
    { key: "sku", label: "sku", numeric: false },
    { key: "qty", label: "qty", numeric: true },
  ],
  rows: [
    ["CF-01", 10],
    ["CF-02", 20],
    ["BK-01", 30],
  ],
  fetchedAt: new Date(0).toISOString(),
};
const refresh = () => state().applyLiveData("sales", TABLE);

const alerts: string[] = [];
beforeEach(() => {
  alerts.length = 0;
  vi.stubGlobal("alert", (message: string) => void alerts.push(message));
  state().startBlank();
  useSheetStore.temporal.getState().clear();
  // The issue's own steps: a title, the block at A3 (header + 3 rows = A3:B6), a total and a note under it.
  state().setCellRaw(0, 0, "Title row");
  select(2);
  state().addLiveBlock({ sourceId: "sales", anchorRow: 2, anchorCol: 0, kind: "table" }, TABLE);
  state().setCellRaw(6, 0, "Total qty:");
  state().setCellRaw(6, 1, "=SUM(B4:B6)");
  state().setCellRaw(7, 0, "note: keep");
});

describe("a live block moves with the rows and columns around it (#46)", () => {
  it("deleting a row above it: the block and the person's rows move up together, and a refresh erases nothing", () => {
    select(0);
    state().deleteSelectedRow();
    refresh();
    expect(blocks()[0].anchorRow).toBe(1);
    expect(cells()[1].slice(0, 2)).toEqual(["sku", "qty"]);
    expect(cells()[5].slice(0, 2)).toEqual(["Total qty:", "=SUM(B3:B5)"]);
    expect(cells()[6][0]).toBe("note: keep");
    // Nothing written into the row the title moved out of.
    expect(cells()[0].slice(0, 2)).toEqual(["", ""]);
  });

  it("inserting a row above it: the block moves down, and no stale copy of its last row is left under it", () => {
    select(2);
    state().insertRowAtSelection();
    refresh();
    expect(blocks()[0].anchorRow).toBe(3);
    expect(cells()[2].slice(0, 2)).toEqual(["", ""]);
    expect(cells()[3].slice(0, 2)).toEqual(["sku", "qty"]);
    expect(cells()[6].slice(0, 2)).toEqual(["BK-01", "30"]);
    expect(cells()[7].slice(0, 2)).toEqual(["Total qty:", "=SUM(B5:B7)"]);
    expect(cells()[8][0]).toBe("note: keep");
  });

  it("inserting a column before it moves it right, and the cells beside it stay theirs", () => {
    state().setCellRaw(3, 3, "beside");
    select(2, 0);
    state().insertColumnAtSelection();
    refresh();
    expect(blocks()[0].anchorCol).toBe(1);
    expect(cells()[2].slice(0, 3)).toEqual(["", "sku", "qty"]);
    expect(cells()[3][4]).toBe("beside");
  });

  it("refuses to insert a row or column inside it, and says why", () => {
    const before = cells().map((r) => [...r]);
    select(4);
    state().insertRowAtSelection();
    select(3, 1);
    state().insertColumnAtSelection();
    expect(alerts).toHaveLength(2);
    expect(cells()).toEqual(before);
    expect(blocks()[0]).toMatchObject({ anchorRow: 2, anchorCol: 0 });
  });

  it("refuses to delete one of its data rows or columns — the next refresh would write it back over a row of yours", () => {
    const before = cells().map((r) => [...r]);
    select(4);
    state().deleteSelectedRow();
    select(3, 1);
    state().deleteSelectedColumn();
    expect(alerts).toHaveLength(2);
    expect(cells()).toEqual(before);
  });

  it("deleting its header row ends the link but keeps the values as ordinary cells", () => {
    select(2);
    state().deleteSelectedRow();
    expect(blocks()).toEqual([]);
    expect(cells()[2].slice(0, 2)).toEqual(["CF-01", "10"]);
    refresh();
    expect(cells()[2].slice(0, 2)).toEqual(["CF-01", "10"]);
    expect(cells()[5].slice(0, 2)).toEqual(["Total qty:", "=SUM(B3:B5)"]);
    expect(alerts).toEqual([]);
  });

  it("deleting a single-value block's row ends its link, and a refresh does not write it into the row that moved up", () => {
    select(10, 3);
    state().addLiveBlock({ sourceId: "sales", anchorRow: 10, anchorCol: 3, kind: "value", column: "qty", aggregate: "sum" }, TABLE);
    expect(cells()[10][3]).toBe("60");
    state().setCellRaw(11, 3, "under it");
    state().deleteSelectedRow();
    expect(blocks().map((b) => b.kind)).toEqual(["table"]);
    refresh();
    expect(cells()[10][3]).toBe("under it");
  });

  it("undo puts the block back where it was, linked", () => {
    select(0);
    state().deleteSelectedRow();
    undoSheet();
    expect(blocks()[0].anchorRow).toBe(2);
    refresh();
    expect(cells()[0][0]).toBe("Title row");
    expect(cells()[2].slice(0, 2)).toEqual(["sku", "qty"]);
    expect(cells()[6][0]).toBe("Total qty:");
  });
});
