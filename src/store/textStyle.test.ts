// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { undoSheet, useSheetStore } from "./sheetStore";

/**
 * Italic and underline were in the model long before anything could set them: an imported .xlsx
 * kept them and the export wrote them back, but the format bar had only bold. These are the two
 * buttons that close that gap, tested through the same store actions the buttons call.
 */
const state = () => useSheetStore.getState();
const formatAt = (r: number, c: number) =>
  state().sheets.find((t) => t.id === state().activeSheetId)!.sheet.formats[r]?.[c];
const select = (startRow: number, startCol: number, endRow: number, endCol: number) =>
  state().setSelection({ startRow, startCol, endRow, endCol, anchorRow: startRow, anchorCol: startCol });

beforeEach(() => {
  state().startBlank();
  useSheetStore.temporal.getState().clear();
});

describe("italic and underline", () => {
  it("italic covers the whole selection and a second press takes it off", () => {
    select(0, 0, 1, 1);
    state().toggleItalic();
    for (const [r, c] of [[0, 0], [0, 1], [1, 0], [1, 1]]) expect(formatAt(r, c)?.italic).toBe(true);
    state().toggleItalic();
    expect(formatAt(0, 0)?.italic).toBeFalsy();
    expect(formatAt(1, 1)?.italic).toBeFalsy();
  });

  it("underline is its own switch: it leaves bold and italic as they were", () => {
    select(2, 2, 2, 2);
    state().toggleBold();
    state().toggleItalic();
    state().toggleUnderline();
    expect(formatAt(2, 2)).toMatchObject({ bold: true, italic: true, underline: true });
    state().toggleUnderline();
    expect(formatAt(2, 2)).toMatchObject({ bold: true, italic: true });
    expect(formatAt(2, 2)?.underline).toBeFalsy();
  });

  it("the anchor decides the direction for a mixed selection, the way bold does", () => {
    select(1, 0, 1, 0);
    state().toggleUnderline();
    // Anchor at an un-underlined cell: the whole range turns on, including the one already on.
    select(0, 0, 1, 0);
    state().toggleUnderline();
    expect(formatAt(0, 0)?.underline).toBe(true);
    expect(formatAt(1, 0)?.underline).toBe(true);
  });

  it("is one undo step", () => {
    select(0, 0, 0, 0);
    state().toggleItalic();
    undoSheet();
    expect(formatAt(0, 0)?.italic).toBeFalsy();
  });

  it("fill colours the whole selection, and no-fill takes it off again", () => {
    select(0, 0, 0, 2);
    state().setFillColor("#fff2cc");
    for (const c of [0, 1, 2]) expect(formatAt(0, c)?.fill).toBe("#fff2cc");
    state().setFillColor(undefined);
    expect(formatAt(0, 1)?.fill).toBeUndefined();
  });
});
