// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { SheetModel } from "./sheet";
import { isFrozen } from "./sheetFreeze";

/**
 * How a sheet should be laid out on paper.
 *
 * The PDF export used to produce *a* document: portrait unless there were more than eight columns,
 * eight-point type whatever the width, the column letters as the only heading, and no page numbers
 * — so a twelve-page export was twelve loose sheets with nothing on them to say which came first.
 * Printed and handed to somebody, that is the difference between a report and a pile.
 *
 * Every decision below is made from the sheet itself rather than from a settings dialog. That is a
 * deliberate stopping point, not an oversight: the defaults are right often enough that a dialog
 * would mostly be a thing to click through, and the README says so plainly rather than implying a
 * page-setup screen exists.
 */
export interface PageSetup {
  orientation: "portrait" | "landscape";
  /** Point size for the table body. Smaller as the sheet gets wider, within reason. */
  fontSize: number;
  /**
   * How many of the sheet's own top rows to repeat as a heading on every page.
   *
   * Taken from the frozen panes when there are any: somebody who froze two rows has already said
   * which rows are the heading, and asking again in a different place would be asking twice.
   */
  headerRows: number;
}

/** Wider than this many columns and portrait stops being readable at any font size. */
const LANDSCAPE_FROM = 8;

/**
 * Type sizes by width. Measured against A4 rather than guessed: at 8pt a column needs roughly
 * 18mm to be worth reading, and the usable width is 182mm portrait, 269mm landscape.
 */
function fontSizeFor(columns: number, orientation: PageSetup["orientation"]): number {
  const usableMm = orientation === "landscape" ? 269 : 182;
  const perColumn = usableMm / Math.max(1, columns);
  if (perColumn >= 18) return 8;
  if (perColumn >= 13) return 7;
  if (perColumn >= 9) return 6;
  // Below this the page is a grey rectangle whatever it says, and shrinking further only makes
  // the document look like it is trying to hide something.
  return 5;
}

export function pageSetupFor(sheet: SheetModel, columns: number): PageSetup {
  const orientation = columns > LANDSCAPE_FROM ? "landscape" : "portrait";
  return {
    orientation,
    fontSize: fontSizeFor(columns, orientation),
    // Capped at three: a heading that takes a quarter of every page is not a heading.
    headerRows: isFrozen(sheet.freeze) ? Math.min(sheet.freeze.rows, 3) : 0,
  };
}

/** "หน้า 2 / 7" — page numbers exist so a printed stack can be put back in order. */
export function pageLabel(page: number, total: number, locale: "th" | "en"): string {
  return locale === "th" ? `หน้า ${page} / ${total}` : `Page ${page} of ${total}`;
}
