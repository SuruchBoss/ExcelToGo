import { shiftFormulaRefs } from "./formulaEngine/shift";
import { CellFormat } from "./cellFormat";
import { addColumn, addRow, cloneSheet, SheetModel } from "./sheet";

export interface ClipboardBlock {
  rows: string[][];
  formats: (CellFormat | undefined)[][];
  startRow: number;
  startCol: number;
}

export function copyRange(
  sheet: SheetModel,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): ClipboardBlock {
  const rows: string[][] = [];
  const formats: (CellFormat | undefined)[][] = [];
  for (let r = startRow; r <= endRow; r++) {
    const row: string[] = [];
    const formatRow: (CellFormat | undefined)[] = [];
    for (let c = startCol; c <= endCol; c++) {
      row.push(sheet.cells[r]?.[c] ?? "");
      formatRow.push(sheet.formats[r]?.[c]);
    }
    rows.push(row);
    formats.push(formatRow);
  }
  return { rows, formats, startRow, startCol };
}

function ensureBounds(sheet: SheetModel, minRows: number, minCols: number): SheetModel {
  let next = sheet;
  while (next.rows < minRows) next = addRow(next);
  while (next.cols < minCols) next = addColumn(next);
  return next;
}

/**
 * Pastes a previously copied/cut block so its top-left lands at (targetRow, targetCol),
 * shifting relative references in any formula cell by the same offset the whole block
 * moved — the way pasting a formula in Excel adjusts A1 to A2, etc. Grows the sheet with
 * extra rows/columns rather than silently truncating if the block doesn't fit.
 */
export function pasteClipboardBlock(sheet: SheetModel, clip: ClipboardBlock, targetRow: number, targetCol: number): SheetModel {
  const rowOffset = targetRow - clip.startRow;
  const colOffset = targetCol - clip.startCol;
  const height = clip.rows.length;
  const width = clip.rows[0]?.length ?? 0;
  const next = cloneSheet(ensureBounds(sheet, targetRow + height, targetCol + width));
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const raw = clip.rows[r][c];
      next.cells[targetRow + r][targetCol + c] =
        raw.startsWith("=") && raw.length > 1 ? `=${shiftFormulaRefs(raw.slice(1), rowOffset, colOffset)}` : raw;
      next.formats[targetRow + r][targetCol + c] = clip.formats[r]?.[c];
    }
  }
  return next;
}

/** Pastes plain text (e.g. from the OS clipboard / another spreadsheet) as literal values —
 *  no formula reinterpretation, since we can't tell if "=SUM(...)" from another app is meant
 *  literally or as a formula in ours. */
export function pastePlainTextBlock(sheet: SheetModel, rows: string[][], targetRow: number, targetCol: number): SheetModel {
  const height = rows.length;
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const next = cloneSheet(ensureBounds(sheet, targetRow + height, targetCol + width));
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      next.cells[targetRow + r][targetCol + c] = rows[r][c];
    }
  }
  return next;
}

export function clearRange(sheet: SheetModel, startRow: number, startCol: number, endRow: number, endCol: number): SheetModel {
  const next = cloneSheet(sheet);
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      if (next.cells[r]) next.cells[r][c] = "";
    }
  }
  return next;
}

export function toTsv(clip: ClipboardBlock): string {
  return clip.rows.map((row) => row.join("\t")).join("\n");
}

export function parseTsv(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line, i, arr) => !(i === arr.length - 1 && line === ""))
    .map((line) => line.split("\t"));
}
