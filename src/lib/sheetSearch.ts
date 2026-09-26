// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Finding text in a workbook, and replacing it.
 *
 * `Ctrl+F` is reflex, and it did nothing here — which became more conspicuous, not less, the moment
 * a shortcut sheet went in advertising "the same keys as Excel".
 *
 * Pure, and it searches the *raw* text rather than the computed display. That is the decision the
 * rest of this file follows from: what a person is looking for when they search a spreadsheet is
 * usually what they typed, and what they mean to replace is always what they typed — rewriting a
 * formula's result would mean writing a number over the formula that produced it. The cost is that
 * searching for `1250` does not find the cell showing `1,250` from a formula, and the panel says so
 * rather than pretending otherwise.
 */
import { cellRef } from "./formulaEngine/address";
import type { SheetModel } from "./sheet";

export interface SearchOptions {
  matchCase: boolean;
  /** Whole cell rather than a substring — Excel's "match entire cell contents". */
  wholeCell: boolean;
  /** Every sheet, rather than the one in front of you. */
  allSheets: boolean;
}

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = { matchCase: false, wholeCell: false, allSheets: false };

export interface Match {
  sheetId: string;
  sheetName: string;
  row: number;
  col: number;
  /** The cell's raw text, for showing the hit in a list. */
  raw: string;
}

export interface SearchableSheet {
  id: string;
  name: string;
  sheet: SheetModel;
}

function hit(raw: string, needle: string, options: SearchOptions): boolean {
  if (needle === "") return false;
  const a = options.matchCase ? raw : raw.toLowerCase();
  const b = options.matchCase ? needle : needle.toLowerCase();
  return options.wholeCell ? a === b : a.includes(b);
}

/**
 * Every match, in reading order — left to right, top to bottom, sheet by sheet.
 *
 * Reading order rather than "nearest first" because Find Next has to be predictable: pressing it
 * ten times should walk the sheet the way your eye would, and a list that reorders itself around
 * the cursor makes the tenth press a surprise.
 */
export function findMatches(sheets: SearchableSheet[], needle: string, options: SearchOptions): Match[] {
  if (needle === "") return [];
  const out: Match[] = [];
  for (const { id, name, sheet } of sheets) {
    for (let r = 0; r < sheet.rows; r++) {
      const row = sheet.cells[r];
      if (!row) continue;
      for (let c = 0; c < sheet.cols; c++) {
        const raw = row[c] ?? "";
        if (hit(raw, needle, options)) out.push({ sheetId: id, sheetName: name, row: r, col: c, raw });
      }
    }
  }
  return out;
}

/**
 * Which match to go to next from where the cursor is, wrapping round the end.
 *
 * Takes the current position rather than an index into the list so that editing the sheet between
 * two presses cannot walk off the end of a list that has since got shorter.
 */
export function nextMatchFrom(
  matches: Match[],
  from: { sheetId: string; row: number; col: number } | null,
  direction: 1 | -1
): number {
  if (matches.length === 0) return -1;
  if (!from) return direction === 1 ? 0 : matches.length - 1;
  const after = (m: Match) =>
    m.sheetId === from.sheetId && (m.row > from.row || (m.row === from.row && m.col > from.col));
  const before = (m: Match) =>
    m.sheetId === from.sheetId && (m.row < from.row || (m.row === from.row && m.col < from.col));

  if (direction === 1) {
    const i = matches.findIndex(after);
    return i === -1 ? 0 : i;
  }
  for (let i = matches.length - 1; i >= 0; i--) if (before(matches[i])) return i;
  return matches.length - 1;
}

/**
 * The text a cell becomes when the replacement is applied to it.
 *
 * Case-insensitive search still replaces every occurrence, which needs a manual scan rather than a
 * regex: building one from user input means escaping it, and an escape that is one character short
 * turns a search box into an expression evaluator.
 */
export function replaceIn(raw: string, needle: string, replacement: string, options: SearchOptions): string {
  if (needle === "" || !hit(raw, needle, options)) return raw;
  if (options.wholeCell) return replacement;
  if (options.matchCase) return raw.split(needle).join(replacement);

  const lower = raw.toLowerCase();
  const target = needle.toLowerCase();
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const at = lower.indexOf(target, i);
    if (at === -1) {
      out += raw.slice(i);
      break;
    }
    out += raw.slice(i, at) + replacement;
    i = at + needle.length;
  }
  return out;
}

/** Where a match is, written the way a person would say it: `Sheet1!B4`. */
export function matchLabel(m: Match): string {
  return `${m.sheetName}!${cellRef(m.row, m.col)}`;
}
