import { describe, expect, it } from "vitest";
import { createEmptySheet } from "./sheet";
import { TableData } from "./dataSources/types";
import {
  aggregateColumn,
  blockExtent,
  boundCellsOf,
  clearLiveBlock,
  LiveBlock,
  liveBlockCells,
  regionHasContent,
  valueOptionsFor,
  writeLiveBlock,
} from "./liveBlocks";

const table: TableData = {
  columns: [
    { key: "name", label: "name", numeric: false },
    { key: "qty", label: "qty", numeric: true },
  ],
  rows: [
    ["กาแฟ", 3],
    ["นม", 5],
  ],
  fetchedAt: "2026-01-01T00:00:00.000Z",
};

const tableBlock: LiveBlock = { id: "b1", sourceId: "s", anchorRow: 1, anchorCol: 1, kind: "table", rows: 0, cols: 0 };

describe("liveBlockCells", () => {
  it("renders a table block as a header row plus data rows", () => {
    expect(liveBlockCells(tableBlock, table)).toEqual([
      ["name", "qty"],
      ["กาแฟ", "3"],
      ["นม", "5"],
    ]);
  });

  it("renders a value block as one aggregated cell", () => {
    const block: LiveBlock = { ...tableBlock, kind: "value", column: "qty", aggregate: "sum" };
    expect(liveBlockCells(block, table)).toEqual([["8"]]);
  });

  it("keeps API text that starts with '=' from being evaluated as a formula", () => {
    const t: TableData = { ...table, rows: [["=1+1", 0]] };
    expect(liveBlockCells(tableBlock, t)[1][0]).toBe(" =1+1");
  });
});

describe("aggregateColumn", () => {
  it("supports first/sum/avg/count", () => {
    expect(aggregateColumn(table, "qty", "first")).toBe(3);
    expect(aggregateColumn(table, "qty", "sum")).toBe(8);
    expect(aggregateColumn(table, "qty", "avg")).toBe(4);
    expect(aggregateColumn(table, "name", "count")).toBe(2);
    expect(aggregateColumn(table, "missing", "sum")).toBeNull();
  });
});

describe("writeLiveBlock", () => {
  it("writes cells at the anchor and grows the sheet when needed", () => {
    const sheet = createEmptySheet(2, 2);
    const { sheet: next, rows, cols } = writeLiveBlock(sheet, tableBlock, liveBlockCells(tableBlock, table));
    expect(rows).toBe(3);
    expect(cols).toBe(2);
    expect(next.rows).toBeGreaterThanOrEqual(4);
    expect(next.cols).toBeGreaterThanOrEqual(3);
    expect(next.cells[1][1]).toBe("name");
    expect(next.cells[3][2]).toBe("5");
  });

  it("clears the previous extent when the new data is smaller", () => {
    const first = writeLiveBlock(createEmptySheet(6, 6), tableBlock, liveBlockCells(tableBlock, table));
    const grown: LiveBlock = { ...tableBlock, rows: first.rows, cols: first.cols };
    const smaller: TableData = { ...table, rows: [["กาแฟ", 3]] };
    const second = writeLiveBlock(first.sheet, grown, liveBlockCells(grown, smaller));
    expect(second.sheet.cells[3][1]).toBe("");
    expect(second.rows).toBe(2);
  });

  it("clearLiveBlock empties the whole extent", () => {
    const first = writeLiveBlock(createEmptySheet(6, 6), tableBlock, liveBlockCells(tableBlock, table));
    const cleared = clearLiveBlock(first.sheet, { ...tableBlock, rows: first.rows, cols: first.cols });
    expect(cleared.cells[1][1]).toBe("");
    expect(cleared.cells[3][2]).toBe("");
  });
});

describe("boundCellsOf", () => {
  it("maps every cell in each block's extent to its block", () => {
    const block = { ...tableBlock, rows: 2, cols: 2 };
    const map = boundCellsOf([block]);
    expect(map.get("1,1")).toBe(block);
    expect(map.get("2,2")).toBe(block);
    expect(map.has("3,3")).toBe(false);
  });
});

describe("valueOptionsFor", () => {
  it("offers each field directly for a single-row (KPI) payload", () => {
    const kpi: TableData = { ...table, rows: [["กาแฟ", 3]] };
    expect(valueOptionsFor(kpi)).toEqual([
      { column: "name", aggregate: "first" },
      { column: "qty", aggregate: "first" },
    ]);
  });

  it("offers total and average per numeric column plus a row count for a multi-row table", () => {
    expect(valueOptionsFor(table)).toEqual([
      { column: "qty", aggregate: "sum" },
      { column: "qty", aggregate: "avg" },
      { column: "name", aggregate: "count" },
    ]);
  });

  it("returns nothing for a table with no columns", () => {
    expect(valueOptionsFor({ columns: [], rows: [], fetchedAt: "" })).toEqual([]);
  });
});

describe("blockExtent", () => {
  it("counts the header row for a table and one cell for a value", () => {
    expect(blockExtent("table", table)).toEqual({ rows: 3, cols: 2 });
    expect(blockExtent("value", table)).toEqual({ rows: 1, cols: 1 });
  });
});

describe("regionHasContent", () => {
  const sheet = (() => {
    const s = createEmptySheet(8, 8);
    s.cells[2][2] = "เดิม";
    return s;
  })();

  it("detects existing text in the target region", () => {
    expect(regionHasContent(sheet, 1, 1, 3, 3, [])).toBe(true);
    expect(regionHasContent(sheet, 4, 4, 2, 2, [])).toBe(false);
  });

  it("detects an overlapping block even where its cells are blank", () => {
    const existing: LiveBlock = { ...tableBlock, id: "other", anchorRow: 5, anchorCol: 5, rows: 2, cols: 2 };
    expect(regionHasContent(sheet, 4, 4, 2, 2, [existing])).toBe(true);
  });

  it("ignores the block being replaced", () => {
    const self: LiveBlock = { ...tableBlock, anchorRow: 4, anchorCol: 4, rows: 2, cols: 2 };
    const withText = createEmptySheet(8, 8);
    withText.cells[4][4] = "ค่าเดิมของบล็อกนี้";
    expect(regionHasContent(withText, 4, 4, 2, 2, [self], self)).toBe(false);
  });
});
