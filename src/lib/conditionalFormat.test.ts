import { describe, it, expect } from "vitest";
import {
  CfRule,
  evaluateConditionalFormats,
  mixColors,
  shiftConditionalRules,
} from "./conditionalFormat";
import { FormulaValue } from "./formulaEngine/types";
import { cloneSheet, createEmptySheet, deleteRow, insertColumnBefore, insertRowBefore, SheetModel } from "./sheet";

function grid(rows: FormulaValue[][]): FormulaValue[][] {
  return rows;
}

const fullRange = (rows: number, cols: number) => ({ startRow: 0, startCol: 0, endRow: rows - 1, endCol: cols - 1 });

function rule(partial: Partial<CfRule> & Pick<CfRule, "test">): CfRule {
  return { id: "r1", range: fullRange(4, 1), style: { fill: "#fee2e2" }, ...partial };
}

describe("comparison rules", () => {
  const values = grid([[10], [50], [100], ["ไม่ใช่ตัวเลข"]]);

  it("highlights only cells over the threshold", () => {
    const out = evaluateConditionalFormats([rule({ test: { kind: "compare", op: "gt", value: 40 } })], values, 4, 1);
    expect(out[0][0]).toBeUndefined();
    expect(out[1][0]?.fill).toBe("#fee2e2");
    expect(out[2][0]?.fill).toBe("#fee2e2");
  });

  it("leaves text cells alone for numeric comparisons", () => {
    const out = evaluateConditionalFormats([rule({ test: { kind: "compare", op: "gt", value: 0 } })], values, 4, 1);
    expect(out[3][0]).toBeUndefined();
  });

  it("treats 'between' bounds given in either order the same way", () => {
    const ascending = evaluateConditionalFormats([rule({ test: { kind: "compare", op: "between", value: 20, value2: 60 } })], values, 4, 1);
    const descending = evaluateConditionalFormats([rule({ test: { kind: "compare", op: "between", value: 60, value2: 20 } })], values, 4, 1);
    expect(ascending.map((r) => r[0]?.fill)).toEqual(descending.map((r) => r[0]?.fill));
    expect(ascending[1][0]?.fill).toBe("#fee2e2");
    expect(ascending[0][0]).toBeUndefined();
  });

  it("includes the boundary for gte but not gt", () => {
    const gte = evaluateConditionalFormats([rule({ test: { kind: "compare", op: "gte", value: 50 } })], values, 4, 1);
    const gt = evaluateConditionalFormats([rule({ test: { kind: "compare", op: "gt", value: 50 } })], values, 4, 1);
    expect(gte[1][0]?.fill).toBe("#fee2e2");
    expect(gt[1][0]).toBeUndefined();
  });
});

describe("text rules", () => {
  const values = grid([["กรุงเทพ"], ["เชียงใหม่"], [42], [null]]);

  it("matches a substring regardless of case", () => {
    const out = evaluateConditionalFormats(
      [rule({ test: { kind: "textContains", text: "ENGINE" }, range: fullRange(2, 1) })],
      grid([["Search Engine"], ["other"]]),
      2,
      1
    );
    expect(out[0][0]?.fill).toBe("#fee2e2");
    expect(out[1][0]).toBeUndefined();
  });

  it("matches Thai text", () => {
    const out = evaluateConditionalFormats([rule({ test: { kind: "textContains", text: "เชียง" } })], values, 4, 1);
    expect(out[1][0]?.fill).toBe("#fee2e2");
    expect(out[0][0]).toBeUndefined();
  });

  it("an empty search term matches nothing, rather than every cell", () => {
    const out = evaluateConditionalFormats([rule({ test: { kind: "textContains", text: "" } })], values, 4, 1);
    expect(out.every((r) => r[0] === undefined)).toBe(true);
  });
});

describe("top/bottom rules", () => {
  it("highlights the top N by value, not by position", () => {
    const values = grid([[5], [90], [30], [70]]);
    const out = evaluateConditionalFormats([rule({ test: { kind: "rank", bottom: false, count: 2 } })], values, 4, 1);
    expect(out[1][0]?.fill).toBe("#fee2e2");
    expect(out[3][0]?.fill).toBe("#fee2e2");
    expect(out[0][0]).toBeUndefined();
    expect(out[2][0]).toBeUndefined();
  });

  it("includes every tied value rather than cutting the tie arbitrarily", () => {
    const values = grid([[10], [10], [10], [1]]);
    const out = evaluateConditionalFormats([rule({ test: { kind: "rank", bottom: false, count: 2 } })], values, 4, 1);
    expect([out[0][0], out[1][0], out[2][0]].every((v) => v?.fill === "#fee2e2")).toBe(true);
    expect(out[3][0]).toBeUndefined();
  });

  it("asking for more than the range holds highlights everything numeric", () => {
    const values = grid([[3], [1], ["x"], [2]]);
    const out = evaluateConditionalFormats([rule({ test: { kind: "rank", bottom: true, count: 99 } })], values, 4, 1);
    expect([out[0][0], out[1][0], out[3][0]].every((v) => v?.fill === "#fee2e2")).toBe(true);
    expect(out[2][0]).toBeUndefined();
  });

  it("bottom N picks the smallest values", () => {
    const values = grid([[5], [90], [30], [70]]);
    const out = evaluateConditionalFormats([rule({ test: { kind: "rank", bottom: true, count: 1 } })], values, 4, 1);
    expect(out[0][0]?.fill).toBe("#fee2e2");
    expect(out[1][0]).toBeUndefined();
  });
});

describe("colour scales", () => {
  it("puts the extremes at the endpoint colours", () => {
    const values = grid([[0], [50], [100]]);
    const out = evaluateConditionalFormats(
      [rule({ test: { kind: "colorScale", min: "#ff0000", max: "#00ff00" }, range: fullRange(3, 1) })],
      values,
      3,
      1
    );
    expect(out[0][0]?.fill).toBe("#ff0000");
    expect(out[2][0]?.fill).toBe("#00ff00");
    expect(out[1][0]?.fill).toBe("#808000");
  });

  it("uses the middle colour at the midpoint of a three-stop scale", () => {
    const values = grid([[0], [5], [10]]);
    const out = evaluateConditionalFormats(
      [rule({ test: { kind: "colorScale", min: "#ff0000", mid: "#0000ff", max: "#00ff00" }, range: fullRange(3, 1) })],
      values,
      3,
      1
    );
    expect(out[1][0]?.fill).toBe("#0000ff");
  });

  it("colours a range of identical values without dividing by zero", () => {
    const values = grid([[7], [7], [7]]);
    const out = evaluateConditionalFormats(
      [rule({ test: { kind: "colorScale", min: "#ff0000", max: "#00ff00" }, range: fullRange(3, 1) })],
      values,
      3,
      1
    );
    expect(out.every((r) => r[0]?.fill === "#00ff00")).toBe(true);
  });
});

describe("data bars", () => {
  it("scales bar length between the smallest and largest value", () => {
    const values = grid([[0], [5], [10]]);
    const out = evaluateConditionalFormats(
      [rule({ test: { kind: "dataBar", color: "#6ee7b7" }, range: fullRange(3, 1) })],
      values,
      3,
      1
    );
    expect(out[0][0]?.bar?.fraction).toBe(0);
    expect(out[1][0]?.bar?.fraction).toBeCloseTo(0.5);
    expect(out[2][0]?.bar?.fraction).toBe(1);
  });

  it("measures from zero when every value is positive, so bars stay comparable", () => {
    const values = grid([[80], [100]]);
    const out = evaluateConditionalFormats(
      [rule({ test: { kind: "dataBar", color: "#6ee7b7" }, range: fullRange(2, 1) })],
      values,
      2,
      1
    );
    expect(out[0][0]?.bar?.fraction).toBeCloseTo(0.8);
  });

  it("puts negatives at the bottom of the scale rather than off it", () => {
    const values = grid([[-10], [0], [10]]);
    const out = evaluateConditionalFormats(
      [rule({ test: { kind: "dataBar", color: "#6ee7b7" }, range: fullRange(3, 1) })],
      values,
      3,
      1
    );
    expect(out[0][0]?.bar?.fraction).toBe(0);
    expect(out[1][0]?.bar?.fraction).toBeCloseTo(0.5);
  });
});

describe("several rules at once", () => {
  const values = grid([[10], [100]]);

  it("lets a later rule override an earlier one property by property", () => {
    const rules: CfRule[] = [
      { id: "a", range: fullRange(2, 1), test: { kind: "compare", op: "gt", value: 0 }, style: { fill: "#eeeeee", bold: true } },
      { id: "b", range: fullRange(2, 1), test: { kind: "compare", op: "gt", value: 50 }, style: { fill: "#fee2e2" } },
    ];
    const out = evaluateConditionalFormats(rules, values, 2, 1);
    expect(out[0][0]).toEqual({ fill: "#eeeeee", color: undefined, bold: true, bar: undefined });
    // The second rule repaints the fill but leaves the first rule's bold in place.
    expect(out[1][0]?.fill).toBe("#fee2e2");
    expect(out[1][0]?.bold).toBe(true);
  });

  it("keeps rules to their own range", () => {
    const rules: CfRule[] = [
      { id: "a", range: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 }, test: { kind: "compare", op: "gt", value: 0 }, style: { fill: "#fee2e2" } },
    ];
    const out = evaluateConditionalFormats(rules, values, 2, 1);
    expect(out[0][0]?.fill).toBe("#fee2e2");
    expect(out[1][0]).toBeUndefined();
  });

  it("ignores a range that runs past the sheet instead of crashing", () => {
    const rules: CfRule[] = [
      { id: "a", range: { startRow: 0, startCol: 0, endRow: 99, endCol: 99 }, test: { kind: "compare", op: "gt", value: 0 }, style: { fill: "#fee2e2" } },
    ];
    const out = evaluateConditionalFormats(rules, values, 2, 1);
    expect(out.length).toBe(2);
    expect(out[1][0]?.fill).toBe("#fee2e2");
  });
});

describe("shifting rules when rows and columns move", () => {
  const base: CfRule[] = [{ id: "a", range: { startRow: 2, startCol: 0, endRow: 5, endCol: 3 }, test: { kind: "compare", op: "gt", value: 1 } }];

  it("slides a range that sits below an inserted row", () => {
    const out = shiftConditionalRules(base, "row", 0, 1)!;
    expect(out[0].range.startRow).toBe(3);
    expect(out[0].range.endRow).toBe(6);
  });

  it("grows a range the inserted row falls inside", () => {
    const out = shiftConditionalRules(base, "row", 3, 1)!;
    expect(out[0].range.startRow).toBe(2);
    expect(out[0].range.endRow).toBe(6);
  });

  it("shrinks a range when a row inside it is deleted", () => {
    const out = shiftConditionalRules(base, "row", 3, -1)!;
    expect(out[0].range.startRow).toBe(2);
    expect(out[0].range.endRow).toBe(4);
  });

  it("keeps a rule that shrinks to a single cell — unlike a merge, that is still a real rule", () => {
    const single: CfRule[] = [{ id: "a", range: { startRow: 1, startCol: 1, endRow: 2, endCol: 1 }, test: { kind: "compare", op: "gt", value: 1 } }];
    const out = shiftConditionalRules(single, "row", 2, -1)!;
    expect(out).toHaveLength(1);
    expect(out[0].range).toEqual({ startRow: 1, startCol: 1, endRow: 1, endCol: 1 });
  });

  it("drops a rule whose only row was deleted", () => {
    const single: CfRule[] = [{ id: "a", range: { startRow: 3, startCol: 0, endRow: 3, endCol: 2 }, test: { kind: "compare", op: "gt", value: 1 } }];
    expect(shiftConditionalRules(single, "row", 3, -1)).toBeUndefined();
  });

  it("shifts columns on the same rules", () => {
    const out = shiftConditionalRules(base, "col", 0, 1)!;
    expect(out[0].range.startCol).toBe(1);
    expect(out[0].range.endCol).toBe(4);
  });
});

describe("colour mixing", () => {
  it("returns the endpoints at 0 and 1", () => {
    expect(mixColors("#ff0000", "#0000ff", 0)).toBe("#ff0000");
    expect(mixColors("#ff0000", "#0000ff", 1)).toBe("#0000ff");
  });

  it("clamps out-of-range positions", () => {
    expect(mixColors("#ff0000", "#0000ff", -5)).toBe("#ff0000");
    expect(mixColors("#ff0000", "#0000ff", 5)).toBe("#0000ff");
  });

  it("falls back to the first colour when given something that isn't a hex colour", () => {
    expect(mixColors("#ff0000", "rebeccapurple", 0.5)).toBe("#ff0000");
  });
});

describe("wired into the sheet's structural edits", () => {
  function sheetWithRule(): SheetModel {
    const sheet = createEmptySheet(5, 3);
    sheet.conditionalRules = [
      { id: "a", range: { startRow: 1, startCol: 1, endRow: 3, endCol: 2 }, test: { kind: "compare", op: "gt", value: 10 }, style: { fill: "#fee2e2" } },
    ];
    return sheet;
  }

  it("moves a rule's range when a row above it is deleted", () => {
    const out = deleteRow(sheetWithRule(), 0);
    expect(out.conditionalRules?.[0].range).toEqual({ startRow: 0, startCol: 1, endRow: 2, endCol: 2 });
  });

  it("moves a rule's range when a column is inserted before it", () => {
    const out = insertColumnBefore(sheetWithRule(), 0);
    expect(out.conditionalRules?.[0].range).toEqual({ startRow: 1, startCol: 2, endRow: 3, endCol: 3 });
  });

  it("grows a rule's range around an inserted row", () => {
    const out = insertRowBefore(sheetWithRule(), 2);
    expect(out.conditionalRules?.[0].range.endRow).toBe(4);
  });

  it("cloning a sheet doesn't let one copy's rules leak into the other", () => {
    const original = sheetWithRule();
    const copy = cloneSheet(original);
    copy.conditionalRules!.push({ id: "b", range: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 }, test: { kind: "dataBar", color: "#6ee7b7" } });
    expect(original.conditionalRules).toHaveLength(1);
  });
})
