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
 * Measured the way the cell is drawn: laid out in the page (a hidden span in the page's font, with
 * the cell's weight and style), cached per text and size — the grid asks for each date cell on
 * every render, and there are only so many distinct dates on a screen.
 *
 * Not with a canvas, which is what this used first. `measureText` returns unrounded advances; the
 * page lays glyphs out hinted, and on a headless Linux runner that put every digit on a whole
 * pixel — `28/09/2026` measured to fit in 63px and was drawn 64px wide, `2026-09-28` 66px. No
 * margin fixes that for every machine's fonts; measuring what is drawn does.
 */
import { useSyncExternalStore } from "react";

export interface Face {
  bold?: boolean;
  italic?: boolean;
}

let probe: HTMLSpanElement | null = null;
const widths = new Map<string, number>();

function measure(text: string, px: number, face: Face = {}): number | null {
  if (typeof document === "undefined" || /jsdom/i.test(navigator.userAgent)) return null;
  const key = `${px}|${face.bold ? 7 : 4}|${face.italic ? "i" : "n"}|${text}`;
  const known = widths.get(key);
  if (known !== undefined) return known;
  if (!probe || !probe.isConnected) {
    probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    Object.assign(probe.style, { position: "absolute", left: "-10000px", top: "0", visibility: "hidden", whiteSpace: "nowrap" });
    document.body.appendChild(probe);
  }
  probe.style.fontSize = `${px}px`;
  probe.style.fontWeight = face.bold ? "700" : "400";
  probe.style.fontStyle = face.italic ? "italic" : "normal";
  probe.textContent = text;
  const width = probe.getBoundingClientRect().width;
  // Only cached once the page's font is in: a width taken in the fallback font would stick.
  if (document.fonts?.status === "loaded") widths.set(key, width);
  return width;
}

/**
 * Re-renders its caller once the page's fonts have loaded (#136). A date measured before then is
 * measured in the fallback font; where that font is narrower than the page's own — on CI's runner,
 * not on the machine this was written on — the date was judged to fit at full size, the real font
 * arrived, and it overflowed its cell with nothing left to measure it again. The cache above keeps
 * no width taken before the fonts load, so one more render is all it takes.
 */
const subscribeFonts = (onChange: () => void) => {
  const fonts = typeof document === "undefined" ? undefined : document.fonts;
  if (!fonts) return () => {};
  fonts.addEventListener("loadingdone", onChange);
  void fonts.ready.then(onChange);
  return () => fonts.removeEventListener("loadingdone", onChange);
};
const fontStatus = () => (typeof document === "undefined" ? "loaded" : (document.fonts?.status ?? "loaded"));
export function useFontsLoaded(): string {
  return useSyncExternalStore(subscribeFonts, fontStatus, () => "loaded");
}

/** The grid's cells are `px-2` (8px either side) with a 1px right border, plus a pixel for rounding. */
const PADDING = 18;
/** What is left of a cell squeezed for a date that Excel shows (#136): 2px either side and the border. */
const TIGHT_PADDING = 5;
/** Sizes are tried a quarter pixel apart, and never below this. */
const STEP = 0.25;
const SMALLEST = 6;

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
/**
 * The size is found by measuring, not by proportion: a hinted font does not narrow in step with its
 * size, so `room / width` can land a pixel or three over. The first guess is that proportion; from
 * there the size steps down until what is drawn at it fits.
 */
export function dateScale(widthAt: (px: number) => number, excelWidth: number, columnPx: number, fontPx: number): number | null {
  const full = widthAt(fontPx);
  if (full <= columnPx - PADDING) return 1;
  if (excelWidth > columnPx) return null;
  const room = columnPx - TIGHT_PADDING;
  let px = Math.min(fontPx, Math.ceil(((fontPx * room) / full) / STEP) * STEP);
  while (px > SMALLEST && Math.ceil(widthAt(px)) > room) px -= STEP;
  return Math.min(1, px / fontPx);
}

/** `dateScale` for a date on screen; a browser that cannot measure gets the text as it is. */
export function dateFit(text: string, columnPx: number, fontPx: number, fontPt = 11, face: Face = {}): number | null {
  if (measure(text, fontPx, face) === null) return 1;
  return dateScale((px) => measure(text, px, face) ?? 0, excelTextWidth(text, fontPt), columnPx, fontPx);
}
