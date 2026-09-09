import { describe, expect, it } from "vitest";
import { adjustFormulaForStructuralOp } from "./structuralShift";

describe("adjustFormulaForStructuralOp: row deletion", () => {
  it("shifts a reference below the deleted row up by one", () => {
    expect(adjustFormulaForStructuralOp("A3", "row", 1, -1)).toBe("A2");
  });

  it("leaves a reference above the deleted row untouched", () => {
    expect(adjustFormulaForStructuralOp("A1", "row", 5, -1)).toBe("A1");
  });

  it("turns a reference to the deleted row itself into #REF!", () => {
    expect(adjustFormulaForStructuralOp("A2", "row", 1, -1)).toBe("#REF!");
  });

  it("shrinks a range whose top row is deleted", () => {
    expect(adjustFormulaForStructuralOp("A2:A5", "row", 1, -1)).toBe("A2:A4");
  });

  it("collapses a single-row range to #REF! when that row is deleted", () => {
    expect(adjustFormulaForStructuralOp("A2:C2", "row", 1, -1)).toBe("#REF!");
  });
});

describe("adjustFormulaForStructuralOp: row insertion", () => {
  it("shifts a reference at or below the insert point down by one", () => {
    expect(adjustFormulaForStructuralOp("A2", "row", 1, 1)).toBe("A3");
  });

  it("leaves a reference above the insert point untouched", () => {
    expect(adjustFormulaForStructuralOp("A1", "row", 1, 1)).toBe("A1");
  });

  it("grows a range when a row is inserted inside it", () => {
    expect(adjustFormulaForStructuralOp("A2:A5", "row", 3, 1)).toBe("A2:A6");
  });

  it("does not grow a range when the row is inserted outside it", () => {
    expect(adjustFormulaForStructuralOp("A2:A5", "row", 6, 1)).toBe("A2:A5");
  });
});

describe("adjustFormulaForStructuralOp: column operations", () => {
  it("shifts a column reference left after a column delete", () => {
    expect(adjustFormulaForStructuralOp("C1", "col", 1, -1)).toBe("B1");
  });

  it("turns a reference to the deleted column into #REF!", () => {
    expect(adjustFormulaForStructuralOp("B1", "col", 1, -1)).toBe("#REF!");
  });

  it("shifts a column reference right after a column insert", () => {
    expect(adjustFormulaForStructuralOp("B1", "col", 1, 1)).toBe("C1");
  });

  it("grows a range spanning the inserted column", () => {
    expect(adjustFormulaForStructuralOp("A1:C1", "col", 1, 1)).toBe("A1:D1");
  });
});

describe("adjustFormulaForStructuralOp: absolute references", () => {
  it("still shifts an absolute reference (structural ops always renumber, unlike fill/paste)", () => {
    expect(adjustFormulaForStructuralOp("$A$3", "row", 1, -1)).toBe("$A$2");
  });
});

describe("adjustFormulaForStructuralOp: mixed content", () => {
  it("adjusts references inside a function call and leaves literals/other tokens alone", () => {
    expect(adjustFormulaForStructuralOp('SUM(A2:A5)&"x"', "row", 1, -1)).toBe('SUM(A2:A4)&"x"');
  });
});
