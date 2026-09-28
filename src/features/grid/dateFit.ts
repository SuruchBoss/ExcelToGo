// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Whether a date fits its column, for the grid's `###` (#45).
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

/** True unless the text is known not to fit; a browser that cannot measure gets the text. */
export function dateFits(text: string, columnPx: number, fontPx: number): boolean {
  const width = measure(text, fontPx);
  return width === null || width <= columnPx - PADDING;
}
