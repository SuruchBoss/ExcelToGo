import { describe, expect, it } from "vitest";
import { blockAround, jumpToEdge, pageStep, rowEnd, usedBounds } from "./gridNavigation";

/**
 * Grids are drawn as text so the case under test is visible in the test.
 * `.` is empty, anything else is a filled cell.
 */
function grid(rows: string[]) {
  const cells = rows.map((r) => r.split(""));
  return {
    bounds: { rows: cells.length, cols: Math.max(...cells.map((r) => r.length)) },
    isEmpty: (r: number, c: number) => (cells[r]?.[c] ?? ".") === ".",
  };
}

describe("Ctrl+arrow", () => {
  const { bounds, isEmpty } = grid([
    "xx.x",
    "xx..",
    "xx.x",
    "....",
    "x...",
  ]);

  it("runs to the last filled cell before a gap", () => {
    expect(jumpToEdge(isEmpty, bounds, { row: 0, col: 0 }, 1, 0)).toEqual({ row: 2, col: 0 });
  });

  it("runs down a column from inside the block, not to the sheet edge", () => {
    expect(jumpToEdge(isEmpty, bounds, { row: 1, col: 1 }, 1, 0)).toEqual({ row: 2, col: 1 });
  });

  it("skips a gap and lands on the next filled cell", () => {
    expect(jumpToEdge(isEmpty, bounds, { row: 2, col: 0 }, 1, 0)).toEqual({ row: 4, col: 0 });
  });

  it("lands on the sheet edge when nothing is left in that direction", () => {
    expect(jumpToEdge(isEmpty, bounds, { row: 4, col: 0 }, 1, 0)).toEqual({ row: 4, col: 0 });
    expect(jumpToEdge(isEmpty, bounds, { row: 2, col: 1 }, 1, 0)).toEqual({ row: 4, col: 1 });
  });

  it("runs to the end of a block that starts directly below an empty cell", () => {
    // The rule reads the neighbour, not the cell you are on: row 0 is empty, row 1 is not, so this
    // is the "run to the end" branch and it lands on the bottom of the block.
    const g = grid([".", "x", "x", "."]);
    expect(jumpToEdge(g.isEmpty, g.bounds, { row: 0, col: 0 }, 1, 0)).toEqual({ row: 2, col: 0 });
  });

  it("lands on the first filled cell when a gap comes first", () => {
    // Two empty rows, then the block: the neighbour is empty, so this is the "skip the gap" branch
    // and it stops at the top of the block rather than running through it.
    const g = grid([".", ".", "x", "x", "."]);
    expect(jumpToEdge(g.isEmpty, g.bounds, { row: 0, col: 0 }, 1, 0)).toEqual({ row: 2, col: 0 });
  });

  it("stays put at the edge of the sheet", () => {
    expect(jumpToEdge(isEmpty, bounds, { row: 0, col: 0 }, -1, 0)).toEqual({ row: 0, col: 0 });
    expect(jumpToEdge(isEmpty, bounds, { row: 0, col: 0 }, 0, -1)).toEqual({ row: 0, col: 0 });
  });

  it("moves sideways by the same rules", () => {
    expect(jumpToEdge(isEmpty, bounds, { row: 0, col: 0 }, 0, 1)).toEqual({ row: 0, col: 1 });
    expect(jumpToEdge(isEmpty, bounds, { row: 0, col: 1 }, 0, 1)).toEqual({ row: 0, col: 3 });
  });
});

describe("Ctrl+End", () => {
  it("finds the corner of the used rectangle, even when that corner is empty", () => {
    const { bounds, isEmpty } = grid([
      "x...",
      "...x",
      "..x.",
      "....",
    ]);
    // Row 2 is the lowest with content, column 3 the rightmost — and (2,3) itself is empty.
    expect(usedBounds(isEmpty, bounds)).toEqual({ row: 2, col: 3 });
  });

  it("is A1 on an empty sheet", () => {
    const { bounds, isEmpty } = grid(["...", "..."]);
    expect(usedBounds(isEmpty, bounds)).toEqual({ row: 0, col: 0 });
  });
});

describe("End", () => {
  it("finds the last filled cell in the row", () => {
    const { bounds, isEmpty } = grid(["x.x.", "x..."]);
    expect(rowEnd(isEmpty, bounds, 0)).toBe(2);
    expect(rowEnd(isEmpty, bounds, 1)).toBe(0);
  });
});

describe("Ctrl+A", () => {
  const { bounds, isEmpty } = grid([
    "xxx..",
    "xxx..",
    "xxx..",
    ".....",
    "x....",
  ]);

  it("selects the table around the cursor, not the whole sheet", () => {
    expect(blockAround(isEmpty, bounds, { row: 1, col: 1 })).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 2,
      endCol: 2,
    });
  });

  it("does not jump the blank row to the island below", () => {
    const block = blockAround(isEmpty, bounds, { row: 0, col: 0 });
    expect(block.endRow).toBe(2);
  });

  it("keeps a table whole across a hole in the middle of it", () => {
    // A blank cell inside a table is still that table; a flood fill would stop at it.
    const g = grid(["xxx", "x.x", "xxx"]);
    expect(blockAround(g.isEmpty, g.bounds, { row: 0, col: 0 })).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 2,
      endCol: 2,
    });
  });

  it("is just the cell when it stands alone", () => {
    expect(blockAround(isEmpty, bounds, { row: 3, col: 3 })).toEqual({
      startRow: 3,
      startCol: 3,
      endRow: 3,
      endCol: 3,
    });
  });
});

describe("Page up and down", () => {
  // Twenty rows, 32px each, on a 320px viewport: ten rows to a page.
  const offsets = Array.from({ length: 21 }, (_, i) => i * 32);

  it("moves about a screenful down", () => {
    expect(pageStep(offsets, 0, 320, 1)).toBe(10);
  });

  it("moves about a screenful up", () => {
    expect(pageStep(offsets, 15, 320, -1)).toBe(5);
  });

  it("stops at the ends rather than running off", () => {
    expect(pageStep(offsets, 18, 320, 1)).toBe(19);
    expect(pageStep(offsets, 2, 320, -1)).toBe(0);
  });

  it("still moves one row on a viewport shorter than a row", () => {
    expect(pageStep(offsets, 5, 4, 1)).toBe(6);
    expect(pageStep(offsets, 5, 4, -1)).toBe(4);
  });

  it("counts pixels, not rows, when the rows are different heights", () => {
    // One 300px row then 32px rows: a 320px page clears the tall row and one short one.
    const mixed = [0, 300, 332, 364, 396, 428];
    expect(pageStep(mixed, 0, 320, 1)).toBe(1);
    expect(pageStep(mixed, 1, 320, 1)).toBe(4);
  });
});
