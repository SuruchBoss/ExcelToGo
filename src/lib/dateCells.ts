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
