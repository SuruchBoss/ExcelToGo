// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { computeSheet, createEmptySheet } from "../sheet";
import { withName } from "../namedRanges";
import type { FormulaValue } from "./types";

/**
 * What an aggregate reads from cells, and what an unknown name is (#166).
 *
 * Excel's SUM skips text and TRUE/FALSE that come from a cell, whether the cell is one of a range or
 * referred to alone, and still reads a value written into the formula. This engine used to read
 * text that spelt a number — `0812345678`, a `'1,250` — so a column of codes added up to a total
 * nobody could explain, and the file gave a different total once Excel recalculated it.
 *
 * And a name that is not defined is `#NAME?` wherever it is used. `=SUMIF(A2:A6,เหนือ,C2:C6)` with the
 * quotes forgotten was a silent 0, so the mistake looked like "no sales in the north".
 *
 * Every expectation here is Excel's answer for the same cells.
 */
function sheetOf(cells: Record<string, string>) {
  const sheet = createEmptySheet();
  for (const [ref, raw] of Object.entries(cells)) {
    const col = ref.charCodeAt(0) - 65;
    const row = Number(ref.slice(1)) - 1;
    sheet.cells[row][col] = raw;
  }
  return sheet;
}

/** The value a formula in F1 gives over the cells, as the grid would show it. */
function valueOf(formula: string, cells: Record<string, string> = {}): FormulaValue | string {
  const v = computeSheet(sheetOf({ ...cells, F1: formula })).values[0][5];
  return v !== null && typeof v === "object" ? (v as { code: string }).code : v;
}

/** The issue's first example: codes kept as text beside one real number. */
const CODES = { D2: "123-4-56789-0", D3: "0812345678", D4: "00123", D5: "1,000,000" };

describe("text read from cells is not a number to the aggregates (#166)", () => {
  it("the issue's range: SUM over codes and 1,000,000 is 1,000,000, not 813,345,801", () => {
    expect(valueOf("=SUM(D2:D5)", CODES)).toBe(1_000_000);
  });

  it("the issue's single cell: SUM of a text '1,250 is 0, while C2*2 still reads it as 2500", () => {
    expect(valueOf("=SUM(C2)", { C2: "'1,250" })).toBe(0);
    expect(valueOf("=C2*2", { C2: "'1,250" })).toBe(2500);
  });

  const TEXT = { A1: "'5" };
  const RANGE = { A1: "'5", A2: "3", A3: "0812345678" };
  const LOGICAL = { A1: "=TRUE()", A2: "3" };

  it("SUM: text from one cell, text in a range, TRUE from a cell — skipped; written in, read", () => {
    expect(valueOf("=SUM(A1)", TEXT)).toBe(0);
    expect(valueOf("=SUM(A1:A3)", RANGE)).toBe(3);
    expect(valueOf("=SUM(A1,A2)", { A1: "=1=1", A2: "3" })).toBe(3);
    expect(valueOf('=SUM("5",1)')).toBe(6);
    expect(valueOf("=SUM(TRUE,1)")).toBe(2);
  });

  it("AVERAGE: the same, and nothing to average is #DIV/0!", () => {
    expect(valueOf("=AVERAGE(A1)", TEXT)).toBe("#DIV/0!");
    expect(valueOf("=AVERAGE(A1:A3)", RANGE)).toBe(3);
    expect(valueOf('=AVERAGE("5",1)')).toBe(3);
  });

  it("MIN and MAX: text from cells is left out; with nothing left the answer is 0", () => {
    expect(valueOf("=MIN(A1)", TEXT)).toBe(0);
    expect(valueOf("=MAX(A1:A3)", RANGE)).toBe(3);
    expect(valueOf("=MIN(A1:A3)", { ...RANGE, A2: "9" })).toBe(9);
    expect(valueOf('=MAX("50",1)')).toBe(50);
  });

  it("PRODUCT: text from a cell is skipped rather than multiplied in", () => {
    expect(valueOf("=PRODUCT(A1,2)", TEXT)).toBe(2);
    expect(valueOf('=PRODUCT("5",2)')).toBe(10);
  });

  it("COUNT: text from cells is not counted, even when it spells a number; written in, it is", () => {
    expect(valueOf("=COUNT(A1)", TEXT)).toBe(0);
    expect(valueOf("=COUNT(D2:D5)", CODES)).toBe(1);
    expect(valueOf('=COUNT("5",1)')).toBe(2);
    expect(valueOf("=COUNTA(D2:D5)", CODES)).toBe(4);
  });

  it("TRUE/FALSE computed in a cell are skipped by SUM too, while a written TRUE counts", () => {
    expect(valueOf("=SUM(A1:A2)", LOGICAL)).toBe(3);
  });

  it("SUMIF, SUMIFS and SUMPRODUCT add only the numbers in the range they sum", () => {
    const cells = { A1: "x", B1: "0812345678", A2: "x", B2: "10", A3: "y", B3: "5", A4: "x", B4: "'7" };
    expect(valueOf('=SUMIF(A1:A4,"x",B1:B4)', cells)).toBe(10);
    expect(valueOf('=SUMIFS(B1:B4,A1:A4,"x")', cells)).toBe(10);
    expect(valueOf('=AVERAGEIF(A1:A4,"x",B1:B4)', cells)).toBe(10);
    expect(valueOf("=SUMPRODUCT(B1:B4)", cells)).toBe(15);
  });
});

describe("a name nothing defines is #NAME? wherever it is used (#166)", () => {
  const SALES = { A2: "เหนือ", C2: "10", A3: "ใต้", C3: "20", A4: "เหนือ", C4: "30" };

  it("the issue's SUMIF with the quotes forgotten is #NAME?, and with them it is the total", () => {
    expect(valueOf("=SUMIF(A2:A4,เหนือ,C2:C4)", SALES)).toBe("#NAME?");
    expect(valueOf('=SUMIF(A2:A4,"เหนือ",C2:C4)', SALES)).toBe(40);
  });

  it("COUNTIF, AVERAGEIF, SUMIFS and COUNTIFS the same", () => {
    expect(valueOf("=COUNTIF(A2:A4,เหนือ)", SALES)).toBe("#NAME?");
    expect(valueOf("=AVERAGEIF(A2:A4,เหนือ,C2:C4)", SALES)).toBe("#NAME?");
    expect(valueOf("=SUMIFS(C2:C4,A2:A4,เหนือ)", SALES)).toBe("#NAME?");
    expect(valueOf("=COUNTIFS(A2:A4,เหนือ)", SALES)).toBe("#NAME?");
  });

  it("a text function gives #NAME?, not the text \"#NAME?\"", () => {
    expect(valueOf("=UPPER(foo)")).toBe("#NAME?");
    expect(valueOf("=LEN(foo)")).toBe("#NAME?");
    expect(valueOf('=CONCAT("a",foo)')).toBe("#NAME?");
    expect(valueOf("=VLOOKUP(foo,A2:C4,3,FALSE)", SALES)).toBe("#NAME?");
  });

  it("the functions made to look at errors still do", () => {
    expect(valueOf("=IFERROR(foo,1)")).toBe(1);
    expect(valueOf("=IF(TRUE,1,foo)")).toBe(1);
    expect(valueOf("=COUNT(foo,1)")).toBe(1);
    expect(valueOf("=COUNTA(foo,1)")).toBe(2);
  });

  it("a defined name, TRUE and FALSE are not unknown names", () => {
    const sheet = { ...sheetOf({ A1: "5", F1: "=TOTAL*2" }), names: withName(undefined, "TOTAL", "A1") };
    expect(computeSheet(sheet).values[0][5]).toBe(10);
    expect(valueOf("=IF(TRUE,1,2)+IF(FALSE,1,2)")).toBe(3);
  });
});
