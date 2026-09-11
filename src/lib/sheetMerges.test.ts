import { describe, expect, it } from "vitest";
import { parseCellRef } from "./formulaEngine/address";
import { mergeLookup, MergeRange, parseMergeRef, shiftMerges } from "./sheetMerges";

const titleBand: MergeRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 3 };
const block: MergeRange = { startRow: 4, startCol: 1, endRow: 5, endCol: 2 };

describe("mergeLookup", () => {
  it("renders only the top-left cell and covers the rest", () => {
    const { anchors, covered } = mergeLookup([titleBand]);
    expect(anchors.get("0,0")).toEqual(titleBand);
    expect(covered.has("0,0")).toBe(false);
    expect([...covered].sort()).toEqual(["0,1", "0,2", "0,3"]);
  });

  it("covers every cell of a block merge, both directions", () => {
    const { covered } = mergeLookup([block]);
    expect(covered.size).toBe(3);
    expect(covered.has("5,2")).toBe(true);
  });

  it("is empty for a sheet with no merges", () => {
    expect(mergeLookup(undefined).anchors.size).toBe(0);
    expect(mergeLookup([]).covered.size).toBe(0);
  });
});

describe("shiftMerges on insert", () => {
  it("slides a merge that sits entirely after the inserted row", () => {
    expect(shiftMerges([block], "row", 0, 1)).toEqual([{ ...block, startRow: 5, endRow: 6 }]);
  });

  it("grows a merge the inserted row lands inside", () => {
    expect(shiftMerges([block], "row", 5, 1)).toEqual([{ ...block, startRow: 4, endRow: 6 }]);
  });

  it("leaves a merge above the insertion alone", () => {
    expect(shiftMerges([titleBand], "row", 3, 1)).toEqual([titleBand]);
  });

  it("does the same across columns", () => {
    expect(shiftMerges([titleBand], "col", 0, 1)).toEqual([{ ...titleBand, startCol: 1, endCol: 4 }]);
    expect(shiftMerges([titleBand], "col", 2, 1)).toEqual([{ ...titleBand, startCol: 0, endCol: 4 }]);
  });
});

describe("shiftMerges on delete", () => {
  it("slides a merge that sits after the deleted row back", () => {
    expect(shiftMerges([block], "row", 0, -1)).toEqual([{ ...block, startRow: 3, endRow: 4 }]);
  });

  it("shrinks a merge the deleted row was inside", () => {
    expect(shiftMerges([block], "row", 5, -1)).toEqual([{ ...block, startRow: 4, endRow: 4, startCol: 1, endCol: 2 }]);
  });

  it("drops a merge once it covers a single cell", () => {
    const pair: MergeRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 1 };
    // Losing a column leaves one cell, which isn't a merge — keeping it would put colSpan={1}
    // on a cell forever and quietly pile up.
    expect(shiftMerges([pair], "col", 1, -1)).toBeUndefined();
  });

  it("keeps unrelated merges while dropping the collapsed one", () => {
    const pair: MergeRange = { startRow: 9, startCol: 0, endRow: 9, endCol: 1 };
    expect(shiftMerges([pair, block], "col", 1, -1)).toEqual([{ ...block, startCol: 1, endCol: 1, endRow: 5 }]);
  });

  it("passes through when there's nothing to shift", () => {
    expect(shiftMerges(undefined, "row", 0, 1)).toBeUndefined();
    expect(shiftMerges([], "row", 0, -1)).toEqual([]);
  });
});

describe("parseMergeRef", () => {
  it("reads an Excel merge reference", () => {
    expect(parseMergeRef("A1:D1", parseCellRef)).toEqual(titleBand);
  });

  it("normalizes a reference written back to front", () => {
    expect(parseMergeRef("D1:A1", parseCellRef)).toEqual(titleBand);
  });

  it("refuses anything that isn't a two-ended reference", () => {
    expect(parseMergeRef("A1", parseCellRef)).toBeNull();
    expect(parseMergeRef("nonsense:???", parseCellRef)).toBeNull();
  });
});
