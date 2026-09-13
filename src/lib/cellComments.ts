/**
 * Notes attached to cells.
 *
 * Stored as a sparse map keyed by position rather than as a grid parallel to `cells`, because
 * comments are rare — a sheet with four notes shouldn't carry a thousand empty slots — and because
 * that is how merges, conditional rules and charts already work: each is a separate structure that
 * the insert/delete operations shift explicitly. A comment hidden inside `CellFormat` would have
 * been simpler to shift and wrong for a different reason: clearing a cell's formatting would wipe
 * what someone wrote about it.
 */

export type CellComments = Record<string, string>;

export function commentKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function getComment(comments: CellComments | undefined, row: number, col: number): string | undefined {
  return comments?.[commentKey(row, col)];
}

/**
 * Writes or clears one note, returning undefined once none are left.
 *
 * Empty means removed, not an empty note: a marker on a cell with nothing behind it is a promise
 * of information that isn't there.
 */
export function setComment(
  comments: CellComments | undefined,
  row: number,
  col: number,
  text: string
): CellComments | undefined {
  const next = { ...comments };
  const trimmed = text.trim();
  if (trimmed === "") delete next[commentKey(row, col)];
  else next[commentKey(row, col)] = trimmed;
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Moves notes to follow an inserted or deleted row/column.
 *
 * A note on the deleted line goes with it — it was about that cell, and re-pointing it at whatever
 * slid into the gap would put a comment against data it was never written about. That is the
 * opposite of what a chart's anchor does, and deliberately so: a chart is a thing placed *near*
 * cells, a note is a thing said *about* one.
 */
export function shiftComments(
  comments: CellComments | undefined,
  axis: "row" | "col",
  index: number,
  delta: 1 | -1
): CellComments | undefined {
  if (!comments) return undefined;
  const next: CellComments = {};
  for (const [key, text] of Object.entries(comments)) {
    const [row, col] = key.split(",").map(Number);
    const along = axis === "row" ? row : col;
    if (delta === -1 && along === index) continue;
    const moved = delta === 1 ? (along >= index ? along + 1 : along) : along > index ? along - 1 : along;
    next[axis === "row" ? commentKey(moved, col) : commentKey(row, moved)] = text;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Drops notes that fall outside a sheet, used after a delete shrinks it. */
export function clampComments(
  comments: CellComments | undefined,
  rows: number,
  cols: number
): CellComments | undefined {
  if (!comments) return undefined;
  const next: CellComments = {};
  for (const [key, text] of Object.entries(comments)) {
    const [row, col] = key.split(",").map(Number);
    if (row < rows && col < cols) next[key] = text;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
