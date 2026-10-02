// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Which cells an answer should be *about*, given only where the cursor is.
 *
 * The assistant is told the selection, and a selection is usually one cell — so "รวมยอดขายทั้งหมด"
 * with E2 highlighted came back as `=SUM(E2)`: the sum of one number, which is that number. Right
 * about the syntax, useless as an answer, and it was the first thing the public demo said to
 * anyone who tried the feature the landing page leads with.
 *
 * Excel has answered this since 1985 and AutoSum is the answer: from the cursor, walk up the column
 * while cells have something in them; that run is what you meant. This is that rule, and nothing
 * more — no guessing at intent, no reading the question. It works on the emptiness of cells, so it
 * is testable on grids drawn by hand.
 */

export interface RowRun {
  startRow: number;
  endRow: number;
}

/** A value that would go into a numeric column — `1,250` and ` 42 ` count, `กาแฟ` does not. */
function isNumeric(value: string): boolean {
  const cleaned = value.trim().replace(/,/g, "");
  return cleaned !== "" && Number.isFinite(Number(cleaned));
}

/**
 * The run of filled cells the cursor is standing in, sitting under, or sitting over.
 *
 * Three cases, and the first one is the one a plain reading of AutoSum misses. On this app's own
 * sample sheet — E1 the header "รวม", E2:E10 the numbers — a cursor on E2 has exactly one filled
 * cell above it, the header, so "look upwards" answers `SUM(E1)`: the total of a word. Standing
 * *in* a column has to mean the column, or the rule is right about Excel and wrong about people.
 *
 * Above before below for an empty cursor, the way AutoSum does: a total belongs at the bottom of
 * its column, so that is where people put it. Below is the case where they put the cursor on the
 * header instead — common enough that "nothing to add up" there would read as broken.
 *
 * A leading header is dropped only when the rest of the run is numeric: `SUM` over a text cell is
 * how you get 0 without being told why, and a column whose first cell is a word but whose others
 * are words too is not a header — it is text, and the caller's rule (COUNTA, not SUM) still holds.
 */
/** A label that says its row is a total: "รวมทั้งหมด", "Grand total". */
export const TOTAL_LABEL = /(^|\s)(รวมทั้งหมด|ยอดรวม|grand total|total)(\s|:|$)/i;

export interface RunOptions {
  /** A cell that totals the cells above it — never part of what a question is about (#63). */
  isTotal?: (row: number, col: number) => boolean;
  /** Row 1 holds column names, so a run starting there starts with one, numbers or not (#63). */
  hasHeaderRow?: boolean;
}

export function autoSumRange(
  valueAt: (row: number, col: number) => string,
  bounds: { rows: number; cols: number },
  anchor: { row: number; col: number },
  options: RunOptions = {}
): RowRun | null {
  const { row, col } = anchor;
  if (col < 0 || col >= bounds.cols) return null;
  const filled = (r: number) => r >= 0 && r < bounds.rows && valueAt(r, col).trim() !== "";

  let run: RowRun | null = null;
  if (filled(row)) {
    let start = row;
    let end = row;
    while (filled(start - 1)) start--;
    while (filled(end + 1)) end++;
    run = { startRow: start, endRow: end };
  } else if (filled(row - 1)) {
    let start = row - 1;
    while (filled(start - 1)) start--;
    run = { startRow: start, endRow: row - 1 };
  } else if (filled(row + 1)) {
    let end = row + 1;
    while (filled(end + 1)) end++;
    run = { startRow: row + 1, endRow: end };
  }
  if (!run) return null;
  return trimRun(valueAt, col, run, options);
}

/**
 * The header and the total taken off a run (#63). A grand total under the numbers used to be
 * counted in with them — `=SUM(E2:E11)` over nine sales and their own total is twice the answer —
 * and a text column kept its header, so "count the products" said 10 on a sheet of nine.
 */
function trimRun(valueAt: (row: number, col: number) => string, col: number, run: RowRun, options: RunOptions): RowRun | null {
  let { startRow, endRow } = run;
  // Alone, too: a cursor under the grand total used to get `=AVERAGE(E12)`, the average of one total.
  if (options.isTotal?.(endRow, col)) endRow--;
  if (endRow < startRow) return null;
  const rest = [];
  for (let r = startRow + 1; r <= endRow; r++) rest.push(valueAt(r, col));
  const header = !isNumeric(valueAt(startRow, col));
  if (rest.length > 0 && header && (rest.every(isNumeric) || (options.hasHeaderRow && startRow === 0))) startRow++;
  return startRow <= endRow ? { startRow, endRow } : null;
}

/** Whether a run holds text rather than numbers — COUNTA counts it, COUNT would say 0 (#63). */
export function runIsText(valueAt: (row: number, col: number) => string, col: number, run: RowRun): boolean {
  let text = 0;
  for (let r = run.startRow; r <= run.endRow; r++) if (!isNumeric(valueAt(r, col))) text++;
  return text * 2 > run.endRow - run.startRow + 1;
}

/** A column the question can name by its header, and the data under it. */
export interface NamedColumn {
  name: string;
  /** Column letters, e.g. "C". */
  col: string;
  /** The data under the header, e.g. "C2:C10", without a total row. */
  range: string;
  numeric: boolean;
}

/**
 * Row 1 as column names, when it is one: at least two cells, none of them a number, over a row
 * that has something in it. What lets "the average price" mean column C wherever the cursor is,
 * and "join the product name and category" mean A and B on the cursor's own row (#63).
 */
export function hasHeaderRow(valueAt: (row: number, col: number) => string, bounds: { rows: number; cols: number }): boolean {
  if (bounds.rows < 2) return false;
  let names = 0;
  let below = 0;
  for (let c = 0; c < Math.min(bounds.cols, 50); c++) {
    const v = valueAt(0, c).trim();
    if (v !== "" && isNumeric(v)) return false;
    if (v !== "") names++;
    if (valueAt(1, c).trim() !== "") below++;
  }
  return names >= 2 && below > 0;
}

export function namedColumns(
  valueAt: (row: number, col: number) => string,
  bounds: { rows: number; cols: number },
  toLetters: (col: number) => string,
  options: RunOptions = {}
): NamedColumn[] {
  if (!hasHeaderRow(valueAt, bounds)) return [];
  const out: NamedColumn[] = [];
  for (let c = 0; c < Math.min(bounds.cols, 50); c++) {
    const name = valueAt(0, c).trim();
    if (name === "" || valueAt(1, c).trim() === "") continue;
    let end = 1;
    while (end + 1 < bounds.rows && valueAt(end + 1, c).trim() !== "") end++;
    const run = trimRun(valueAt, c, { startRow: 1, endRow: end }, { ...options, hasHeaderRow: false });
    if (!run) continue;
    const letters = toLetters(c);
    out.push({
      name: name.slice(0, 60),
      col: letters,
      range: `${letters}${run.startRow + 1}:${letters}${run.endRow + 1}`,
      numeric: !runIsText(valueAt, c, run),
    });
  }
  return out;
}

/**
 * The column headers worth sending along, read from the first row.
 *
 * Both the model and the person reading the explanation do better with "Column headers: sku, name,
 * price" than without, and the panel was sending neither — the API route has accepted a `headers`
 * field since the feature shipped and nothing ever filled it in.
 */
export function headerRow(
  valueAt: (row: number, col: number) => string,
  bounds: { rows: number; cols: number },
  limit = 50
): string[] {
  if (bounds.rows === 0) return [];
  const out: string[] = [];
  for (let c = 0; c < Math.min(bounds.cols, limit); c++) {
    const v = valueAt(0, c).trim();
    if (v !== "") out.push(v);
  }
  return out;
}

/**
 * Values from the sheet that a question names — "Drinks" in "the total for drinks" (#63). A
 * question that names one is about the rows holding it, which is a SUMIF or a COUNTIF, not the
 * total of the column. Found here, on the device that has the sheet; the matcher only hears which.
 * Words shorter than three characters are left out, and so are numbers and row 1's column names.
 */
export function valuesMentioned(
  question: string,
  valueAt: (row: number, col: number) => string,
  bounds: { rows: number; cols: number },
  skipFirstRow: boolean,
  limit = 5
): string[] {
  const q = question.toLowerCase();
  const found = new Set<string>();
  for (let r = skipFirstRow ? 1 : 0; r < Math.min(bounds.rows, 2000); r++) {
    for (let c = 0; c < Math.min(bounds.cols, 50); c++) {
      const v = valueAt(r, c).trim();
      // A total's label is not a condition: "รวมทั้งหมด" sits in "จำนวนเงินรวมทั้งหมด".
      if (v.length < 3 || isNumeric(v) || found.has(v) || TOTAL_LABEL.test(v)) continue;
      if (q.includes(v.toLowerCase())) found.add(v.slice(0, 60));
      if (found.size >= limit) return [...found];
    }
  }
  return [...found];
}
