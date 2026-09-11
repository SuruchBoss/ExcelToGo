export type NumberFormat = "general" | "number2" | "percent" | "currency";
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
 * Renders a numeric cell value under the given number format. This only changes what's
 * displayed — the underlying value/formula stored in the cell is untouched. "percent" here
 * means "show this number followed by %", not Excel's convention of multiplying a stored
 * fraction by 100 — since our cells hold plain numbers with no separate fraction/display
 * distinction, that keeps a cell showing "50" and one showing "50%" both mean what they say.
 */
export function formatNumberForDisplay(value: number, fmt: NumberFormat): string {
  const fixed2 = () => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  switch (fmt) {
    case "number2":
      return fixed2();
    case "percent":
      return `${fixed2()}%`;
    case "currency":
      return `฿${fixed2()}`;
    default:
      return String(value);
  }
}

/** Custom (non-semantic) Excel number format codes chosen so an exported .xlsx displays the
 *  cell exactly the way it looked in the app — literal "%"/currency-symbol suffixes rather
 *  than Excel's built-in percent type, which would additionally multiply the stored value
 *  by 100 for display and make the file disagree with what the user saw. */
export const EXCEL_NUM_FMT: Record<NumberFormat, string | undefined> = {
  general: undefined,
  number2: "#,##0.00",
  percent: '0.00"%"',
  currency: '"฿"#,##0.00',
};

export function numberFormatFromExcelNumFmt(numFmt: string | undefined): NumberFormat {
  if (!numFmt || numFmt === "General") return "general";
  if (numFmt.includes("%")) return "percent";
  if (numFmt.includes("฿") || numFmt.includes("$")) return "currency";
  if (numFmt.includes("0.00")) return "number2";
  return "general";
}
