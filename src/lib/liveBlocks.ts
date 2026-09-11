import { addColumn, addRow, cloneSheet, SheetModel } from "./sheet";
import { CellValue, TableData } from "./dataSources/types";

export type LiveAggregate = "first" | "sum" | "avg" | "count";

/** A region of a sheet whose cells are written from a data source on every refresh. */
export interface LiveBlock {
  id: string;
  sourceId: string;
  anchorRow: number;
  anchorCol: number;
  kind: "table" | "value";
  /** For kind "value": which column feeds the cell, and how to reduce it to one number. */
  column?: string;
  aggregate?: LiveAggregate;
  /** Extent (including the header row for tables) last written, so a refresh that returns
   *  fewer rows/columns can clear what the previous one left behind. */
  rows: number;
  cols: number;
}

function cellText(v: CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  // A leading "=" would make the engine evaluate API text as a formula — keep it literal.
  return v.startsWith("=") ? ` ${v}` : v;
}

export function aggregateColumn(table: TableData, column: string, aggregate: LiveAggregate): CellValue {
  const idx = table.columns.findIndex((c) => c.key === column);
  if (idx === -1) return null;
  const values = table.rows.map((r) => r[idx]);
  if (aggregate === "first") return values[0] ?? null;
  if (aggregate === "count") return values.filter((v) => v !== null && v !== "").length;
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return aggregate === "sum" ? sum : Math.round((sum / nums.length) * 100) / 100;
}

/** The grid of raw cell strings a block should show for the given table. */
export function liveBlockCells(block: LiveBlock, table: TableData): string[][] {
  if (block.kind === "value") {
    return [[cellText(aggregateColumn(table, block.column ?? "", block.aggregate ?? "first"))]];
  }
  const header = table.columns.map((c) => c.label);
  return [header, ...table.rows.map((r) => r.map(cellText))];
}

function ensureSize(sheet: SheetModel, rows: number, cols: number): SheetModel {
  let next = sheet;
  while (next.rows < rows) next = addRow(next);
  while (next.cols < cols) next = addColumn(next);
  return next;
}

/** Clears the block's previous extent, writes the new cells, and returns the sheet plus the
 *  block's updated extent. */
export function writeLiveBlock(
  sheet: SheetModel,
  block: LiveBlock,
  cells: string[][]
): { sheet: SheetModel; rows: number; cols: number } {
  const rows = cells.length;
  const cols = cells.reduce((m, r) => Math.max(m, r.length), 0);
  const next = cloneSheet(ensureSize(sheet, block.anchorRow + Math.max(rows, block.rows), block.anchorCol + Math.max(cols, block.cols)));
  for (let r = 0; r < block.rows; r++) {
    for (let c = 0; c < block.cols; c++) {
      next.cells[block.anchorRow + r][block.anchorCol + c] = "";
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      next.cells[block.anchorRow + r][block.anchorCol + c] = cells[r][c];
    }
  }
  return { sheet: next, rows, cols };
}

/** Clears a block's cells entirely — used when the block is removed. */
export function clearLiveBlock(sheet: SheetModel, block: LiveBlock): SheetModel {
  return writeLiveBlock(sheet, block, []).sheet;
}

/** "row,col" → the block owning that cell, for every cell currently owned by a block. */
export function boundCellsOf(blocks: LiveBlock[]): Map<string, LiveBlock> {
  const map = new Map<string, LiveBlock>();
  for (const b of blocks) {
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) map.set(`${b.anchorRow + r},${b.anchorCol + c}`, b);
    }
  }
  return map;
}

export interface ValueOption {
  column: string;
  aggregate: LiveAggregate;
}

/**
 * The single-value choices worth offering for a table. A one-row payload (a KPI object) exposes
 * each field as-is; a multi-row table exposes a total and an average per numeric column plus a
 * row count — the numbers a non-technical user actually wants in one cell, rather than every
 * possible column/aggregate combination.
 */
export function valueOptionsFor(table: TableData): ValueOption[] {
  if (table.columns.length === 0) return [];
  if (table.rows.length <= 1) return table.columns.map((c) => ({ column: c.key, aggregate: "first" as const }));
  const numeric = table.columns.filter((c) => c.numeric);
  return [
    ...numeric.map((c) => ({ column: c.key, aggregate: "sum" as const })),
    ...numeric.map((c) => ({ column: c.key, aggregate: "avg" as const })),
    { column: table.columns[0].key, aggregate: "count" as const },
  ];
}

/** How many cells a block of this kind would occupy (a table adds its header row). */
export function blockExtent(kind: LiveBlock["kind"], table: TableData): { rows: number; cols: number } {
  return kind === "value" ? { rows: 1, cols: 1 } : { rows: table.rows.length + 1, cols: table.columns.length };
}

/** True when placing a block here would overwrite something — so the user can be warned before
 *  they commit. Cells belonging to `ignore` (the block being replaced) don't count. */
export function regionHasContent(
  sheet: SheetModel,
  anchorRow: number,
  anchorCol: number,
  rows: number,
  cols: number,
  blocks: LiveBlock[],
  ignore?: LiveBlock
): boolean {
  const owned = boundCellsOf(ignore ? [ignore] : []);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${anchorRow + r},${anchorCol + c}`;
      if (owned.has(key)) continue;
      if ((sheet.cells[anchorRow + r]?.[anchorCol + c] ?? "") !== "") return true;
    }
  }
  // A block sitting here with no text yet (an empty API response) still counts as occupied.
  return blocks.some(
    (b) =>
      b !== ignore &&
      b.anchorRow < anchorRow + rows &&
      b.anchorRow + b.rows > anchorRow &&
      b.anchorCol < anchorCol + cols &&
      b.anchorCol + b.cols > anchorCol
  );
}
