import { describe, expect, it } from "vitest";
import { parseFormula, FormulaSyntaxError } from "./parser";

describe("parseFormula", () => {
  it("parses numeric literals", () => {
    expect(parseFormula("42")).toEqual({ type: "number", value: 42 });
  });

  it("respects operator precedence (* before +)", () => {
    expect(parseFormula("1+2*3")).toEqual({
      type: "binop",
      op: "+",
      left: { type: "number", value: 1 },
      right: {
        type: "binop",
        op: "*",
        left: { type: "number", value: 2 },
        right: { type: "number", value: 3 },
      },
    });
  });

  it("makes ^ right-associative", () => {
    // 2^3^2 should be 2^(3^2), not (2^3)^2
    expect(parseFormula("2^3^2")).toEqual({
      type: "binop",
      op: "^",
      left: { type: "number", value: 2 },
      right: {
        type: "binop",
        op: "^",
        left: { type: "number", value: 3 },
        right: { type: "number", value: 2 },
      },
    });
  });

  it("lets parens override precedence", () => {
    expect(parseFormula("(1+2)*3")).toEqual({
      type: "binop",
      op: "*",
      left: {
        type: "binop",
        op: "+",
        left: { type: "number", value: 1 },
        right: { type: "number", value: 2 },
      },
      right: { type: "number", value: 3 },
    });
  });

  it("parses a cell reference into 0-based row/col", () => {
    expect(parseFormula("B3")).toEqual({ type: "cell", row: 2, col: 1 });
  });

  it("parses a range reference", () => {
    expect(parseFormula("A1:B2")).toEqual({ type: "range", startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
  });

  it("parses function calls with multiple arguments", () => {
    expect(parseFormula("SUM(A1,B1,2)")).toEqual({
      type: "call",
      name: "SUM",
      args: [
        { type: "cell", row: 0, col: 0 },
        { type: "cell", row: 0, col: 1 },
        { type: "number", value: 2 },
      ],
    });
  });

  it("parses unary minus", () => {
    expect(parseFormula("-A1")).toEqual({ type: "unary", op: "-", expr: { type: "cell", row: 0, col: 0 } });
  });

  it("parses string concatenation with &", () => {
    expect(parseFormula('"a"&"b"')).toEqual({
      type: "binop",
      op: "&",
      left: { type: "string", value: "a" },
      right: { type: "string", value: "b" },
    });
  });

  it("parses a bare #REF! literal", () => {
    expect(parseFormula("#REF!")).toEqual({ type: "referror" });
  });

  it("treats a bare function name with no parens as a plain string", () => {
    expect(parseFormula("FOO")).toEqual({ type: "string", value: "FOO" });
  });

  it("throws FormulaSyntaxError on a token with no valid primary expression", () => {
    expect(() => parseFormula(",")).toThrow(FormulaSyntaxError);
  });

  it("throws FormulaSyntaxError on unbalanced parens", () => {
    expect(() => parseFormula("(1+2")).toThrow(FormulaSyntaxError);
  });

  it("throws FormulaSyntaxError on a dangling operator", () => {
    expect(() => parseFormula("1+")).toThrow(FormulaSyntaxError);
  });
});
