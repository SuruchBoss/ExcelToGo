import { describe, expect, it } from "vitest";
import { FormulaValue } from "./formulaEngine/types";
import { ERR_DIV0 } from "./formulaEngine/types";
import { aggregate, buildPivot, compareLabels, keyOf, PivotLabels } from "./pivot";

const labels: PivotLabels = {
  blank: "(blank)",
  grandTotal: "Total",
  valueHeading: (agg, field) => `${agg} of ${field}`,
};

/** region | product | qty | price */
const SALES: FormulaValue[][] = [
  ["Region", "Product", "Qty", "Price"],
  ["North", "Coffee", 3, 45],
  ["North", "Tea", 2, 30],
  ["South", "Coffee", 5, 45],
  ["South", "Tea", 1, 30],
  ["North", "Coffee", 4, 45],
];

describe("keyOf", () => {
  it("turns any cell into a group label", () => {
    expect(keyOf("North")).toBe("North");
    expect(keyOf(42)).toBe("42");
    expect(keyOf(true)).toBe("TRUE");
    expect(keyOf(null)).toBe("");
    expect(keyOf("")).toBe("");
    expect(keyOf(ERR_DIV0)).toBe("#DIV/0!");
  });
});

describe("aggregate", () => {
  it("sums, averages, mins and maxes only the numbers", () => {
    const vals: FormulaValue[] = [1, "x", 3, null, 5];
    expect(aggregate(vals, "sum")).toBe(9);
    expect(aggregate(vals, "average")).toBe(3);
    expect(aggregate(vals, "min")).toBe(1);
    expect(aggregate(vals, "max")).toBe(5);
  });

  it("counts every entry, text included — that is what makes count useful", () => {
    expect(aggregate(["a", "b", 3], "count")).toBe(3);
  });

  // "no numbers here" and "they add up to nothing" are different answers.
  it("gives null rather than 0 for a group with no numbers", () => {
    expect(aggregate(["a", "b"], "sum")).toBeNull();
    expect(aggregate([], "sum")).toBeNull();
    expect(aggregate([], "count")).toBeNull();
  });

  it("trims float noise off an average", () => {
    expect(aggregate([0.1, 0.2], "average")).toBe(0.15);
  });
});

describe("compareLabels", () => {
  it("sorts numeric labels numerically, not as text", () => {
    expect(["10", "9", "100"].sort(compareLabels)).toEqual(["9", "10", "100"]);
  });

  it("sorts Thai by locale rather than code point", () => {
    const sorted = ["ขนมปัง", "กาแฟ", "นม"].sort(compareLabels);
    expect(sorted[0]).toBe("กาแฟ");
  });

  it("sinks blanks to the bottom", () => {
    expect(["b", "", "a"].sort(compareLabels)).toEqual(["a", "b", ""]);
  });
});

describe("buildPivot", () => {
  it("groups by one row field and sums a value", () => {
    const p = buildPivot(SALES, { rowFields: [0], colField: null, valueField: 2, agg: "sum" }, labels);
    expect(p.header).toEqual(["Region", "sum of Qty", "Total"]);
    expect(p.rows).toEqual([
      ["North", 9, 9],
      ["South", 6, 6],
    ]);
    expect(p.totalRow).toEqual(["Total", 15, 15]);
  });

  it("fans a column field out across the top", () => {
    const p = buildPivot(SALES, { rowFields: [0], colField: 1, valueField: 2, agg: "sum" }, labels);
    expect(p.header).toEqual(["Region", "Coffee", "Tea", "Total"]);
    expect(p.rows).toEqual([
      ["North", 7, 2, 9],
      ["South", 5, 1, 6],
    ]);
    expect(p.totalRow).toEqual(["Total", 12, 3, 15]);
  });

  it("gives each row field its own column", () => {
    const p = buildPivot(SALES, { rowFields: [0, 1], colField: null, valueField: 2, agg: "sum" }, labels);
    expect(p.header).toEqual(["Region", "Product", "sum of Qty", "Total"]);
    expect(p.rows).toEqual([
      ["North", "Coffee", 7, 7],
      ["North", "Tea", 2, 2],
      ["South", "Coffee", 5, 5],
      ["South", "Tea", 1, 1],
    ]);
  });

  // Summing a row of averages gives a number that is wrong in a way nobody would question.
  it("re-aggregates the raw values for totals instead of totalling the cells", () => {
    const p = buildPivot(SALES, { rowFields: [0], colField: null, valueField: 3, agg: "average" }, labels);
    // North prices are 45, 30, 45 -> 40; South 45, 30 -> 37.5; all five -> 39.
    expect(p.rows).toEqual([
      ["North", 40, 40],
      ["South", 37.5, 37.5],
    ]);
    expect(p.totalRow).toEqual(["Total", 39, 39]);
  });

  it("leaves a null where a combination has no rows", () => {
    const sparse: FormulaValue[][] = [
      ["R", "C", "V"],
      ["a", "x", 1],
      ["b", "y", 2],
    ];
    const p = buildPivot(sparse, { rowFields: [0], colField: 1, valueField: 2, agg: "sum" }, labels);
    expect(p.header).toEqual(["R", "x", "y", "Total"]);
    expect(p.rows).toEqual([
      ["a", 1, null, 1],
      ["b", null, 2, 2],
    ]);
  });

  it("labels a blank group rather than showing an empty cell", () => {
    const withBlank: FormulaValue[][] = [
      ["R", "V"],
      ["a", 1],
      [null, 2],
    ];
    const p = buildPivot(withBlank, { rowFields: [0], colField: null, valueField: 1, agg: "sum" }, labels);
    expect(p.rows).toEqual([
      ["a", 1, 1],
      ["(blank)", 2, 2],
    ]);
  });

  it("skips trailing rows that are blank in every row field", () => {
    const trailing: FormulaValue[][] = [
      ["R", "V"],
      ["a", 1],
      [null, null],
      [null, null],
    ];
    const p = buildPivot(trailing, { rowFields: [0], colField: null, valueField: 1, agg: "sum" }, labels);
    expect(p.rows).toHaveLength(1);
  });

  it("returns nothing to write for an empty or header-only range", () => {
    expect(buildPivot([], { rowFields: [0], colField: null, valueField: 1, agg: "sum" }, labels)).toEqual({
      header: [],
      rows: [],
      totalRow: null,
    });
    const headerOnly = buildPivot([["R", "V"]], { rowFields: [0], colField: null, valueField: 1, agg: "sum" }, labels);
    expect(headerOnly.rows).toEqual([]);
  });

  it("falls back to a positional name for an unnamed column", () => {
    const noHeader: FormulaValue[][] = [
      ["R", null],
      ["a", 1],
    ];
    const p = buildPivot(noHeader, { rowFields: [0], colField: null, valueField: 1, agg: "sum" }, labels);
    expect(p.header[1]).toBe("sum of #2");
  });

  it("counts rows when the value column is text", () => {
    const p = buildPivot(SALES, { rowFields: [0], colField: null, valueField: 1, agg: "count" }, labels);
    expect(p.rows).toEqual([
      ["North", 3, 3],
      ["South", 2, 2],
    ]);
  });

  it("orders groups with the same first key by the second", () => {
    const p = buildPivot(SALES, { rowFields: [0, 1], colField: null, valueField: 2, agg: "sum" }, labels);
    expect(p.rows.map((r) => `${r[0]}/${r[1]}`)).toEqual([
      "North/Coffee",
      "North/Tea",
      "South/Coffee",
      "South/Tea",
    ]);
  });

  it("pads the total row so it lines up under several row fields", () => {
    const p = buildPivot(SALES, { rowFields: [0, 1], colField: null, valueField: 2, agg: "sum" }, labels);
    expect(p.totalRow!).toHaveLength(p.header.length);
    expect(p.totalRow![0]).toBe("Total");
    expect(p.totalRow![1]).toBe("");
  });
});
