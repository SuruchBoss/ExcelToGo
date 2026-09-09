import { describe, expect, it } from "vitest";
import { shiftFormulaRefs } from "./shift";

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
});
