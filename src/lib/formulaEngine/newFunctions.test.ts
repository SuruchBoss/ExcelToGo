import { describe, expect, it } from "vitest";
import { calc } from "./testUtils";

/**
 * The functions the assistant kept reaching for.
 *
 * Every one is here because a real question, put to the real model with a real key, came back
 * using it — and landed in the cell as `#NAME?`. The edge cases matter more than the happy paths:
 * a missing function says #NAME? and stops; a half-built one says a number and doesn't.
 */
const abc = [["a"], ["b"], ["c"]];
const aGapC = [["a"], [""], ["c"]];

describe("TEXTJOIN", () => {
  it("joins a range with a delimiter", () => {
    expect(calc('TEXTJOIN(", ", TRUE, A1:A3)', abc)).toBe("a, b, c");
  });

  it("skips blanks when told to", () => {
    expect(calc('TEXTJOIN("-", TRUE, A1:A3)', aGapC)).toBe("a-c");
  });

  it("keeps blanks when told not to", () => {
    expect(calc('TEXTJOIN("-", FALSE, A1:A3)', aGapC)).toBe("a--c");
  });

  it("takes several ranges and loose values", () => {
    expect(calc('TEXTJOIN("|", TRUE, A1:A2, "x")', abc)).toBe("a|b|x");
  });
});

describe("FIND and SEARCH", () => {
  it("answers a 1-based position", () => {
    expect(calc('FIND(" ", "one two")')).toBe(4);
  });

  it("gives #VALUE! rather than 0 when the text is absent", () => {
    expect(String(calc('FIND("z", "abc")'))).toBe("#VALUE!");
  });

  it("starts where it is told to", () => {
    expect(calc('FIND("a", "banana", 4)')).toBe(4);
  });

  it("minds case; SEARCH does not", () => {
    expect(String(calc('FIND("A", "abc")'))).toBe("#VALUE!");
    expect(calc('SEARCH("A", "abc")')).toBe(1);
  });

  it("is what makes the assistant's first-word formula work", () => {
    // Character for character the formula the model returned for "the first word of the text in A2".
    expect(calc('IFERROR(LEFT(A1,FIND(" ",A1)-1),A1)', [["hello there"]])).toBe("hello");
    expect(calc('IFERROR(LEFT(A1,FIND(" ",A1)-1),A1)', [["single"]])).toBe("single");
  });
});

describe("SUBSTITUTE", () => {
  it("replaces every occurrence", () => {
    expect(calc('SUBSTITUTE("a-b-c", "-", "+")')).toBe("a+b+c");
  });

  it("replaces only the one asked for", () => {
    expect(calc('SUBSTITUTE("a-b-c", "-", "+", 2)')).toBe("a-b+c");
  });

  it("leaves the text alone when that occurrence does not exist", () => {
    expect(calc('SUBSTITUTE("a-b", "-", "+", 5)')).toBe("a-b");
  });
});

describe("CHAR and CODE", () => {
  it("makes the line break people actually want", () => {
    expect(calc("CHAR(10)")).toBe("\n");
  });

  it("refuses a code outside Excel's range", () => {
    expect(String(calc("CHAR(0)"))).toBe("#VALUE!");
    expect(String(calc("CHAR(256)"))).toBe("#VALUE!");
  });

  it("reads a code back", () => {
    expect(calc('CODE("A")')).toBe(65);
    expect(String(calc('CODE("")'))).toBe("#VALUE!");
  });
});

describe("CEILING and FLOOR", () => {
  it("rounds up and down to a multiple", () => {
    expect(calc("CEILING(123, 100)")).toBe(200);
    expect(calc("FLOOR(123, 100)")).toBe(100);
  });

  it("leaves an exact multiple alone", () => {
    expect(calc("CEILING(200, 100)")).toBe(200);
  });

  it("does not drift on a fractional step", () => {
    // Without the rounding pass this is 4.800000000000001, which a cell would show in full.
    expect(calc("CEILING(4.71, 0.1)")).toBe(4.8);
  });

  it("answers 0 for a step of 0, and #NUM! for mismatched signs", () => {
    expect(calc("CEILING(5, 0)")).toBe(0);
    expect(String(calc("CEILING(5, -1)"))).toBe("#NUM!");
  });

  it("rounds a negative number away from zero the way Excel does", () => {
    expect(calc("CEILING(-123, -100)")).toBe(-200);
  });
});

describe("SUMPRODUCT", () => {
  const qtyPrice = [
    [1, 10],
    [2, 10],
    [3, 10],
  ];

  it("multiplies element by element and adds it up", () => {
    expect(calc("SUMPRODUCT(A1:A3, B1:B3)", qtyPrice)).toBe(60);
  });

  it("treats text and blanks as zero", () => {
    expect(calc("SUMPRODUCT(A1:A3, B1:B3)", [[1, 10], ["x", 10], [3, 10]])).toBe(40);
  });

  it("refuses ranges of different shapes", () => {
    expect(String(calc("SUMPRODUCT(A1:A3, B1:B2)", qtyPrice))).toBe("#VALUE!");
  });
});

describe("RANK", () => {
  const scores = [[10], [30], [20], [30]];

  it("counts down by default, highest first", () => {
    // 30, 30, 20, 10 — so 20 is third, not second: the tied pair occupies both of the places
    // above it. Writing 2 here first was my own mistake, and it is the whole reason this case
    // is spelled out rather than assumed.
    expect(calc("RANK(A3, A1:A4)", scores)).toBe(3);
    expect(calc("RANK(A1, A1:A4)", scores)).toBe(4);
  });

  it("counts up when asked", () => {
    expect(calc("RANK(A1, A1:A4, 1)", scores)).toBe(1);
  });

  it("gives tied values the same place, and skips the one they used up", () => {
    expect(calc("RANK(A2, A1:A4)", scores)).toBe(1);
    expect(calc("RANK(A4, A1:A4)", scores)).toBe(1);
    // No second place at all — the next value down takes third.
    expect(calc("RANK(A3, A1:A4)", scores)).toBe(3);
  });

  it("answers to the modern spelling too", () => {
    expect(calc("RANK.EQ(A3, A1:A4)", scores)).toBe(3);
  });

  it("gives #N/A for a value that is not in the range", () => {
    expect(String(calc("RANK(99, A1:A4)", scores))).toBe("#N/A");
  });
});
