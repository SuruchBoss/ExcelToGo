// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { undoSheet, useSheetStore } from "./sheetStore";

/**
 * Cut on one sheet, paste on another (#41).
 *
 * The clipboard did not record which sheet it came from, so the "clear the source" half of a cut
 * ran on whichever sheet was open at paste time — wiping the destination's own cells in the shape
 * of the block, and leaving the source untouched. Tested through the store actions the keyboard
 * shortcuts call, with the tab switch in between that the bug lived across.
 */
const state = () => useSheetStore.getState();
const tab = (i: number) => state().sheets[i];
const select = (r1: number, c1: number, r2 = r1, c2 = c1) =>
  state().setSelection({ startRow: r1, startCol: c1, endRow: r2, endCol: c2, anchorRow: r1, anchorCol: c1 });

beforeEach(() => {
  state().startBlank();
  useSheetStore.temporal.getState().clear();
  // Sheet1: the block to move.
  state().setCellRaw(0, 0, "move-me-1");
  state().setCellRaw(1, 0, "move-me-2");
  // Sheet2: cells that must survive.
  state().addSheet();
  state().setCellRaw(0, 0, "KEEP-A1");
  state().setCellRaw(0, 1, "KEEP-B1");
  state().setCellRaw(1, 0, "KEEP-A2");
  state().setActiveSheet(tab(0).id);
});

describe("cut on one sheet and paste on another (#41)", () => {
  it("clears the source sheet and leaves the destination's other cells alone", () => {
    select(0, 0, 1, 0);
    state().cutSelection();
    state().setActiveSheet(tab(1).id);
    select(0, 3);
    state().pasteAtSelection();

    const dest = tab(1).sheet.cells;
    expect([dest[0][3], dest[1][3]]).toEqual(["move-me-1", "move-me-2"]);
    expect([dest[0][0], dest[0][1], dest[1][0]]).toEqual(["KEEP-A1", "KEEP-B1", "KEEP-A2"]);
    const source = tab(0).sheet.cells;
    expect([source[0][0], source[1][0]]).toEqual(["", ""]);
  });

  it("undoes as one step: both sheets back as they were", () => {
    select(0, 0, 1, 0);
    state().cutSelection();
    state().setActiveSheet(tab(1).id);
    select(0, 3);
    state().pasteAtSelection();
    undoSheet();
    expect(tab(0).sheet.cells[0][0]).toBe("move-me-1");
    expect(tab(1).sheet.cells[0][3]).toBe("");
    expect(tab(1).sheet.cells[0][0]).toBe("KEEP-A1");
  });

  it("acts as a copy when the source sheet was deleted before the paste", () => {
    // Sheet3 is the source; it is gone by the time of the paste, so nothing can be cleared — and
    // above all nothing on the destination may be.
    state().addSheet();
    state().setCellRaw(0, 0, "from-3");
    select(0, 0);
    state().cutSelection();
    const gone = state().activeSheetId;
    state().setActiveSheet(tab(1).id);
    state().deleteSheet(gone);
    select(2, 0);
    state().pasteAtSelection();
    const dest = tab(1).sheet.cells;
    expect(dest[2][0]).toBe("from-3");
    expect([dest[0][0], dest[0][1], dest[1][0]]).toEqual(["KEEP-A1", "KEEP-B1", "KEEP-A2"]);
  });

  it("still moves within one sheet, including onto an overlapping spot", () => {
    select(0, 0, 1, 0);
    state().cutSelection();
    select(1, 0);
    state().pasteAtSelection();
    const cells = tab(0).sheet.cells;
    expect([cells[1][0], cells[2][0]]).toEqual(["move-me-1", "move-me-2"]);
  });

  it("copy across sheets clears nothing anywhere", () => {
    select(0, 0, 1, 0);
    state().copySelection();
    state().setActiveSheet(tab(1).id);
    select(0, 3);
    state().pasteAtSelection();
    expect(tab(0).sheet.cells[0][0]).toBe("move-me-1");
    expect(tab(1).sheet.cells[0][0]).toBe("KEEP-A1");
    expect(tab(1).sheet.cells[0][3]).toBe("move-me-1");
  });
});
