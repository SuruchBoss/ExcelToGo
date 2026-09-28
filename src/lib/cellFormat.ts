// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_DATE_CODE, formatSerial, isDateFormatCode, kindOfDateCode } from "./excelDate";
import { formatNumberCode, isPercentCode } from "./numberFormatCode";

/**
 * "text" is Excel's `@`: whatever is typed stays exactly as typed, digits included (#23).
 * "date", "datetime" and "time" show an Excel date serial as a date (#45); a file's own date code
 * (`dd/mm/yyyy`) rides along in `CellFormat.dateFormat`.
 */
export type NumberFormat = "general" | "number2" | "percent" | "currency" | "text" | "date" | "datetime" | "time";

export const DATE_FORMATS: readonly NumberFormat[] = ["date", "datetime", "time"];
export const isDateFormat = (fmt: NumberFormat | undefined): fmt is "date" | "datetime" | "time" =>
  fmt === "date" || fmt === "datetime" || fmt === "time";
export type CellAlign = "left" | "center" | "right";
export type CellVAlign = "top" | "middle" | "bottom";

/** Which edges of a cell carry a visible border, and in what colour. */
export interface CellBorders {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

export interface CellFormat {
  bold?: boolean;
  color?: string;
  align?: CellAlign;
  numberFormat?: NumberFormat;
  /** The Excel code a date came in with (`dd/mm/yyyy`), shown and written back as the file had it.
   *  Absent means the app's own ISO form for the kind. */
  dateFormat?: string;
  /** The Excel number code a file gave a number (`0%`, `"$"#,##0.00`, `#,##0`), shown and written
   *  back as written (#53). Absent means the preset's own code. */
  numFmtCode?: string;
  /** Background colour as #rrggbb. The coloured bands across a form's headings are the most
   *  recognisable thing about it, so a file that has them has to keep them. */
  fill?: string;
  /** Font size in points, as Excel stores it. */
  fontSize?: number;
  italic?: boolean;
  underline?: boolean;
  valign?: CellVAlign;
  borders?: CellBorders;
}

/** Excel's default body font size, used as the baseline the grid renders at. */
export const DEFAULT_FONT_SIZE = 11;

/** Excel measures row heights and font sizes in points; the browser wants pixels. */
export function ptToPx(pt: number | undefined): number | undefined {
  if (pt === undefined || !Number.isFinite(pt) || pt <= 0) return undefined;
  return Math.round((pt * 96) / 72);
}

export function pxToPt(px: number | undefined): number | undefined {
  if (px === undefined || !Number.isFinite(px) || px <= 0) return undefined;
  return Math.round(((px * 72) / 96) * 100) / 100;
}

/**
 * Renders a numeric cell value under the given number format. This only changes what's displayed —
 * the value stored in the cell is untouched.
 *
 * "percent" is Excel's: the stored fraction ×100, so 0.07 shows as 7.00% (#53). It used to show the
 * number itself with a "%" after it, which made every percentage in an Excel file 100 times too
 * small on screen — an accountant's VAT of 0.07 read "0.07%". A code that came with the file
 * (`numCode`) wins over the preset, so `0%` and `"$"#,##0.00` show as the file has them.
 */
export function formatNumberForDisplay(value: number, fmt: NumberFormat, dateCode?: string, numCode?: string): string {
  if (isDateFormat(fmt)) return formatSerial(value, dateCode ?? DEFAULT_DATE_CODE[fmt]);
  if (numCode) return formatNumberCode(value, numCode);
  const fixed2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  switch (fmt) {
    case "number2":
      return fixed2(value);
    case "percent":
      return formatNumberCode(value, "0.00%");
    case "currency":
      return `฿${fixed2(value)}`;
    default:
      return String(value);
  }
}

/** The Excel code each preset goes out as, so an exported .xlsx shows the cell the way the app did.
 *  Percent is Excel's own `0.00%` (#53): the file used to carry `0.00"%"`, a literal sign that
 *  Excel showed without the ×100, so a real percentage opened in Excel 100 times too small. */
export const EXCEL_NUM_FMT: Record<NumberFormat, string | undefined> = {
  general: undefined,
  number2: "#,##0.00",
  percent: "0.00%",
  currency: '"฿"#,##0.00',
  text: "@",
  date: DEFAULT_DATE_CODE.date,
  datetime: DEFAULT_DATE_CODE.datetime,
  time: DEFAULT_DATE_CODE.time,
};

/**
 * Excel's built-in short date (number format 14) as ExcelJS names it. Excel shows it in the reader's
 * own locale, so it carries no layout of its own worth keeping: it reads as the app's default.
 */
const LOCALE_SHORT_DATE = new Set(["mm-dd-yy", "m/d/yy", "m/d/yyyy"]);

/** The date code worth keeping from a file, or undefined when the app's default says the same. */
export function fileDateCode(numFmt: string | undefined): string | undefined {
  if (!numFmt || !isDateFormatCode(numFmt) || LOCALE_SHORT_DATE.has(numFmt)) return undefined;
  const kind = kindOfDateCode(numFmt);
  return numFmt === DEFAULT_DATE_CODE[kind] ? undefined : numFmt;
}

export function numberFormatFromExcelNumFmt(numFmt: string | undefined): NumberFormat {
  if (!numFmt || numFmt === "General") return "general";
  if (numFmt === "@") return "text";
  // Before the checks below: `yyyy"%"` is still a date, and `dd.mm.yyyy` would read as "0.00".
  if (isDateFormatCode(numFmt)) return kindOfDateCode(numFmt);
  if (isPercentCode(numFmt)) return "percent";
  if (numFmt.includes("฿") || numFmt.includes("$")) return "currency";
  if (numFmt.includes("0.00")) return "number2";
  return "general";
}

/**
 * The number code worth keeping from a file (#53): anything but General, text, a date, or the code
 * the preset it maps to would write anyway. Kept so `0%`, `0.000` and `"$"#,##0.00` show as the file
 * has them rather than as the nearest of the app's four presets.
 */
export function fileNumberCode(numFmt: string | undefined): string | undefined {
  if (!numFmt || numFmt === "General" || numFmt === "@" || isDateFormatCode(numFmt)) return undefined;
  return numFmt === EXCEL_NUM_FMT[numberFormatFromExcelNumFmt(numFmt)] ? undefined : numFmt;
}
