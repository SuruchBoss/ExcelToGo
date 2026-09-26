// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { calc, gridContext } from "./testUtils";
import { parseFormula } from "./parser";
import { evaluate } from "./evaluator";
import { colToLetters } from "./address";
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

  it("AVERAGEIF averages only the cells it matched, not one phantom per row", () => {
    // Written from a surviving mutant: widening the inner loop by one column left every row
    // matching an extra empty cell, which a `<` criterion happily counts as zero. The average
    // then drifts by exactly one zero per row — small, plausible, and silent.
    expect(calc('AVERAGEIF(C2:C4,"<40")', grid)).toBeCloseTo(27.5);
    expect(calc('AVERAGEIF(A2:C2,"<100")', grid)).toBe(45);
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

  it("still reaches the last row and the last column, which is where off-by-one lives", () => {
    // Written from a surviving mutant: `rowNum > height` loosened to `>=` makes exactly the
    // final row of every INDEX read `#REF!`, and nothing else in the suite asked for it.
    expect(calc("INDEX(A1:D6,6,4)", sales)).toBe(calc("D6", sales));
    expect(calc("INDEX(A1:D6,6,1)", sales)).toBe(calc("A6", sales));
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

describe("COUNTIFS and AVERAGEIFS", () => {
  it("counts the rows meeting every condition", () => {
    expect(calc('COUNTIFS(A2:A6,"กรุงเทพ")', sales)).toBe(2);
    expect(calc('COUNTIFS(A2:A6,"กรุงเทพ",B2:B6,"Q2")', sales)).toBe(1);
  });

  it("counts from the first range, with no separate range to aggregate", () => {
    // This is COUNTIFS' shape, and it differs from SUMIFS/AVERAGEIFS: pairs start at argument one.
    expect(calc('COUNTIFS(C2:C6,">100")', sales)).toBe(3);
  });

  it("is zero rather than an error when nothing matches", () => {
    expect(calc('COUNTIFS(A2:A6,"ขอนแก่น")', sales)).toBe(0);
  });

  it("averages only the rows meeting every condition", () => {
    expect(calc('AVERAGEIFS(C2:C6,B2:B6,"Q1")', sales)).toBeCloseTo(82.5);
    expect(calc('AVERAGEIFS(C2:C6,A2:A6,"กรุงเทพ",B2:B6,"Q2")', sales)).toBe(260);
  });

  it("skips text and blanks in the averaged range instead of counting them as zero", () => {
    const mixed = [["a", 10], ["a", "n/a"], ["a", 20]];
    expect(calc('AVERAGEIFS(B1:B3,A1:A3,"a")', mixed)).toBe(15);
  });

  it("is #DIV/0! when no row matches, because there is nothing to average", () => {
    expect(isError(calc('AVERAGEIFS(C2:C6,A2:A6,"ขอนแก่น")', sales))).toBe(true);
  });

  it("refuses ranges that don't line up", () => {
    expect(isError(calc('COUNTIFS(A2:A6,"กรุงเทพ",B2:B4,"Q2")', sales))).toBe(true);
    expect(isError(calc('AVERAGEIFS(C2:C6,A2:A4,"กรุงเทพ")', sales))).toBe(true);
  });

  it("refuses a criteria range with no criteria after it", () => {
    expect(isError(calc("COUNTIFS(A2:A6)", sales))).toBe(true);
    expect(isError(calc("AVERAGEIFS(C2:C6,A2:A6)", sales))).toBe(true);
  });
});

describe("wildcards in criteria", () => {
  const branches = [["กรุงเทพ", 1], ["กรุงเทพมหานคร", 2], ["เชียงใหม่", 4], ["Bangkok Bank", 8]];

  it("* stands for any run of characters", () => {
    expect(calc('SUMIF(A1:A4,"กรุงเทพ*",B1:B4)', branches)).toBe(3);
  });

  it("? stands for exactly one character", () => {
    expect(calc('COUNTIF(A1:A4,"เชียงใหม?")', branches)).toBe(1);
    expect(calc('COUNTIF(A1:A4,"เชียง?")', branches)).toBe(0);
  });

  it("matches without regard to case", () => {
    expect(calc('SUMIF(A1:A4,"bangkok*",B1:B4)', branches)).toBe(8);
  });

  it("a plain criteria still has to match the whole cell", () => {
    // Without a wildcard this is equality, not "contains" — the behaviour before wildcards existed.
    expect(calc('COUNTIF(A1:A4,"กรุงเทพ")', branches)).toBe(1);
  });

  it("~ escapes a wildcard so it matches the character itself", () => {
    const literal = [["10*20", 1], ["1020", 2]];
    expect(calc('COUNTIF(A1:A2,"10~*20")', literal)).toBe(1);
  });

  it("works through a comparison operator too", () => {
    expect(calc('COUNTIF(A1:A4,"<>กรุงเทพ*")', branches)).toBe(2);
  });

  it("regular expression characters in a criteria are matched literally", () => {
    // "." and "+" must not behave as regex syntax just because wildcards are compiled to one.
    const odd = [["a.c", 1], ["abc", 2]];
    expect(calc('COUNTIF(A1:A2,"a.c")', odd)).toBe(1);
    expect(calc('COUNTIF(A1:A2,"a*c")', odd)).toBe(2);
  });

  it("carries into the multi-condition functions", () => {
    expect(calc('SUMIFS(B1:B4,A1:A4,"กรุงเทพ*")', branches)).toBe(3);
    expect(calc('COUNTIFS(A1:A4,"*ใหม่")', branches)).toBe(1);
  });
});

describe("XLOOKUP", () => {
  const stock = [
    ["รหัส", "ชื่อ", "คงเหลือ"],
    ["A1", "กาแฟ", 12],
    ["B2", "ขนมปัง", 0],
    ["C3", "นม", 7],
  ];

  it("looks up across two named arrays, in either direction", () => {
    // The key column is to the right of the answer here, which VLOOKUP cannot do at all.
    expect(calc('XLOOKUP("นม",B2:B4,A2:A4)', stock)).toBe("C3");
    expect(calc('XLOOKUP("A1",A2:A4,C2:C4)', stock)).toBe(12);
  });

  it("returns what it was told to when nothing matches, instead of #N/A", () => {
    expect(calc('XLOOKUP("ไม่มี",A2:A4,C2:C4,"ไม่พบ")', stock)).toBe("ไม่พบ");
  });

  it("is #N/A with no fallback given", () => {
    expect(isError(calc('XLOOKUP("ไม่มี",A2:A4,C2:C4)', stock))).toBe(true);
  });

  it("searches forwards unless the search mode is negative", () => {
    // Written from a surviving mutant: `searchArg < 0` loosened to `<= 0` turns an explicit `0`
    // into a backwards search, so a lookup with two matches answers with the wrong one. Only the
    // value zero tells the two apart, which is exactly why no other test noticed.
    const twice = [["คีย์", "ผล"], ["ก", "แรก"], ["ข", "กลาง"], ["ก", "ท้าย"]];
    expect(calc('XLOOKUP("ก",A2:A4,B2:B4,,0,0)', twice)).toBe("แรก");
    expect(calc('XLOOKUP("ก",A2:A4,B2:B4,,0,1)', twice)).toBe("แรก");
    expect(calc('XLOOKUP("ก",A2:A4,B2:B4,,0,-1)', twice)).toBe("ท้าย");
  });

  it("matches exactly by default, unlike VLOOKUP", () => {
    // VLOOKUP's default is an approximate match, which quietly returns a neighbouring row.
    const nums = [["ค่า", "ผล"], [10, "สิบ"], [20, "ยี่สิบ"], [30, "สามสิบ"]];
    expect(isError(calc("XLOOKUP(15,A2:A4,B2:B4)", nums))).toBe(true);
  });

  it("finds the next smaller or next larger when asked", () => {
    const nums = [["ค่า", "ผล"], [10, "สิบ"], [20, "ยี่สิบ"], [30, "สามสิบ"]];
    expect(calc("XLOOKUP(15,A2:A4,B2:B4,,-1)", nums)).toBe("สิบ");
    expect(calc("XLOOKUP(15,A2:A4,B2:B4,,1)", nums)).toBe("ยี่สิบ");
  });

  it("finds the nearest match even when the column isn't sorted", () => {
    // The case VLOOKUP gets silently wrong: its approximate match assumes sorted input.
    const jumbled = [["ค่า", "ผล"], [30, "สามสิบ"], [10, "สิบ"], [20, "ยี่สิบ"]];
    expect(calc("XLOOKUP(25,A2:A4,B2:B4,,-1)", jumbled)).toBe("ยี่สิบ");
  });

  it("searches from the end when asked, which finds the last of a repeated key", () => {
    const dupes = [["ค่า", "ผล"], ["x", "แรก"], ["y", "กลาง"], ["x", "สุดท้าย"]];
    expect(calc('XLOOKUP("x",A2:A4,B2:B4)', dupes)).toBe("แรก");
    expect(calc('XLOOKUP("x",A2:A4,B2:B4,,0,-1)', dupes)).toBe("สุดท้าย");
  });

  it("matches wildcards in mode 2", () => {
    expect(calc('XLOOKUP("ขนม*",B2:B4,C2:C4,,2)', stock)).toBe(0);
  });

  it("refuses arrays of different lengths rather than pairing them up wrongly", () => {
    expect(isError(calc('XLOOKUP("A1",A2:A4,C2:C3)', stock))).toBe(true);
  });

  it("refuses a two-dimensional array, which would need a spill this engine has no way to do", () => {
    expect(isError(calc('XLOOKUP("A1",A2:A4,B2:C4)', stock))).toBe(true);
  });

  it("returns a matched blank as a match rather than falling through to not-found", () => {
    expect(calc('XLOOKUP("B2",A2:A4,C2:C4,"ไม่พบ")', stock)).toBe(0);
  });
});

describe("DATEDIF", () => {
  const dates = [["เริ่ม", "จบ"], ["2020-02-29", "2024-03-01"], ["2024-01-31", "2024-03-01"]];

  it("counts whole years, months and days", () => {
    expect(calc('DATEDIF("2020-01-15","2024-03-20","Y")', dates)).toBe(4);
    expect(calc('DATEDIF("2020-01-15","2024-03-20","M")', dates)).toBe(50);
    expect(calc('DATEDIF("2024-01-01","2024-03-01","D")', dates)).toBe(60);
  });

  it("does not count a year that hasn't come round yet", () => {
    expect(calc('DATEDIF("2020-06-15","2024-06-14","Y")', dates)).toBe(3);
    expect(calc('DATEDIF("2020-06-15","2024-06-15","Y")', dates)).toBe(4);
  });

  it("splits a gap into years, months and days with YM and MD", () => {
    expect(calc('DATEDIF("2020-01-15","2024-03-20","YM")', dates)).toBe(2);
    expect(calc('DATEDIF("2020-01-15","2024-03-20","MD")', dates)).toBe(5);
  });

  it("borrows from the previous month when the end day is earlier than the start day", () => {
    // 31 Jan to 1 Mar is one day past the end of February, not a negative number of days.
    expect(calc('DATEDIF("2024-01-31","2024-03-01","MD")', dates)).toBe(1);
  });

  it("counts days ignoring years with YD, across a year boundary", () => {
    expect(calc('DATEDIF("2023-12-25","2024-01-05","YD")', dates)).toBe(11);
  });

  it("is #NUM! when the end is before the start, rather than a negative age", () => {
    expect(isError(calc('DATEDIF("2024-03-01","2024-01-01","D")', dates))).toBe(true);
  });

  it("is #NUM! for a unit it doesn't know", () => {
    expect(isError(calc('DATEDIF("2024-01-01","2024-03-01","W")', dates))).toBe(true);
  });

  it("is #VALUE! for something that isn't a date", () => {
    expect(isError(calc('DATEDIF("เมื่อวาน","2024-03-01","D")', dates))).toBe(true);
  });

  it("reads a leap day as a real date and 31 February as an error", () => {
    expect(calc('DATEDIF("2024-02-29","2024-03-01","D")', dates)).toBe(1);
    expect(isError(calc('DATEDIF("2024-02-31","2024-03-01","D")', dates))).toBe(true);
  });
});

describe("dates read the day they say, in any timezone", () => {
  it("YEAR/MONTH/DAY of a plain date don't shift west of UTC", () => {
    // new Date("2024-01-15") is UTC midnight; reading it back with getDate() gave the 14th in the
    // Americas, so DAY of a date typed by hand was a day out for a whole hemisphere.
    expect(calc('DAY("2024-01-15")', [[""]])).toBe(15);
    expect(calc('MONTH("2024-01-01")', [[""]])).toBe(1);
    expect(calc('YEAR("2024-01-01")', [[""]])).toBe(2024);
  });
});

describe("logical values inside a range", () => {
  // Excel counts a logical passed as an argument and ignores one sitting in a cell. The engine
  // counted both, so a column with a `=TRUE()` in it summed one too high — silently, since the
  // number still looked like a number. Found by the property tests: SUM over a random grid did
  // not match a hand-written oracle.
  it("ignores a TRUE in a cell, the way Excel does", () => {
    expect(calc("SUM(A1:A3)", [[1], [true], [2]])).toBe(3);
  });

  it("still counts one passed straight in as an argument", () => {
    expect(calc("SUM(1,TRUE,2)")).toBe(4);
  });

  it("ignores it in AVERAGE as well, which changes the divisor too", () => {
    expect(calc("AVERAGE(A1:A3)", [[1], [true], [3]])).toBe(2);
  });
});

/**
 * Cases `check:mutants` asked for.
 *
 * Each of these started as a survivor: a change to the engine that the whole suite ran green over.
 * A test written because a mutant survived is worth more than one written because a function
 * existed — it covers a specific way of being wrong that nothing else was watching.
 */
describe("gaps the mutation gate found", () => {
  it("COUNT wants text that is a number, not merely text that is present", () => {
    // `v.trim() !== "" && !Number.isNaN(Number(v))` turned into `||` and nothing noticed, because
    // every COUNT test used a range of numbers, where both halves agree.
    expect(calc("COUNT(A1:A4)", [[1], ["ไม่ใช่ตัวเลข"], [""], ["7"]])).toBe(2);
  });

  it("COUNTIFS counts the cells that are there, not one past the end of each row", () => {
    // `c < shape[r].length` → `<=` read a cell past the row; `null` coerces to 0, which matches
    // "<10", so the count doubled and every existing COUNTIFS test still passed.
    expect(calc('COUNTIFS(A1:A3,"<10")', [[1], [2], [3]])).toBe(3);
  });

  it("SEQUENCE refuses a height of zero as well as one that is too large", () => {
    // The guard is three conditions joined by `||`; turning the first into `&&` let a zero height
    // through, because the width was fine.
    expect(String(calc("SEQUENCE(0)"))).toBe("#NUM!");
    expect(String(calc("SEQUENCE(3,0)"))).toBe("#NUM!");
  });

  it("VLOOKUP's approximate match takes an exact hit when there is one", () => {
    // `key <= lookupNum` → `<` still finds *a* row, one above the right one, and returns a
    // plausible neighbouring value — the kind of wrong answer nobody queries.
    const table = [[10, "ก"], [20, "ข"], [30, "ค"]];
    expect(calc("VLOOKUP(30,A1:B3,2,TRUE)", table)).toBe("ค");
    expect(calc("VLOOKUP(25,A1:B3,2,TRUE)", table)).toBe("ข");
  });

  it("compares a number against text without giving up on both", () => {
    // The numeric fast path is guarded by `&&`; with `||` one number was enough to enter it, and
    // `1 - "ก"` is NaN, which makes every comparison false — including the one that should be true.
    expect(String(calc('1<"ก"'))).toBe("true");
    expect(String(calc('"ก"<1'))).toBe("false");
  });

  it('reads the text "FALSE" as false, which is the whole point of reading it', () => {
    expect(String(calc('IF("FALSE",1,2)'))).toBe("2");
    expect(String(calc('IF("TRUE",1,2)'))).toBe("1");
  });

  it("FIND refuses a start position before the first character", () => {
    // `start < 1 || start > hay.length + 1` → `&&` let a zero through, and `indexOf(needle, -1)`
    // quietly behaves like 0 — so a nonsense argument returned a plausible position.
    expect(String(calc('FIND("b","abc",0)'))).toBe("#VALUE!");
    expect(calc('FIND("b","abc",1)')).toBe(2);
  });

  it("ROUNDUP rounds to the digits it was given", () => {
    // `Math.ceil(n * factor) / factor` is identical to `n / factor / factor` while the digits are
    // zero — which is how every existing test called it.
    expect(calc("ROUNDUP(1.234,2)")).toBeCloseTo(1.24, 10);
    // Away from zero, as Excel does it — which is why the negative branch exists at all.
    expect(calc("ROUNDUP(-1.234,2)")).toBeCloseTo(-1.24, 10);
    expect(calc("ROUNDDOWN(1.239,2)")).toBeCloseTo(1.23, 10);
  });
});

/**
 * Gaps the mutation gate found once the SORT fix moved the engine's lines and the pinned seed drew a
 * different 32 edits. Each test below is named for the edit it would have let through. (One more
 * survivor, `cmp < 0` → `cmp <= 0` in MATCH's descending branch, is equivalent: an exact match
 * returns two lines earlier, so `cmp` is never 0 there.)
 */
describe("gaps the mutation gate found", () => {
  it("SORT orders text, not only numbers", () => {
    // A rank that lumped every string together sorted text by nothing at all.
    const sheet = [["ค"], ["ก"], ["ข"]];
    const out = evaluate(parseFormula("SORT(A1:A3)"), gridContext(sheet));
    expect(out.kind === "range" ? out.rows.map((r) => r[0]) : out).toEqual(["ก", "ข", "ค"]);
  });

  it("SORT orders numbers as numbers, and before text", () => {
    // As text, "10" sorts before "9". Every earlier SORT test used single digits, where the two agree.
    const sheet = [[100], ["ก"], [9], [10]];
    const out = evaluate(parseFormula("SORT(A1:A4)"), gridContext(sheet));
    expect(out.kind === "range" ? out.rows.map((r) => r[0]) : out).toEqual([9, 10, 100, "ก"]);
  });

  it("XLOOKUP's next-larger match takes the first of two equal candidates", () => {
    const grid = [[10, "a"], [20, "b"], [20, "c"], [30, "d"]];
    expect(calc("XLOOKUP(15,A1:A4,B1:B4,,1)", grid)).toBe("b");
  });

  it("DATEDIF MD is 0 on the anniversary day, including across a new year", () => {
    expect(calc('DATEDIF("2023-11-15","2024-01-15","MD")')).toBe(0);
  });

  it("a date whose month does not exist is not a date, even when its day would survive the roll-over", () => {
    // 2024-13-05 rolls over to 5 January 2025: the day still reads 5, only the month is wrong.
    expect(isError(calc('YEAR("2024-13-05")'))).toBe(true);
  });

  it("a one-cell range in arithmetic stays a single value", () => {
    const result = evaluate(parseFormula("A1:A1+1"), gridContext([[4]]));
    expect(result).toEqual({ kind: "scalar", value: 5 });
  });

  it("column letters roll over at Z, not two short of it", () => {
    expect(colToLetters(25)).toBe("Z");
    expect(colToLetters(26)).toBe("AA");
    expect(colToLetters(51)).toBe("AZ");
  });
});
