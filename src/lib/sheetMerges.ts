/**
 * Merged cell ranges carried over from an imported file.
 *
 * A form's title band is almost always one cell merged across several columns, so without this a
 * file that looked like a form opens as a title crammed into column A with the band broken up
 * behind it. The grid renders a merge as a `rowSpan`/`colSpan` on its top-left cell and skips the
 * cells it covers.
 */

export interface MergeRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

function key(row: number, col: number): string {
  return `${row},${col}`;
}

export interface MergeLookup {
  /** Top-left cell of each merge — the one that actually gets rendered, with its span. */
  anchors: Map<string, MergeRange>;
  /** Every other cell inside a merge. These are not rendered at all. */
  covered: Set<string>;
}

export function mergeLookup(merges: MergeRange[] | undefined): MergeLookup {
  const anchors = new Map<string, MergeRange>();
  const covered = new Set<string>();
  for (const m of merges ?? []) {
    anchors.set(key(m.startRow, m.startCol), m);
    for (let r = m.startRow; r <= m.endRow; r++) {
      for (let c = m.startCol; c <= m.endCol; c++) {
        if (r !== m.startRow || c !== m.startCol) covered.add(key(r, c));
      }
    }
  }
  return { anchors, covered };
}

/**
 * Moves merges to follow an inserted or deleted row/column.
 *
 * A merge that spans the affected line grows or shrinks with it; one entirely after it slides.
 * A merge left covering a single cell is no longer a merge and is dropped — keeping it would put
 * a `colSpan={1}` on a cell for no reason and quietly accumulate junk across edits.
 */
export function shiftMerges(
  merges: MergeRange[] | undefined,
  axis: "row" | "col",
  index: number,
  delta: 1 | -1
): MergeRange[] | undefined {
  if (!merges || merges.length === 0) return merges;

  const out: MergeRange[] = [];
  for (const m of merges) {
    const start = axis === "row" ? m.startRow : m.startCol;
    const end = axis === "row" ? m.endRow : m.endCol;

    let nextStart = start;
    let nextEnd = end;
    if (delta === 1) {
      if (start >= index) nextStart = start + 1;
      if (end >= index) nextEnd = end + 1;
    } else {
      // The deleted line vanishes: anything past it slides back, and a merge containing it shrinks.
      if (start > index) nextStart = start - 1;
      if (end >= index) nextEnd = end - 1;
    }
    if (nextEnd < nextStart) continue;

    const shifted: MergeRange =
      axis === "row"
        ? { ...m, startRow: nextStart, endRow: nextEnd }
        : { ...m, startCol: nextStart, endCol: nextEnd };
    if (shifted.startRow === shifted.endRow && shifted.startCol === shifted.endCol) continue;
    out.push(shifted);
  }
  return out.length > 0 ? out : undefined;
}

/** Parses "A1:D1" into a range. Returns null for anything that isn't a two-ended reference. */
export function parseMergeRef(ref: string, parseCell: (r: string) => { row: number; col: number } | null): MergeRange | null {
  const [from, to] = ref.split(":");
  if (!from || !to) return null;
  const a = parseCell(from.trim());
  const b = parseCell(to.trim());
  if (!a || !b) return null;
  return {
    startRow: Math.min(a.row, b.row),
    startCol: Math.min(a.col, b.col),
    endRow: Math.max(a.row, b.row),
    endCol: Math.max(a.col, b.col),
  };
}
