// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { computeTab, undoSheet, useSheetStore } from "./sheetStore";

/**
 * Cut and paste is a move (#51).
 *
 * It was a copy followed by a clear: a formula that read the cut cell went on reading the now
 * empty one, and showed 0 without a word, while the cut formula itself was shifted as a copy
 * would be. Tested through the store actions Ctrl+X and Ctrl+V call.
 */
const state = () => useSheetStore.getState();
const tab = (i: number) => state().sheets[i];
const cells = (i = 0) => tab(i).sheet.cells;
const values = (i = 0) => computeTab(tab(i).sheet, state().sheets).values;
const select = (r1: number, c1: number, r2 = r1, c2 = c1) =>
  state().setSelection({ startRow: r1, startCol: c1, endRow: r2, endCol: c2, anchorRow: r1, anchorCol: c1 });
const move = (from: [number, number, number?, number?], to: [number, number]) => {
  select(...(from as [number, number, number, number]));
  state().cutSelection();
  select(...to);
  state().pasteAtSelection();
};

beforeEach(() => {
  state().startBlank();
  state().clearClipboard();
  useSheetStore.temporal.getState().clear();
  state().setCellRaw(0, 0, "5");
  state().setCellRaw(0, 1, "=A1*2");
});

describe("cut and paste moves, as in Excel (#51)", () => {
  it("a formula that read the moved cell follows it, and keeps its value", () => {
    move([0, 0], [0, 3]);
    expect(cells()[0][1]).toBe("=D1*2");
    expect(values()[0][1]).toBe(10);
    expect(cells()[0][0]).toBe("");
  });

  it("a moved formula keeps pointing where it did, and what read it follows it", () => {
    state().setCellRaw(0, 2, "=B1+1");
    move([0, 1], [4, 2]);
    expect(cells()[4][2]).toBe("=A1*2");
    expect(cells()[0][2]).toBe("=C5+1");
    expect(values()[0][2]).toBe(11);
  });

  it("a formula that read the cell the block landed on says #REF!, as Excel does", () => {
    // The owner's check in Excel: D1 5, E1 =D1*2, F1 =H1; cut D1, paste on H1 → E1 10, F1 #REF!.
    state().setCellRaw(0, 3, "5");
    state().setCellRaw(0, 4, "=D1*2");
    state().setCellRaw(0, 5, "=H1");
    move([0, 3], [0, 7]);
    expect(cells()[0][4]).toBe("=H1*2");
    expect(values()[0][4]).toBe(10);
    expect(cells()[0][5]).toBe("=#REF!");
    expect(String(values()[0][5])).toBe("#REF!");
  });

  it("a block that refers to itself still does, at its new place", () => {
    state().setCellRaw(1, 0, "=SUM(A1:B1)");
    move([0, 0, 0, 1], [4, 3]);
    expect([cells()[4][3], cells()[4][4]]).toEqual(["5", "=D5*2"]);
    expect(cells()[1][0]).toBe("=SUM(D5:E5)");
    expect(values()[1][0]).toBe(15);
  });

  it("onto part of itself: what it left is emptied, and references move once", () => {
    state().setCellRaw(1, 0, "6");
    state().setCellRaw(2, 0, "7");
    state().setCellRaw(5, 0, "=SUM(A1:A3)");
    move([0, 0, 2, 0], [1, 0]);
    expect(cells().slice(0, 4).map((r) => r[0])).toEqual(["", "5", "6", "7"]);
    expect(cells()[5][0]).toBe("=SUM(A2:A4)");
    expect(cells()[0][1]).toBe("=A2*2");
    expect(values()[5][0]).toBe(18);
  });

  it("a name that pointed at the cell points at where it went", () => {
    select(0, 0);
    expect(state().defineName("Rate")).toBeNull();
    state().setCellRaw(2, 0, "=Rate*3");
    move([0, 0], [6, 6]);
    expect(tab(0).sheet.names?.RATE.ref).toBe("$G$7");
    expect(values()[2][0]).toBe(15);
  });

  it("across sheets: the sheet it left names the new place, the moved formula names the old sheet, one undo puts it back", () => {
    state().setCellRaw(0, 2, "3");
    state().setCellRaw(0, 5, "=B1");
    // B1 reads A1 (moving with it) and C1 (staying).
    state().setCellRaw(0, 1, "=A1*C1");
    select(0, 0, 0, 1);
    state().cutSelection();
    state().addSheet();
    select(0, 3);
    state().pasteAtSelection();
    expect([cells(1)[0][3], cells(1)[0][4]]).toEqual(["5", "=D1*Sheet1!C1"]);
    expect(values(1)[0][4]).toBe(15);
    expect(cells(0)[0][5]).toBe(`=${tab(1).name}!E1`);
    expect(values(0)[0][5]).toBe(15);
    undoSheet();
    expect([cells(0)[0][0], cells(0)[0][1], cells(0)[0][5]]).toEqual(["5", "=A1*C1", "=B1"]);
  });

  it("a copy still shifts as a copy, and can be pasted again", () => {
    select(0, 1);
    state().copySelection();
    select(4, 2);
    state().pasteAtSelection();
    expect(cells()[4][2]).toBe("=B5*2");
    expect(cells()[0][1]).toBe("=A1*2");
    expect(state().clipboard).not.toBeNull();
  });
});
