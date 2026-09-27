// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { tokenize } from "./tokenizer";

describe("tokenize", () => {
  it("tokenizes numbers, operators, and parens", () => {
    expect(tokenize("1+2*(3-4)")).toEqual([
      { type: "NUMBER", value: "1" },
      { type: "OP", value: "+" },
      { type: "NUMBER", value: "2" },
      { type: "OP", value: "*" },
      { type: "LPAREN", value: "(" },
      { type: "NUMBER", value: "3" },
      { type: "OP", value: "-" },
      { type: "NUMBER", value: "4" },
      { type: "RPAREN", value: ")" },
      { type: "EOF", value: "" },
    ]);
  });

  it("uppercases cell and range references", () => {
    expect(tokenize("a1+b2:c3")).toEqual([
      { type: "CELL", value: "A1" },
      { type: "OP", value: "+" },
      { type: "RANGE", value: "B2:C3" },
      { type: "EOF", value: "" },
    ]);
  });

  it("preserves absolute-reference dollar signs on cells and ranges", () => {
    expect(tokenize("$A$1")).toEqual([{ type: "CELL", value: "$A$1" }, { type: "EOF", value: "" }]);
    expect(tokenize("$A1:B$2")).toEqual([{ type: "RANGE", value: "$A1:B$2" }, { type: "EOF", value: "" }]);
  });

  it("tokenizes function names and TRUE/FALSE as distinct types", () => {
    expect(tokenize("SUM(TRUE,FALSE)")).toEqual([
      { type: "FUNC", value: "SUM" },
      { type: "LPAREN", value: "(" },
      { type: "BOOL", value: "TRUE" },
      { type: "COMMA", value: "," },
      { type: "BOOL", value: "FALSE" },
      { type: "RPAREN", value: ")" },
      { type: "EOF", value: "" },
    ]);
  });

  it("unescapes doubled quotes inside string literals", () => {
    expect(tokenize('"say ""hi"""')).toEqual([{ type: "STRING", value: 'say "hi"' }, { type: "EOF", value: "" }]);
  });

  it("tokenizes a bare #REF! as a REFERR token", () => {
    expect(tokenize("#REF!+1")).toEqual([
      { type: "REFERR", value: "#REF!" },
      { type: "OP", value: "+" },
      { type: "NUMBER", value: "1" },
      { type: "EOF", value: "" },
    ]);
  });

  it("recognizes multi-character comparison operators before single-character ones", () => {
    expect(tokenize("A1<>B1")).toEqual([
      { type: "CELL", value: "A1" },
      { type: "OP", value: "<>" },
      { type: "CELL", value: "B1" },
      { type: "EOF", value: "" },
    ]);
    expect(tokenize("A1<=B1")).toEqual([
      { type: "CELL", value: "A1" },
      { type: "OP", value: "<=" },
      { type: "CELL", value: "B1" },
      { type: "EOF", value: "" },
    ]);
  });

  it("skips whitespace and unknown characters without throwing", () => {
    expect(tokenize(" 1  +  2 ")).toEqual([
      { type: "NUMBER", value: "1" },
      { type: "OP", value: "+" },
      { type: "NUMBER", value: "2" },
      { type: "EOF", value: "" },
    ]);
    expect(() => tokenize("1@2")).not.toThrow();
  });

  it("reads a number with an exponent as one number (#37)", () => {
    const numbers = (src: string) => tokenize(src).filter((t) => t.type !== "EOF");
    expect(numbers("1E3")).toEqual([{ type: "NUMBER", value: "1E3" }]);
    expect(numbers("1e3")).toEqual([{ type: "NUMBER", value: "1e3" }]);
    expect(numbers("2.5E-4")).toEqual([{ type: "NUMBER", value: "2.5E-4" }]);
    expect(numbers("6E+23")).toEqual([{ type: "NUMBER", value: "6E+23" }]);
  });

  it("still reads E3 on its own as a cell, and an E with no digits as no exponent", () => {
    expect(tokenize("E3")[0]).toEqual({ type: "CELL", value: "E3" });
    expect(tokenize("E3+1E3").slice(0, 3)).toEqual([
      { type: "CELL", value: "E3" },
      { type: "OP", value: "+" },
      { type: "NUMBER", value: "1E3" },
    ]);
    // `1E` then `+` is 1 followed by the name E, not an exponent waiting for digits.
    expect(tokenize("1E+A1").slice(0, 2)).toEqual([
      { type: "NUMBER", value: "1" },
      { type: "NAME", value: "E" },
    ]);
    // A range starting at column E, right after a number and an operator, stays a range.
    expect(tokenize("1*E3:E5").slice(0, 3)).toEqual([
      { type: "NUMBER", value: "1" },
      { type: "OP", value: "*" },
      { type: "RANGE", value: "E3:E5" },
    ]);
  });
});
