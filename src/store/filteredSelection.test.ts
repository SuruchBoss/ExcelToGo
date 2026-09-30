// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { useSheetStore } from "./sheetStore";

/**
 * A filter hides rows, and an action on the selection leaves them alone (#50).
 *
 * Deleting a filtered range emptied the hidden rows too, and nothing on screen said so: the person
 * saw four cells cleared and lost six. Copy took the hidden rows along, and Ctrl+Enter filled them.
 * Excel acts on what is on screen, and so does this.
 *
 *        A        B
 *   1  Region   Sales
 *   2  North    10
 *   3  South    2      ← hidden by the filter
 *   4  North    30
 *   5  South    4      ← hidden
 *   6  North    50
 */
const store = () => useSheetStore.getState();
const raw = (row: number, col: number) => store().sheets[0].sheet.cells[row][col];
const select = (startRow: number, startCol: number, endRow: number, endCol: number) =>
  store().setSelection({ startRow, startCol, endRow, endCol, anchorRow: startRow, anchorCol: startCol });

beforeEach(() => {
  store().startBlank();
  store().dismissPasteWarning();
  const rows = [
    ["Region", "Sales"],
    ["North", "10"],
    ["South", "2"],
    ["North", "30"],
    ["South", "4"],
    ["North", "50"],
  ];
  rows.forEach((row, r) => row.forEach((v, c) => store().setCellRaw(r, c, v)));
  // Everything but South, the way the column's filter list offers it (blank rows included).
  store().setColumnFilter(0, ["Region", "North", ""]);
});

describe("an action on a filtered selection skips the rows the filter hides (#50)", () => {
  it("QA's case: Delete on the visible B2:B6, then clear the filter — South's numbers are still there", () => {
    select(1, 1, 5, 1);
    store().clearSelection();
    store().clearAllFilters();
    expect([1, 2, 3, 4, 5].map((r) => raw(r, 1))).toEqual(["", "2", "", "4", ""]);
  });

  it("copy takes only the rows on screen, and pastes them together", () => {
    select(1, 1, 5, 1);
    store().copySelection();
    expect(store().clipboard?.rows).toEqual([["10"], ["30"], ["50"]]);
    store().clearAllFilters();
    select(0, 3, 0, 3);
    store().pasteAtSelection();
    expect([0, 1, 2].map((r) => raw(r, 3))).toEqual(["10", "30", "50"]);
    expect(raw(3, 3)).toBe("");
  });

  it("a copied formula follows its own row, not the block's first", () => {
    // C = B×(row) on every row. Rows 2 and 4 (0-based) are hidden; the visible ones land in rows 10–12
    // of column E. Two columns right, so B becomes D; each row by its own distance down.
    // Each row multiplies by its own row number, so the pasted text says which row it came from.
    for (let r = 1; r <= 5; r++) store().setCellRaw(r, 2, `=B${r + 1}*${r}`);
    select(1, 2, 5, 2);
    store().copySelection();
    store().clearAllFilters();
    select(10, 4, 10, 4);
    store().pasteAtSelection();
    // Source rows 1, 3, 5 → destination rows 10, 11, 12: moved by 9, 8 and 7, so each reads the D
    // beside it. A block-wide shift of 9 would have given D11, D13, D15.
    expect([10, 11, 12].map((r) => raw(r, 4))).toEqual(["=D11*1", "=D12*3", "=D13*5"]);
  });

  it("a cut clears only the rows it took, when pasted", () => {
    select(1, 1, 5, 1);
    store().cutSelection();
    select(0, 3, 0, 3);
    // D1:D3 includes the hidden row 3, so the paste asks first; this one says yes.
    store().pasteAtSelection(undefined, true);
    store().clearAllFilters();
    expect([1, 2, 3, 4, 5].map((r) => raw(r, 1))).toEqual(["", "2", "", "4", ""]);
    expect([0, 1, 2].map((r) => raw(r, 3))).toEqual(["10", "30", "50"]);
  });

  it("Ctrl+Enter fills only the rows on screen", () => {
    select(1, 1, 5, 1);
    store().setSelection({ startRow: 1, startCol: 1, endRow: 5, endCol: 1, anchorRow: 1, anchorCol: 1 });
    store().setCellRaw(1, 1, "0");
    store().fillSelectionFromAnchor();
    store().clearAllFilters();
    expect([1, 2, 3, 4, 5].map((r) => raw(r, 1))).toEqual(["0", "2", "0", "4", "0"]);
  });

  it("Ctrl+D fills down only the rows on screen", () => {
    select(1, 1, 5, 1);
    store().fillWithinSelection("down");
    store().clearAllFilters();
    // What the visible rows get is the fill's own business; the hidden ones are not touched.
    expect([2, 4].map((r) => raw(r, 1))).toEqual(["2", "4"]);
    expect([3, 5].map((r) => raw(r, 1))).not.toEqual(["30", "50"]);
  });

  it("a paste that would land on hidden rows asks first, and does nothing until told to (PO's call)", () => {
    select(0, 0, 0, 0);
    store().copySelection();
    select(1, 1, 3, 1);
    store().copySelection();
    // Three rows pasted from B2 cover B2:B4, and B3 is hidden.
    select(1, 1, 1, 1);
    store().pasteAtSelection();
    expect(store().pasteWarning).toEqual({ hidden: 1, text: undefined });
    expect(raw(2, 1)).toBe("2");
  });

  it("told to, the paste goes over the hidden row as well, and one undo puts it back", () => {
    select(1, 1, 5, 1);
    store().copySelection();
    select(2, 3, 2, 3);
    // The three visible values land on D3:D5, which covers the hidden rows 3 and 5.
    store().pasteAtSelection();
    expect(store().pasteWarning?.hidden).toBe(2);
    store().pasteAtSelection(undefined, true);
    expect([2, 3, 4].map((r) => raw(r, 3))).toEqual(["10", "30", "50"]);
    useSheetStore.temporal.getState().undo();
    expect([2, 3, 4].map((r) => raw(r, 3))).toEqual(["", "", ""]);
  });

  it("text from another app asks the same way, and keeps the text for the answer", () => {
    select(1, 1, 1, 1);
    store().clearClipboard();
    store().pasteAtSelection("a\nb");
    expect(store().pasteWarning).toEqual({ hidden: 1, text: "a\nb" });
  });

  it("a paste that lands only on rows on screen goes straight in, and clears a question left open", () => {
    store().clearClipboard();
    select(1, 1, 1, 1);
    store().pasteAtSelection("a\nb");
    expect(store().pasteWarning).not.toBeNull();
    select(3, 1, 3, 1);
    store().pasteAtSelection("x");
    expect(store().pasteWarning).toBeNull();
    expect(raw(3, 1)).toBe("x");
  });

  it("with no filter on, every row in the selection is acted on, as before", () => {
    store().clearAllFilters();
    select(1, 1, 5, 1);
    store().clearSelection();
    expect([1, 2, 3, 4, 5].map((r) => raw(r, 1))).toEqual(["", "", "", "", ""]);
  });
});
