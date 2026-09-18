/**
 * What a column of cells continues into when you drag its corner.
 *
 * Dragging the bottom-right grip is the first thing anyone does to a spreadsheet, and until now
 * this app had the grip — it extends a selection on touch — and nothing behind it. A handle that
 * looks draggable and fills nothing is worse than no handle at all.
 *
 * Pure on purpose: in and out are arrays of raw cell text, so every rule below is testable without
 * a grid, a pointer or a store. The grid decides *what* was selected and *where* it was dragged to;
 * this decides only what the new cells should say.
 */
import { shiftFormulaRefs } from "./formulaEngine/shift";

/** A value that reads as a number, `1,250` included. */
function asNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lists Excel fills by name rather than by arithmetic.
 *
 * Thai first because this app is Thai first: `จ อ พ` is a week to the people who will use it, and a
 * spreadsheet that can continue `Mon Tue` but not `จ อ` is one that was not built for them.
 */
const NAMED_CYCLES: string[][] = [
  ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"],
  ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"],
  ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
  ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"],
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ["Q1", "Q2", "Q3", "Q4"],
  ["ไตรมาส 1", "ไตรมาส 2", "ไตรมาส 3", "ไตรมาส 4"],
];

function findCycle(values: string[]): { cycle: string[]; indexes: number[] } | null {
  for (const cycle of NAMED_CYCLES) {
    const indexes = values.map((v) => cycle.findIndex((item) => item.toLowerCase() === v.trim().toLowerCase()));
    if (indexes.every((i) => i >= 0)) return { cycle, indexes };
  }
  return null;
}

/** `Item 1` / `รอบที่ 3` — a trailing number with anything in front of it. */
const SUFFIX_RE = /^(.*?)(\d+)$/;

function suffixParts(values: string[]): { prefix: string; numbers: number[]; width: number } | null {
  const parts = values.map((v) => SUFFIX_RE.exec(v.trim()));
  if (parts.some((p) => p === null)) return null;
  const prefix = parts[0]![1];
  if (parts.some((p) => p![1] !== prefix)) return null;
  const digits = parts.map((p) => p![2]);
  return { prefix, numbers: digits.map((d) => Number(d)), width: digits[0].length };
}

/** The constant gap in a run of numbers, or null when there is no single gap. */
function step(numbers: number[]): number | null {
  if (numbers.length === 1) return 1;
  const first = numbers[1] - numbers[0];
  for (let i = 2; i < numbers.length; i++) {
    // Compared with a tolerance because 0.1, 0.2, 0.3 does not have an exact gap in binary.
    if (Math.abs(numbers[i] - numbers[i - 1] - first) > 1e-9) return null;
  }
  return first;
}

/** Trims float noise that a repeated addition leaves behind: 0.1 + 0.2 should read as 0.3. */
function tidy(n: number): string {
  const rounded = Number(n.toFixed(10));
  return String(rounded);
}

export interface FillRequest {
  /** The cells that were selected, in the order the fill runs. */
  seed: string[];
  /** How many cells to produce. */
  count: number;
  /** How far the first produced cell sits from the first seed cell, for shifting formulas. */
  rowOffset: number;
  colOffset: number;
}

/**
 * The text for each filled cell.
 *
 * The order of the rules is the behaviour. A number series only counts as one when the gap is
 * constant, so `1, 4, 9` repeats rather than inventing 16 — Excel guesses a trend line there, and
 * a wrong guess in a spreadsheet is a number nobody questions.
 */
export function fillValues({ seed, count, rowOffset, colOffset }: FillRequest): string[] {
  const out: string[] = [];
  if (seed.length === 0 || count <= 0) return out;

  const at = (i: number) => seed[i % seed.length];
  /** Which copy of the seed this produced cell belongs to, for shifting a formula by whole blocks. */
  const block = (i: number) => Math.floor(i / seed.length) + 1;

  // A formula is continued by moving its references, never by extending it as a series.
  if (seed.some((v) => v.startsWith("=") && v.length > 1)) {
    for (let i = 0; i < count; i++) {
      const raw = at(i);
      if (!raw.startsWith("=") || raw.length <= 1) {
        out.push(raw);
        continue;
      }
      const r = rowOffset === 0 ? 0 : rowOffset + (block(i) - 1) * seed.length * Math.sign(rowOffset);
      const c = colOffset === 0 ? 0 : colOffset + (block(i) - 1) * seed.length * Math.sign(colOffset);
      out.push(`=${shiftFormulaRefs(raw.slice(1), r, c)}`);
    }
    return out;
  }

  const filled = seed.filter((v) => v.trim() !== "");
  if (filled.length === seed.length) {
    const numbers = seed.map(asNumber);
    if (numbers.every((n) => n !== null)) {
      const gap = step(numbers as number[]);
      if (gap !== null) {
        const last = numbers[numbers.length - 1] as number;
        for (let i = 0; i < count; i++) out.push(tidy(last + gap * (i + 1)));
        return out;
      }
    }

    const cycle = findCycle(seed);
    if (cycle) {
      const gap = step(cycle.indexes) ?? 1;
      const last = cycle.indexes[cycle.indexes.length - 1];
      for (let i = 0; i < count; i++) {
        // Wrapped, so December is followed by January rather than by nothing.
        const next = (((last + gap * (i + 1)) % cycle.cycle.length) + cycle.cycle.length) % cycle.cycle.length;
        out.push(cycle.cycle[next]);
      }
      return out;
    }

    const suffix = suffixParts(seed);
    if (suffix) {
      const gap = step(suffix.numbers);
      if (gap !== null) {
        const last = suffix.numbers[suffix.numbers.length - 1];
        for (let i = 0; i < count; i++) {
          const n = last + gap * (i + 1);
          // Zero padding is kept, so `Item 08` continues `Item 09` rather than `Item 9`.
          out.push(`${suffix.prefix}${String(n).padStart(suffix.width, "0")}`);
        }
        return out;
      }
    }
  }

  // Nothing to continue: repeat what was there, which is what Excel does with text.
  for (let i = 0; i < count; i++) out.push(at(i));
  return out;
}

export interface FillTarget {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/**
 * The block a drag from `source` to (`row`, `col`) fills, or null when it fills nothing.
 *
 * Constrained to one axis, the way Excel does: a drag that wanders diagonally picks whichever
 * direction it went further in, because a fill that guessed "both" would overwrite a rectangle
 * nobody asked for. Dragging back *inside* the selection is a shrink, which this does not do — it
 * answers null and the caller leaves the sheet alone.
 */
export function fillTargetFor(source: FillTarget, row: number, col: number): FillTarget | null {
  const below = row - source.endRow;
  const above = source.startRow - row;
  const right = col - source.endCol;
  const left = source.startCol - col;
  const vertical = Math.max(below, above);
  const horizontal = Math.max(right, left);
  if (vertical <= 0 && horizontal <= 0) return null;

  if (vertical >= horizontal) {
    return below > 0
      ? { startRow: source.endRow + 1, endRow: row, startCol: source.startCol, endCol: source.endCol }
      : { startRow: row, endRow: source.startRow - 1, startCol: source.startCol, endCol: source.endCol };
  }
  return right > 0
    ? { startCol: source.endCol + 1, endCol: col, startRow: source.startRow, endRow: source.endRow }
    : { startCol: col, endCol: source.startCol - 1, startRow: source.startRow, endRow: source.endRow };
}

export interface FillWrite {
  row: number;
  col: number;
  value: string;
}

/**
 * Every cell a fill writes, given where the values come from and where they go.
 *
 * Returns the writes rather than a sheet so the two ways in share one implementation: dragging the
 * handle, where the target is beyond the selection, and Ctrl+D / Ctrl+R, where Excel takes the
 * first row or column of the selection as the source and fills the rest of it. Those differ only
 * in which rectangles get passed here.
 *
 * Each line across the fill is its own series — a column each filling down, a row each filling
 * sideways — which is what makes dragging a block of two columns continue both independently
 * instead of interleaving them into one run.
 */
export function fillBlock(
  read: (row: number, col: number) => string,
  source: FillTarget,
  target: FillTarget
): FillWrite[] {
  const down = target.startCol === source.startCol && target.endCol === source.endCol;
  const backwards = down ? target.startRow < source.startRow : target.startCol < source.startCol;
  const step = backwards ? -1 : 1;
  const lines = down ? source.endCol - source.startCol + 1 : source.endRow - source.startRow + 1;
  const span = down ? source.endRow - source.startRow + 1 : source.endCol - source.startCol + 1;
  const count = down ? target.endRow - target.startRow + 1 : target.endCol - target.startCol + 1;

  const writes: FillWrite[] = [];
  for (let i = 0; i < lines; i++) {
    const seed: string[] = [];
    for (let j = 0; j < span; j++) {
      // Reversed when filling backwards, so the cell nearest the drag leads the series: filling
      // upwards from 10, 20 continues 0, -10 rather than starting again from 10.
      const r = down ? (backwards ? source.endRow - j : source.startRow + j) : source.startRow + i;
      const c = down ? source.startCol + i : backwards ? source.endCol - j : source.startCol + j;
      seed.push(read(r, c));
    }
    const produced = fillValues({
      seed,
      count,
      rowOffset: down ? step * span : 0,
      colOffset: down ? 0 : step * span,
    });
    for (let j = 0; j < count; j++) {
      const r = down ? (backwards ? target.endRow - j : target.startRow + j) : source.startRow + i;
      const c = down ? source.startCol + i : backwards ? target.endCol - j : target.startCol + j;
      writes.push({ row: r, col: c, value: produced[j] });
    }
  }
  return writes;
}

/** Excel's Ctrl+D / Ctrl+R: the first line of the selection is the source, the rest is the target. */
export function fillWithin(selection: FillTarget, axis: "down" | "right"): { source: FillTarget; target: FillTarget } | null {
  if (axis === "down") {
    if (selection.endRow <= selection.startRow) return null;
    return {
      source: { ...selection, endRow: selection.startRow },
      target: { ...selection, startRow: selection.startRow + 1 },
    };
  }
  if (selection.endCol <= selection.startCol) return null;
  return {
    source: { ...selection, endCol: selection.startCol },
    target: { ...selection, startCol: selection.startCol + 1 },
  };
}
