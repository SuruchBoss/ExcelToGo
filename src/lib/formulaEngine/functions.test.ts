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

const sales = [
  ["สาขา", "ไตรมาส", "ยอดขาย", "พนักงาน"],
  ["กรุงเทพ", "Q1", 120, 8],
  ["เชียงใหม่", "Q1", 45, 3],
  ["กรุงเทพ", "Q2", 260, 9],
  ["เชียงใหม่", "Q2", 80, 4],
  ["ภูเก็ต", "Q2", 150, 5],
];

describe("MATCH", () => {
  it("finds the position of an exact text match down a column", () => {
    expect(calc('MATCH("ภูเก็ต",A2:A6,0)', sales)).toBe(5);
  });

  it("finds the position along a single row too", () => {
    expect(calc('MATCH("ยอดขาย",A1:D1,0)', sales)).toBe(3);
  });

  it("matches text without caring about case", () => {
    expect(calc('MATCH("q2",B2:B6,0)', sales)).toBe(3);
  });

  it("returns #N/A when the value isn't there", () => {
    expect(isError(calc('MATCH("ขอนแก่น",A2:A6,0)', sales))).toBe(true);
  });

  it("refuses a two-dimensional range instead of guessing a position in it", () => {
    expect(isError(calc('MATCH("Q1",A1:D6,0)', sales))).toBe(true);
  });

  it("approximate match finds the largest value at or below the lookup", () => {
    const sorted = [[10], [20], [30], [40]];
    expect(calc("MATCH(25,A1:A4,1)", sorted)).toBe(2);
    expect(calc("MATCH(30,A1:A4,1)", sorted)).toBe(3);
    expect(calc("MATCH(40,A1:A4)", sorted)).toBe(4);
  });

  it("approximate match below every value is #N/A", () => {
    expect(isError(calc("MATCH(5,A1:A4,1)", [[10], [20], [30], [40]]))).toBe(true);
  });

  it("match type -1 walks a descending range", () => {
    const desc = [[40], [30], [20], [10]];
    expect(calc("MATCH(25,A1:A4,-1)", desc)).toBe(2);
  });

  it("stops at the first value that breaks the expected order, rather than reporting a wrong row", () => {
    // Excel assumes sorted input and quietly returns nonsense when it isn't; the walk stops instead.
    expect(calc("MATCH(35,A1:A4,1)", [[10], [20], [90], [30]])).toBe(2);
  });
});

describe("INDEX", () => {
  it("reads the value at a row and column inside a block", () => {
    expect(calc("INDEX(A1:D6,4,3)", sales)).toBe(260);
  });

  it("counts along a single-column range with one index", () => {
    expect(calc("INDEX(C2:C6,3)", sales)).toBe(260);
  });

  it("counts across a single-row range with one index", () => {
    expect(calc("INDEX(A1:D1,2)", sales)).toBe("ไตรมาส");
  });

  it("is #REF! outside the range, instead of an empty cell", () => {
    expect(isError(calc("INDEX(A1:D6,99,1)", sales))).toBe(true);
    expect(isError(calc("INDEX(A1:D6,1,9)", sales))).toBe(true);
  });

  it("row 0 hands back the whole column, so another function can consume it", () => {
    expect(calc("SUM(INDEX(A1:D6,0,3))", sales)).toBe(655);
  });

  it("column 0 hands back the whole row", () => {
    expect(calc("SUM(INDEX(A1:D6,4,0))", sales)).toBe(269);
  });
});

describe("INDEX/MATCH together", () => {
  it("looks a value up by a column that isn't the leftmost one", () => {
    // VLOOKUP cannot do this: the lookup column sits to the right of the answer.
    expect(calc('INDEX(A2:A6,MATCH(150,C2:C6,0))', sales)).toBe("ภูเก็ต");
  });

  it("reads across to another column, the usual replacement for VLOOKUP", () => {
    expect(calc('INDEX(D2:D6,MATCH("ภูเก็ต",A2:A6,0))', sales)).toBe(5);
  });

  it("propagates #N/A from a failed MATCH rather than returning the wrong row", () => {
    expect(isError(calc('INDEX(D2:D6,MATCH("ขอนแก่น",A2:A6,0))', sales))).toBe(true);
  });
});

describe("SUMIFS", () => {
  it("sums the rows meeting two conditions at once", () => {
    expect(calc('SUMIFS(C2:C6,A2:A6,"กรุงเทพ",B2:B6,"Q2")', sales)).toBe(260);
  });

  it("takes the range to sum first — the opposite of SUMIF", () => {
    // Same question, both spellings: SUMIF puts the sum range last, SUMIFS first.
    expect(calc('SUMIFS(C2:C6,A2:A6,"เชียงใหม่")', sales)).toBe(125);
    expect(calc('SUMIF(A2:A6,"เชียงใหม่",C2:C6)', sales)).toBe(125);
  });

  it("understands comparison criteria", () => {
    expect(calc('SUMIFS(C2:C6,C2:C6,">100")', sales)).toBe(530);
    expect(calc('SUMIFS(C2:C6,B2:B6,"Q2",D2:D6,">=5")', sales)).toBe(410);
  });

  it("is zero when nothing matches, not an error", () => {
    expect(calc('SUMIFS(C2:C6,A2:A6,"ขอนแก่น")', sales)).toBe(0);
  });

  it("refuses a criteria range that doesn't line up with the summed range", () => {
    // Lining them up from the top-left instead would test the wrong row for every cell after
    // the short one, and return a plausible-looking wrong total.
    expect(isError(calc('SUMIFS(C2:C6,A2:A4,"กรุงเทพ")', sales))).toBe(true);
  });

  it("refuses a dangling criteria range with no criteria after it", () => {
    expect(isError(calc("SUMIFS(C2:C6,A2:A6)", sales))).toBe(true);
  });

  it("ignores text sitting in the summed range", () => {
    expect(calc('SUMIFS(A2:A6,B2:B6,"Q1")', sales)).toBe(0);
  });
});
