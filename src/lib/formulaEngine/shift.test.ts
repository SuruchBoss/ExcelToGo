// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { moveOwnRowRefs, rowReferences, shiftFormulaRefs } from "./shift";

describe("shiftFormulaRefs", () => {
  it("shifts a relative cell reference by the given offset", () => {
    expect(shiftFormulaRefs("A1", 1, 0)).toBe("A2");
    expect(shiftFormulaRefs("A1", 0, 1)).toBe("B1");
    expect(shiftFormulaRefs("A1", 2, 3)).toBe("D3");
  });

  it("leaves absolute references untouched", () => {
    expect(shiftFormulaRefs("$A$1", 5, 5)).toBe("$A$1");
  });

  it("shifts only the non-absolute half of a mixed reference", () => {
    expect(shiftFormulaRefs("$A1", 1, 1)).toBe("$A2");
    expect(shiftFormulaRefs("A$1", 1, 1)).toBe("B$1");
  });

  it("shifts both corners of a relative range", () => {
    expect(shiftFormulaRefs("A1:B2", 1, 1)).toBe("B2:C3");
  });

  it("clamps a shifted reference at the sheet edge instead of going negative", () => {
    expect(shiftFormulaRefs("A1", -5, -5)).toBe("A1");
  });

  it("shifts references inside a function call, leaving other tokens intact", () => {
    expect(shiftFormulaRefs("SUM(A1:A3)+B1", 1, 0)).toBe("SUM(A2:A4)+B2");
  });

  it("returns the body unchanged when the offset is zero", () => {
    expect(shiftFormulaRefs("SUM(A1:A3)", 0, 0)).toBe("SUM(A1:A3)");
  });

  it("round-trips string literals, re-escaping embedded quotes", () => {
    expect(shiftFormulaRefs('A1&"say ""hi"""', 1, 0)).toBe('A2&"say ""hi"""');
  });

  it("does not shift the exponent of a number as if it were a cell (#37)", () => {
    // Read as the number 1 and the cell E3, a fill one row down turned 1E3 into 1E4.
    expect(shiftFormulaRefs("1E3+A1", 1, 0)).toBe("1E3+A2");
    expect(shiftFormulaRefs("2.5e-4*B2", 0, 1)).toBe("2.5e-4*C2");
  });

  it("leaves the text of a signed power exactly as written (#25)", () => {
    // Fills rewrite the text token by token, so how the parser groups `-A1^2` cannot leak into it.
    expect(shiftFormulaRefs("-A1^2+0-B1^2", 1, 0)).toBe("-A2^2+0-B2^2");
  });
});


describe("a formula moved by a sort (#48)", () => {
  it("moves references to its own row and nothing else", () => {
    // Row 2 (index 1) sorted down to row 5: its own C2, D2 and C2:D2 follow; the rate in B6, the
    // fixed $2 row and the other sheet stay where they point.
    expect(moveOwnRowRefs("C2*D2", 1, 3)).toBe("C5*D5");
    expect(moveOwnRowRefs("SUM(C2:D2)*B6", 1, 3)).toBe("SUM(C5:D5)*B6");
    expect(moveOwnRowRefs("C$2+Sheet1!C2+C1:C2", 1, 3)).toBe("C$2+Sheet1!C2+C1:C2");
    expect(moveOwnRowRefs("IF(C2>0,\"a,b\",D2)", 1, -1)).toBe('IF(C1>0,"a,b",D1)');
    expect(moveOwnRowRefs("C2*D2", 1, 0)).toBe("C2*D2");
  });

  it("lists the rows it points at on its own sheet, with which are $-fixed", () => {
    expect(rowReferences("C2*D$3+SUM(E4:E10)+Other!A1")).toEqual([
      { row: 1, absolute: false },
      { row: 2, absolute: true },
      { row: 3, absolute: false },
      { row: 9, absolute: false },
    ]);
  });
});
