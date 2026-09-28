// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { undoSheet, useSheetStore } from "./sheetStore";
import { COL_WIDTH, MAX_COL_WIDTH, MIN_COL_WIDTH, ROW_HEADER_WIDTH, columnLeft, columnWidth } from "@/lib/gridGeometry";

/**
 * Dragging a column's edge. The model has carried widths since imports first kept them; these are
 * the rules for setting one from the app, tested through the action the drag handle calls.
 */
const state = () => useSheetStore.getState();
const sheet = () => state().sheets.find((t) => t.id === state().activeSheetId)!.sheet;

beforeEach(() => {
  state().startBlank();
  useSheetStore.temporal.getState().clear();
});

describe("column width", () => {
  it("sets one column and leaves the others at the default", () => {
    state().setColumnWidth(2, 200);
    expect(columnWidth(sheet(), 2)).toBe(200);
    expect(columnWidth(sheet(), 1)).toBe(COL_WIDTH);
    // Everything to its right moves over by the difference, which is what the overlays read.
    expect(columnLeft(sheet(), 3)).toBe(ROW_HEADER_WIDTH + COL_WIDTH * 2 + 200);
  });

  it("is clamped, so a column dragged shut can still be found and dragged open", () => {
    state().setColumnWidth(0, 3);
    expect(columnWidth(sheet(), 0)).toBe(MIN_COL_WIDTH);
    state().setColumnWidth(0, 5000);
    expect(columnWidth(sheet(), 0)).toBe(MAX_COL_WIDTH);
  });

  it("one drag is one undo step, and undefined goes back to the default", () => {
    state().setColumnWidth(1, 250);
    undoSheet();
    expect(columnWidth(sheet(), 1)).toBe(COL_WIDTH);
    state().setColumnWidth(1, 250);
    state().setColumnWidth(1, undefined);
    expect(sheet().colWidths).toBeUndefined();
  });

  it("ignores a column the sheet does not have", () => {
    const before = sheet();
    state().setColumnWidth(sheet().cols + 5, 200);
    expect(sheet()).toBe(before);
  });
});
