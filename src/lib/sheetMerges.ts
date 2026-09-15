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

/** The merge containing a cell, if any — anchor or covered, both count. */
export function mergeAt(merges: MergeRange[] | undefined, row: number, col: number): MergeRange | null {
  for (const m of merges ?? []) {
    if (row >= m.startRow && row <= m.endRow && col >= m.startCol && col <= m.endCol) return m;
  }
  return null;
}

function overlaps(a: MergeRange, b: MergeRange): boolean {
  return a.startRow <= b.endRow && a.endRow >= b.startRow && a.startCol <= b.endCol && a.endCol >= b.startCol;
}

function normalise(range: MergeRange): MergeRange {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    endRow: Math.max(range.startRow, range.endRow),
    startCol: Math.min(range.startCol, range.endCol),
    endCol: Math.max(range.startCol, range.endCol),
  };
}

/**
 * Grows a range until it wholly contains every merge it touches.
 *
 * Merging a range that clips an existing merge in half has no valid answer — half a merge is not a
 * thing — so the new one swallows it instead, which is what Excel does. Repeated until stable,
 * because swallowing one merge can bring the range into contact with another.
 */
export function expandOverMerges(merges: MergeRange[] | undefined, range: MergeRange): MergeRange {
  let out = normalise(range);
  if (!merges || merges.length === 0) return out;
  for (let pass = 0; pass < merges.length + 1; pass++) {
    let grew = false;
    for (const m of merges) {
      if (!overlaps(m, out)) continue;
      const next = {
        startRow: Math.min(out.startRow, m.startRow),
        endRow: Math.max(out.endRow, m.endRow),
        startCol: Math.min(out.startCol, m.startCol),
        endCol: Math.max(out.endCol, m.endCol),
      };
      if (
        next.startRow !== out.startRow ||
        next.endRow !== out.endRow ||
        next.startCol !== out.startCol ||
        next.endCol !== out.endCol
      ) {
        out = next;
        grew = true;
      }
    }
    if (!grew) break;
  }
  return out;
}

/**
 * Whether merging this range would throw away text.
 *
 * A merge keeps the top-left cell and nothing else, which is the one genuinely destructive thing
 * the button does. Asking first is only reasonable when there is actually something to lose — a
 * confirm dialog on an empty range is a dialog that teaches people to click through dialogs.
 */
export function mergeWouldDiscard(cells: string[][], merges: MergeRange[] | undefined, range: MergeRange): boolean {
  const r = expandOverMerges(merges, range);
  for (let row = r.startRow; row <= r.endRow; row++) {
    for (let col = r.startCol; col <= r.endCol; col++) {
      if (row === r.startRow && col === r.startCol) continue;
      if ((cells[row]?.[col] ?? "") !== "") return true;
    }
  }
  return false;
}

export interface MergeResult {
  merges: MergeRange[] | undefined;
  /** Cells to blank, as [row, col] — everything the merge covers except its top-left. */
  cleared: [number, number][];
}

/**
 * Adds a merge over a range, absorbing any it overlaps.
 *
 * Returns null for a single cell: one cell is not a merge, and storing it would put `colSpan={1}`
 * on a cell for no reason and accumulate junk over edits.
 */
export function addMerge(merges: MergeRange[] | undefined, range: MergeRange): MergeResult | null {
  const target = expandOverMerges(merges, range);
  if (target.startRow === target.endRow && target.startCol === target.endCol) return null;

  const kept = (merges ?? []).filter((m) => !overlaps(m, target));
  const cleared: [number, number][] = [];
  for (let r = target.startRow; r <= target.endRow; r++) {
    for (let c = target.startCol; c <= target.endCol; c++) {
      if (r !== target.startRow || c !== target.startCol) cleared.push([r, c]);
    }
  }
  return { merges: [...kept, target], cleared };
}

/** Drops every merge the range touches. Splitting one it only clips still splits the whole merge. */
export function removeMerges(merges: MergeRange[] | undefined, range: MergeRange): MergeRange[] | undefined {
  if (!merges || merges.length === 0) return merges;
  const target = normalise(range);
  const kept = merges.filter((m) => !overlaps(m, target));
  return kept.length > 0 ? kept : undefined;
}

/** True when the range touches any merge — the signal for whether the button splits or joins. */
export function rangeHasMerge(merges: MergeRange[] | undefined, range: MergeRange): boolean {
  const target = normalise(range);
  return (merges ?? []).some((m) => overlaps(m, target));
}
