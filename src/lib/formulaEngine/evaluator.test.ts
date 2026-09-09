import { describe, expect, it } from "vitest";
import { calc } from "./testUtils";
import { ERR_DIV0, ERR_NAME, ERR_REF, isError } from "./types";

describe("evaluate: arithmetic", () => {
  it("computes basic arithmetic with correct precedence", () => {
    expect(calc("1+2*3")).toBe(7);
    expect(calc("(1+2)*3")).toBe(9);
    expect(calc("2^10")).toBe(1024);
    expect(calc("-5+2")).toBe(-3);
  });

  it("returns #DIV/0! for division by zero", () => {
    const result = calc("1/0");
    expect(isError(result)).toBe(true);
    expect(String(result)).toBe(ERR_DIV0.code);
  });
});

describe("evaluate: comparisons and concatenation", () => {
  it("evaluates numeric and string comparisons", () => {
    expect(calc("1<2")).toBe(true);
    expect(calc("2<=2")).toBe(true);
    expect(calc('"b">"a"')).toBe(true);
    expect(calc("1<>2")).toBe(true);
  });

  it("concatenates with &, converting numbers to display strings", () => {
    expect(calc('"total: "&5')).toBe("total: 5");
  });
});

describe("evaluate: cell and range references", () => {
  const grid = [
    ["header", 10, 20],
    ["row2", 30, 40],
  ];

  it("reads a single cell", () => {
    expect(calc("B1", grid)).toBe(10);
  });

  it("reads out-of-bounds cells as blank (null)", () => {
    expect(calc("Z99", grid)).toBeNull();
  });

  it("evaluates a formula that reads a range via SUM", () => {
    expect(calc("SUM(B1:C2)", grid)).toBe(100);
  });
});

describe("evaluate: errors", () => {
  it("returns #NAME? for an unknown function", () => {
    const result = calc("NOTAFUNCTION(1)");
    expect(isError(result)).toBe(true);
    expect(String(result)).toBe(ERR_NAME.code);
  });

  it("propagates a literal #REF! through arithmetic", () => {
    const result = calc("#REF!+1");
    expect(isError(result)).toBe(true);
    expect(String(result)).toBe(ERR_REF.code);
  });

  it("propagates an error through & concatenation", () => {
    const result = calc('#REF!&"x"');
    expect(isError(result)).toBe(true);
    expect(String(result)).toBe(ERR_REF.code);
  });
});
