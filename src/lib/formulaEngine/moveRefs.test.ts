// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { blockMove, moveFormulaRefs, type CellMove } from "./moveRefs";

const here = { readSheet: "Sheet1", writeSheet: "Sheet1" };
/** A1:B2 on Sheet1, moved so its top-left lands on D5. */
const move = blockMove("Sheet1", "Sheet1", { row: 0, col: 0 }, { row: 1, col: 1 }, { row: 4, col: 3 });

describe("moveFormulaRefs (#51)", () => {
  it("moves a reference into the block and keeps its $", () => {
    expect(moveFormulaRefs("A1*2", move, here)).toBe("D5*2");
    expect(moveFormulaRefs("$B$2+B$1", move, here)).toBe("$E$6+E$5");
  });

  it("leaves everything outside the block, and the text of an untouched formula, as it was", () => {
    expect(moveFormulaRefs("C1+A3", move, here)).toBe("C1+A3");
    expect(moveFormulaRefs("SUM( C1 , A3 )", move, here)).toBe("SUM( C1 , A3 )");
    expect(moveFormulaRefs('"A1"&A1', move, here)).toBe('"A1"&D5');
  });

  it("moves a range only when the whole of it was cut", () => {
    expect(moveFormulaRefs("SUM(A1:B2)", move, here)).toBe("SUM(D5:E6)");
    expect(moveFormulaRefs("SUM(A1:A2)", move, here)).toBe("SUM(D5:D6)");
    expect(moveFormulaRefs("SUM(A1:A3)", move, here)).toBe("SUM(A1:A3)");
    expect(moveFormulaRefs("SUM(A1:C1)", move, here)).toBe("SUM(A1:C1)");
  });

  it("follows the block to another sheet, naming it from the sheets it was not written on", () => {
    const across = blockMove("Sheet1", "ยอดขาย", { row: 0, col: 0 }, { row: 0, col: 0 }, { row: 0, col: 3 });
    // On the sheet it left: bare A1 meant this sheet, and now has to say where it went.
    expect(moveFormulaRefs("A1*2", across, here)).toBe("ยอดขาย!D1*2");
    // On a third sheet, which named it.
    expect(moveFormulaRefs("Sheet1!A1+Sheet1!A2", across, { readSheet: "Sheet3", writeSheet: "Sheet3" })).toBe("ยอดขาย!D1+Sheet1!A2");
    // On the sheet it arrived on, which used to have to name it.
    expect(moveFormulaRefs("Sheet1!A1", across, { readSheet: "ยอดขาย", writeSheet: "ยอดขาย" })).toBe("ยอดขาย!D1");
    // A bare reference on another sheet means that sheet, and does not move.
    expect(moveFormulaRefs("A1", across, { readSheet: "Sheet3", writeSheet: "Sheet3" })).toBe("A1");
  });

  it("a moved formula keeps pointing at the sheet it came from", () => {
    const across = blockMove("Sheet1", "Sheet2", { row: 0, col: 1 }, { row: 0, col: 1 }, { row: 4, col: 2 });
    expect(moveFormulaRefs("A1*2", across, { readSheet: "Sheet1", writeSheet: "Sheet2" })).toBe("Sheet1!A1*2");
    // A reference to itself goes with it, and on its new sheet needs no name.
    expect(moveFormulaRefs("B1", across, { readSheet: "Sheet1", writeSheet: "Sheet2" })).toBe("C5");
  });

  it("under a filter, only the rows that were cut move, and a range over a hidden row stays", () => {
    // Rows 2 and 4 cut (row 3 hidden), pasted at row 10 and 11.
    const filtered: CellMove = {
      fromSheet: "Sheet1",
      toSheet: "Sheet1",
      startRow: 1,
      startCol: 0,
      endRow: 3,
      endCol: 0,
      rowTo: new Map([
        [1, 9],
        [3, 10],
      ]),
      colOffset: 0,
    };
    expect(moveFormulaRefs("A2+A3+A4", filtered, here)).toBe("A10+A3+A11");
    expect(moveFormulaRefs("SUM(A2:A4)", filtered, here)).toBe("SUM(A2:A4)");
  });
});
