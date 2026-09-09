import { describe, expect, it } from "vitest";
import { calc } from "./testUtils";
import { isError } from "./types";

const grid = [
  ["ชื่อ", "หมวด", "ราคา"],
  ["กาแฟ", "เครื่องดื่ม", 45],
  ["ขนมปัง", "เบเกอรี่", 30],
  ["นม", "เครื่องดื่ม", 25],
];

describe("aggregate functions", () => {
  it("SUM/AVERAGE/MIN/MAX/COUNT over a numeric range", () => {
    expect(calc("SUM(C2:C4)", grid)).toBe(100);
    expect(calc("AVERAGE(C2:C4)", grid)).toBeCloseTo(33.333333, 5);
    expect(calc("MIN(C2:C4)", grid)).toBe(25);
    expect(calc("MAX(C2:C4)", grid)).toBe(45);
    expect(calc("COUNT(C2:C4)", grid)).toBe(3);
  });

  it("SUM ignores text and blanks inside a range", () => {
    expect(calc("SUM(A2:A4)", grid)).toBe(0);
    expect(calc("COUNTA(A2:A4)", grid)).toBe(3);
    expect(calc("COUNTBLANK(A1:A10)", grid)).toBeGreaterThan(0);
  });

  it("AVERAGE of an empty range is #DIV/0!", () => {
    expect(isError(calc("AVERAGE(Z1:Z5)", grid))).toBe(true);
  });
});

describe("rounding and math functions", () => {
  it("ROUND/ROUNDUP/ROUNDDOWN", () => {
    expect(calc("ROUND(1.2345,2)")).toBe(1.23);
    expect(calc("ROUNDUP(1.21,1)")).toBe(1.3);
    expect(calc("ROUNDDOWN(1.29,1)")).toBe(1.2);
  });

  it("ABS/SQRT/POWER/MOD/INT", () => {
    expect(calc("ABS(-5)")).toBe(5);
    expect(calc("SQRT(16)")).toBe(4);
    expect(calc("POWER(2,5)")).toBe(32);
    expect(calc("MOD(10,3)")).toBe(1);
    expect(calc("INT(4.9)")).toBe(4);
  });

  it("SQRT of a negative number is an error", () => {
    expect(isError(calc("SQRT(-1)"))).toBe(true);
  });
});

describe("logical functions", () => {
  it("IF branches on its condition", () => {
    expect(calc("IF(1>0,\"yes\",\"no\")")).toBe("yes");
    expect(calc("IF(1<0,\"yes\",\"no\")")).toBe("no");
  });

  it("IFERROR substitutes the fallback only when the first arg errors", () => {
    expect(calc("IFERROR(1/0,-1)")).toBe(-1);
    expect(calc("IFERROR(5,-1)")).toBe(5);
  });

  it("AND/OR/NOT", () => {
    expect(calc("AND(1>0,2>1)")).toBe(true);
    expect(calc("AND(1>0,2<1)")).toBe(false);
    expect(calc("OR(1<0,2>1)")).toBe(true);
    expect(calc("NOT(1>0)")).toBe(false);
  });
});

describe("text functions", () => {
  it("UPPER/LOWER/TRIM/LEN", () => {
    expect(calc('UPPER("abc")')).toBe("ABC");
    expect(calc('LOWER("ABC")')).toBe("abc");
    expect(calc('TRIM("  a  b  ")')).toBe("a b");
    expect(calc('LEN("hello")')).toBe(5);
  });

  it("LEFT/RIGHT/MID", () => {
    expect(calc('LEFT("hello",2)')).toBe("he");
    expect(calc('RIGHT("hello",2)')).toBe("lo");
    expect(calc('MID("hello",2,3)')).toBe("ell");
  });

  it("CONCATENATE/CONCAT join their arguments as text", () => {
    expect(calc('CONCATENATE("a","b",1)')).toBe("ab1");
  });
});

describe("lookup and conditional-aggregate functions", () => {
  it("SUMIF/COUNTIF/AVERAGEIF filter by a matching criteria range", () => {
    expect(calc('SUMIF(B2:B4,"เครื่องดื่ม",C2:C4)', grid)).toBe(70);
    expect(calc('COUNTIF(B2:B4,"เครื่องดื่ม")', grid)).toBe(2);
    expect(calc('AVERAGEIF(B2:B4,"เครื่องดื่ม",C2:C4)', grid)).toBe(35);
  });

  it("SUMIF supports comparison-operator criteria", () => {
    expect(calc('SUMIF(C2:C4,">25")', grid)).toBe(75);
  });

  it("VLOOKUP finds an exact match and reports #N/A when missing", () => {
    expect(calc('VLOOKUP("กาแฟ",A2:C4,3,FALSE)', grid)).toBe(45);
    expect(isError(calc('VLOOKUP("ไม่มี",A2:C4,3,FALSE)', grid))).toBe(true);
  });

  it("VLOOKUP rejects an out-of-range column index with #REF!", () => {
    expect(isError(calc('VLOOKUP("กาแฟ",A2:C4,9,FALSE)', grid))).toBe(true);
  });
});
