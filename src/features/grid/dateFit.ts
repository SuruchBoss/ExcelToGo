// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Whether a date fits its column, for the grid's `###` (#45) — judged by Excel's font (#136).
 *
 * Every other value in the grid may end in an ellipsis. A date may not: `2024-01-1…` reads as a
 * date, just the wrong one, and on a phone that was the date column of every file. So a date that
 * does not fit shows `###`, as Excel does, and the whole text stays in the cell's title and in what
 * a screen reader hears.
 *
 * Measured with a canvas in the page's own font, cached per text and size — the grid asks for each
 * date cell on every render, and there are only so many distinct dates on a screen.
 */
let ctx: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();

function measure(text: string, px: number): number | null {
  if (typeof document === "undefined" || /jsdom/i.test(navigator.userAgent)) return null;
  if (ctx === undefined) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  const key = `${px}|${text}`;
  const known = widths.get(key);
  if (known !== undefined) return known;
  ctx.font = `${px}px ${getComputedStyle(document.body).fontFamily}`;
  const width = ctx.measureText(text).width;
  // Only cached once the page's font is in: a width taken in the fallback font would stick.
  if (document.fonts?.status === "loaded") widths.set(key, width);
  return width;
}

/** The grid's cells are `px-2` (8px either side) with a 1px right border, plus a pixel for rounding. */
const PADDING = 18;
/** What is left of a cell squeezed for a date that Excel shows (#136): 2px either side and the border. */
const TIGHT_PADDING = 5;

/**
 * How wide Excel draws a date in Calibri 11 at 100% (#136), in pixels — the font Excel measures
 * column widths in. The grid's own font is wider, so "does it fit here" and "does it fit in Excel"
 * are different questions, and the second is the one a file was made to answer. Advance widths are
 * Carlito's, which is metric-compatible with Calibri, at 11pt/96dpi rounded the way a hinted font
 * lands on whole pixels: digits 7 (Excel's own "maximum digit width"), `/` 6, `-` 4.
 */
const CALIBRI_11: Record<string, number> = { "/": 6, "-": 4, ":": 4, ".": 4, ",": 4, " ": 3 };
export function excelTextWidth(text: string, fontPt = 11): number {
  let px = 0;
  for (const ch of text) px += /\d/.test(ch) ? 7 : (CALIBRI_11[ch] ?? (/[A-Z]/.test(ch) ? 8 : 7));
  return (px * fontPt) / 11;
}

/**
 * How a date is drawn in a column (#45, #136): `1` in the grid's own font, a factor below 1 to draw it
 * smaller when Excel would show it here but the grid's font does not fit, or `null` for `###`.
 *
 * `###` needs the date to be wider than the whole column even in Calibri. Excel's exact line sits a
 * few pixels inside that — its cell margins — and cannot be reproduced without its rasteriser, so
 * the doubt goes to the date: a date drawn a little small is still the right date, while a `###`
 * where Excel shows one makes a good file look broken. A width-9 column (68px) holds `28/09/2026`.
 *
 * Squeezing the one cell rather than widening the column keeps the sheet's geometry the file's: the
 * widths written back on export, where charts sit, and what every other cell looks like are all as
 * they came.
 */
export function dateScale(ownWidth: number, excelWidth: number, columnPx: number): number | null {
  if (ownWidth <= columnPx - PADDING) return 1;
  if (excelWidth > columnPx) return null;
  return Math.min(1, (columnPx - TIGHT_PADDING) / ownWidth);
}

/** `dateScale` for a date on screen; a browser that cannot measure gets the text as it is. */
export function dateFit(text: string, columnPx: number, fontPx: number, fontPt = 11): number | null {
  const width = measure(text, fontPx);
  return width === null ? 1 : dateScale(width, excelTextWidth(text, fontPt), columnPx);
}
