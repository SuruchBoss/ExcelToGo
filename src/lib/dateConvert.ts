// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { BE_OFFSET, DateKind, dateLiteral, isoFromSerial, serialOf } from "./excelDate";

/**
 * "Convert to dates" (#82): text that is a date only once somebody says how to read it.
 *
 * `15/01/69` is a birthday in 2530 or a due date in 2030; `03/04/2026` is March or April. Reading
 * either automatically would be a guess that is wrong for someone, and a date 43 years or a month
 * off does not look wrong. So these wait for a person to say the order and the calendar, as Excel's
 * Text to Columns → Date does, and see what they will get before anything changes.
 *
 * Pure: text in, the ISO text a cell keeps out. The store applies it to a selection in one step.
 */

/** The order the day, month and year are written in. */
export type DateOrder = "dmy" | "mdy" | "ymd";
/** Which calendar the years are counted in. */
export type DateCalendar = "be" | "ce";

export interface ConvertedDate {
  serial: number;
  kind: DateKind;
  /** What the cell will hold: ISO, Gregorian — the one form nothing can misread afterwards. */
  iso: string;
}

const NUMERIC = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})(?:\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?$/;

/**
 * A year as the calendar says. Two digits in the Buddhist Era are 25yy; in the Gregorian calendar
 * they follow Excel's window, 00–29 as 20yy and 30–99 as 19yy. Four digits are taken as written, less
 * 543 for the Buddhist Era.
 */
function yearOf(digits: string, calendar: DateCalendar): number | null {
  const n = Number(digits);
  if (digits.length === 2) return calendar === "be" ? 2500 + n - BE_OFFSET : n < 30 ? 2000 + n : 1900 + n;
  if (digits.length === 4) return calendar === "be" ? n - BE_OFFSET : n;
  return null;
}

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The date `text` means when read in this order and calendar, or null for text that is not one. */
export function convertDate(raw: string, order: DateOrder, calendar: DateCalendar): ConvertedDate | null {
  const text = (raw.startsWith("'") ? raw.slice(1) : raw).trim();
  if (text === "" || text.startsWith("=")) return null;
  // What the cell already reads as a date — ISO, a Buddhist year, a Thai month — needs no choice.
  const known = dateLiteral(text);
  if (known) return known.kind === "time" ? null : { serial: known.serial, kind: known.kind, iso: isoFromSerial(known.serial, known.kind) };

  const m = NUMERIC.exec(text);
  if (!m) return null;
  const [, a, b, c, h, mi, s] = m;
  const [dayText, monthText, yearText] = order === "dmy" ? [a, b, c] : order === "mdy" ? [b, a, c] : [c, b, a];
  if (dayText.length > 2 || monthText.length > 2) return null;
  const year = yearOf(yearText, calendar);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year === null || !validDate(year, month, day)) return null;
  let serial = serialOf(year, month, day);
  let kind: DateKind = "date";
  if (h !== undefined) {
    const hour = Number(h);
    const minute = Number(mi);
    const second = Number(s ?? 0);
    if (hour > 23 || minute > 59 || second > 59) return null;
    serial += (hour * 3600 + minute * 60 + second) / 86_400;
    kind = "datetime";
  }
  return { serial, kind, iso: isoFromSerial(serial, kind) };
}

export interface ConversionPlan {
  /** Every cell that will change: where, what it says now, and what it will hold. */
  changes: { row: number; col: number; before: string; after: ConvertedDate }[];
  /** Cells with something in them that cannot be read as a date this way; they stay as they are. */
  unreadable: { row: number; col: number; before: string }[];
}

const NO_ROWS: ReadonlySet<number> = new Set();

/**
 * What converting a range would do, without doing it — the preview and the change are the same
 * list, so what the person saw is what happens. Empty cells and formulas are left out of both, and
 * so are `skipRows`: the rows a filter hides, which every action on a selection leaves alone (#50),
 * since nothing on screen would say they had changed.
 */
export function planConversion(
  rawAt: (row: number, col: number) => string,
  range: { startRow: number; endRow: number; startCol: number; endCol: number },
  order: DateOrder,
  calendar: DateCalendar,
  skipRows: ReadonlySet<number> = NO_ROWS
): ConversionPlan {
  const plan: ConversionPlan = { changes: [], unreadable: [] };
  for (let row = range.startRow; row <= range.endRow; row++) {
    if (skipRows.has(row)) continue;
    for (let col = range.startCol; col <= range.endCol; col++) {
      const before = rawAt(row, col);
      if (before.trim() === "" || (before.startsWith("=") && before.length > 1)) continue;
      const after = convertDate(before, order, calendar);
      if (!after) plan.unreadable.push({ row, col, before });
      else if (after.iso !== before) plan.changes.push({ row, col, before, after });
    }
  }
  return plan;
}
