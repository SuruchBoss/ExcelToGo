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
export function autoSumRange(
  valueAt: (row: number, col: number) => string,
  bounds: { rows: number; cols: number },
  anchor: { row: number; col: number }
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

  const rest = [];
  for (let r = run.startRow + 1; r <= run.endRow; r++) rest.push(valueAt(r, col));
  if (rest.length > 0 && !isNumeric(valueAt(run.startRow, col)) && rest.every(isNumeric)) {
    return { startRow: run.startRow + 1, endRow: run.endRow };
  }
  return run;
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
