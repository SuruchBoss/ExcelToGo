// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { isDateFormat } from "./cellFormat";
import { DateKind, dateLiteral, isoFromSerial } from "./excelDate";
import type { FormulaValue } from "./formulaEngine/types";
import type { SheetModel } from "./sheet";
import type { ComputedSheet } from "./sheetCompute";

/**
 * Which cells are dates (#45), for the places that must not treat one as a plain number.
 *
 * A date's value is its Excel serial, which is right for arithmetic and for the file, and wrong
 * wherever a date is a *label*: a pivot grouped by day, a chart's category axis, a CSV somebody
 * opens in another program. Those read the date as the grid shows it. One definition, so they
 * agree with the grid and with each other about what counts.
 */

/** Only the two grids these readers look at, so a component holding them need not build the rest. */
type Grid = Pick<ComputedSheet, "values" | "display">;

/** A cell is a date when it carries a date format, or when it is typed as an ISO date. */
export function dateKindAt(sheet: SheetModel, row: number, col: number): DateKind | null {
  const fmt = sheet.formats[row]?.[col]?.numberFormat;
  if (isDateFormat(fmt)) return fmt;
  const raw = sheet.cells[row]?.[col] ?? "";
  if (raw.startsWith("=") || fmt === "text") return null;
  return dateLiteral(raw)?.kind ?? null;
}

/** The grid's text for a date cell, or null for any other — for a date used as a label. */
export function dateTextAt(sheet: SheetModel, computed: Grid, row: number, col: number): string | null {
  if (typeof computed.values[row]?.[col] !== "number") return null;
  return dateKindAt(sheet, row, col) ? computed.display[row][col] : null;
}

/** `dateTextAt` bound to one sheet, the shape the chart and pivot readers take. */
export const dateTextReader =
  (sheet: SheetModel, computed: Grid) =>
  (row: number, col: number): string | null =>
    dateTextAt(sheet, computed, row, col);

/**
 * The values with every date as ISO text — what a CSV holds. ISO rather than the cell's own layout
 * because a CSV is read by programs, and `2024-01-15` is the one form none of them can misread
 * (PaynEat ERP's importer takes it too).
 */
export function valuesWithIsoDates(sheet: SheetModel, computed: ComputedSheet): FormulaValue[][] {
  return computed.values.map((row, r) =>
    row.map((v, c) => {
      if (typeof v !== "number") return v;
      const kind = dateKindAt(sheet, r, c);
      return kind ? isoFromSerial(v, kind) : v;
    })
  );
}

const DATE_FUNCTION = /^=\s*(TODAY|NOW|DATE)\s*\(/i;

/**
 * The date format a formula entered by a person implies, as Excel does it (decision 8): `=TODAY()`
 * and `=DATE(…)` are dates, `=NOW()` a date and time. Without it the cell would show 46293 — the
 * right value in the one form nobody reads.
 */
export function dateKindOfFormula(raw: string): DateKind | null {
  const m = DATE_FUNCTION.exec(raw);
  return m ? (m[1].toUpperCase() === "NOW" ? "datetime" : "date") : null;
}

/**
 * The sheet with that format set on the cells a date formula was just written to — but only where
 * the first of them is still General. A format somebody picked is theirs, and Excel does not
 * override it either.
 */
export function withFormulaDateFormat(
  sheet: SheetModel,
  raw: string,
  startRow: number,
  startCol: number,
  endRow = startRow,
  endCol = startCol
): SheetModel {
  const kind = dateKindOfFormula(raw);
  const current = sheet.formats[startRow]?.[startCol]?.numberFormat;
  if (!kind || (current && current !== "general")) return sheet;
  const formats = sheet.formats.slice();
  for (let r = startRow; r <= endRow; r++) {
    if (!formats[r]) continue;
    formats[r] = formats[r].slice();
    for (let c = startCol; c <= endCol; c++) formats[r][c] = { ...formats[r][c], numberFormat: kind };
  }
  return { ...sheet, formats };
}

/** Wide enough for `2024-01-15 14:30` in the grid's font (119px at 14px), its padding and border, with room to spare. */
export const DATETIME_COL_WIDTH = 144;

/**
 * The sheet with the column widened for a date and time just entered into it, as Excel widens a
 * General column for one. Only a column still at the default width: one somebody sized is theirs,
 * and the grid shows `###` there rather than guessing.
 */
export function withRoomForDateTime(sheet: SheetModel, raw: string, col: number): SheetModel {
  const kind = raw.startsWith("=") ? dateKindOfFormula(raw) : dateLiteral(raw)?.kind;
  if (kind !== "datetime" || sheet.colWidths?.[col] !== undefined) return sheet;
  const colWidths = sheet.colWidths ? sheet.colWidths.slice() : Array.from({ length: sheet.cols }, () => undefined);
  colWidths[col] = DATETIME_COL_WIDTH;
  return { ...sheet, colWidths };
}
