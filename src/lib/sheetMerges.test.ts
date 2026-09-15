import { describe, expect, it } from "vitest";
import { parseCellRef } from "./formulaEngine/address";
import {
  addMerge,
  expandOverMerges,
  mergeAt,
  mergeLookup,
  MergeRange,
  mergeWouldDiscard,
  parseMergeRef,
  rangeHasMerge,
  removeMerges,
  shiftMerges,
} from "./sheetMerges";

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

describe("mergeAt", () => {
  const merges = [{ startRow: 1, startCol: 1, endRow: 2, endCol: 3 }];

  it("finds the merge from its anchor", () => {
    expect(mergeAt(merges, 1, 1)).toEqual(merges[0]);
  });

  it("finds it from a covered cell too", () => {
    expect(mergeAt(merges, 2, 3)).toEqual(merges[0]);
  });

  it("gives null outside it", () => {
    expect(mergeAt(merges, 0, 1)).toBeNull();
    expect(mergeAt(merges, 1, 4)).toBeNull();
  });
});

describe("expandOverMerges", () => {
  it("leaves a range that touches nothing alone", () => {
    const r = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
    expect(expandOverMerges([], r)).toEqual(r);
  });

  it("normalises a range dragged upwards or leftwards", () => {
    expect(expandOverMerges(undefined, { startRow: 3, startCol: 5, endRow: 1, endCol: 2 })).toEqual({
      startRow: 1,
      startCol: 2,
      endRow: 3,
      endCol: 5,
    });
  });

  /** Half a merge is not a thing, so a range that clips one has to swallow it. */
  it("grows to contain a merge it only clips", () => {
    const merges = [{ startRow: 0, startCol: 0, endRow: 0, endCol: 3 }];
    expect(expandOverMerges(merges, { startRow: 0, startCol: 2, endRow: 1, endCol: 2 })).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 3,
    });
  });

  it("keeps growing when swallowing one merge brings it against another", () => {
    // The range runs down column A; the first merge runs across row 1. Neither touches the third
    // block — but the box the two of them make together does, so it has to be swallowed as well.
    const merges = [
      { startRow: 0, startCol: 0, endRow: 0, endCol: 3 },
      { startRow: 2, startCol: 2, endRow: 2, endCol: 5 },
    ];
    expect(expandOverMerges(merges, { startRow: 0, startCol: 0, endRow: 3, endCol: 0 })).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 3,
      endCol: 5,
    });
  });
});

describe("mergeWouldDiscard", () => {
  const cells = [
    ["title", "", ""],
    ["a", "b", ""],
  ];

  it("is false when only the top-left has anything in it", () => {
    expect(mergeWouldDiscard(cells, undefined, { startRow: 0, startCol: 0, endRow: 0, endCol: 2 })).toBe(false);
  });

  it("is true when a covered cell holds text", () => {
    expect(mergeWouldDiscard(cells, undefined, { startRow: 1, startCol: 0, endRow: 1, endCol: 1 })).toBe(true);
  });

  it("looks at the expanded range, not the one that was asked for", () => {
    const filled = [
      ["title", "", ""],
      ["a", "b", "c"],
    ];
    const merges = [{ startRow: 1, startCol: 1, endRow: 1, endCol: 2 }];
    // Asking to merge B2 alone is a single cell and would lose nothing — but it sits in a merge
    // that reaches C2, and C2 holds "c".
    expect(mergeWouldDiscard(filled, merges, { startRow: 1, startCol: 1, endRow: 1, endCol: 1 })).toBe(true);
  });
});

describe("addMerge", () => {
  it("refuses a single cell", () => {
    expect(addMerge(undefined, { startRow: 0, startCol: 0, endRow: 0, endCol: 0 })).toBeNull();
  });

  it("adds the merge and lists every cell but the top-left to clear", () => {
    const res = addMerge(undefined, { startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    expect(res?.merges).toEqual([{ startRow: 0, startCol: 0, endRow: 1, endCol: 1 }]);
    expect(res?.cleared).toEqual([
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });

  it("absorbs an overlapping merge rather than leaving two that overlap", () => {
    const merges = [{ startRow: 0, startCol: 0, endRow: 0, endCol: 1 }];
    const res = addMerge(merges, { startRow: 0, startCol: 1, endRow: 0, endCol: 2 });
    expect(res?.merges).toEqual([{ startRow: 0, startCol: 0, endRow: 0, endCol: 2 }]);
  });

  it("keeps merges it does not touch", () => {
    const merges = [{ startRow: 5, startCol: 0, endRow: 5, endCol: 2 }];
    const res = addMerge(merges, { startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
    expect(res?.merges).toHaveLength(2);
    expect(res?.merges).toContainEqual(merges[0]);
  });
});

describe("removeMerges", () => {
  const merges = [
    { startRow: 0, startCol: 0, endRow: 0, endCol: 3 },
    { startRow: 5, startCol: 0, endRow: 6, endCol: 1 },
  ];

  it("drops a merge the range only clips — splitting part of one splits all of it", () => {
    expect(removeMerges(merges, { startRow: 0, startCol: 2, endRow: 0, endCol: 2 })).toEqual([merges[1]]);
  });

  it("leaves untouched merges alone", () => {
    expect(removeMerges(merges, { startRow: 9, startCol: 9, endRow: 9, endCol: 9 })).toEqual(merges);
  });

  it("gives undefined rather than an empty array once the last one goes", () => {
    expect(removeMerges([merges[0]], { startRow: 0, startCol: 0, endRow: 0, endCol: 3 })).toBeUndefined();
  });
});

describe("rangeHasMerge", () => {
  const merges = [{ startRow: 2, startCol: 2, endRow: 3, endCol: 4 }];

  it("is true for a range that touches one at a corner", () => {
    expect(rangeHasMerge(merges, { startRow: 0, startCol: 0, endRow: 2, endCol: 2 })).toBe(true);
  });

  it("is false for one that misses", () => {
    expect(rangeHasMerge(merges, { startRow: 0, startCol: 0, endRow: 1, endCol: 1 })).toBe(false);
  });

  it("is false when there are no merges at all", () => {
    expect(rangeHasMerge(undefined, { startRow: 0, startCol: 0, endRow: 5, endCol: 5 })).toBe(false);
  });
});
