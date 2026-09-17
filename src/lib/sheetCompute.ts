import type { SheetModel } from "./sheet";
import { evaluate } from "./formulaEngine/evaluator";
import {
  compileFormula,
  FormulaProgram,
  packCell,
  PrecedentRange,
} from "./formulaEngine/formulaProgram";
import { FormulaError, FormulaValue } from "./formulaEngine/types";
import { toDisplayString } from "./formulaEngine/coerce";
import { formatNumberForDisplay } from "./cellFormat";

/**
 * Recalculating a sheet, and doing it again after one cell changes without redoing the rest.
 *
 * The first version of this recomputed everything on every call, and every call re-parsed every
 * formula. That is fine at the size a demo is built on and falls over at the size a real file is.
 * Measured on this machine, with three formulas per row:
 *
 *       200 rows (  600 formulas)      11.9 ms
 *     1,000 rows (3,000 formulas)     139.2 ms
 *     3,000 rows (9,000 formulas)   1,244.9 ms
 *
 * That is the cost of one keystroke. Past a thousand rows the grid is visibly behind the typing,
 * and at three thousand it is unusable. `sheetCompute.bench.test.ts` keeps measuring it.
 *
 * What changed:
 *
 * - **Formulas compile once.** `formulaProgram.ts` caches by formula text, so filling `=A1*B1`
 *   down a column parses one formula, not one per row per keystroke.
 * - **Only what changed is recomputed.** Each formula's precedents are read off its syntax tree,
 *   which gives a dependency graph; an edit dirties the transitive closure of whatever reads it
 *   and nothing else. Everything outside that closure keeps the value it already had.
 *
 * The full pass is still here and still used — on the first compute, on a shape change, when the
 * diff is too large to be worth the bookkeeping, and as the thing the property test in
 * `sheetCompute.test.ts` checks the incremental path against on every random edit.
 */

const CIRCULAR = new FormulaError("#CIRCULAR!");

export interface ComputedSheet {
  values: FormulaValue[][];
  display: string[][];
}

interface Snapshot {
  sheet: SheetModel;
  result: ComputedSheet;
  /** Formula cells only, keyed by `packCell`. */
  programs: Map<number, FormulaProgram>;
  /** Cell → the formula cells that name it directly. */
  dependents: Map<number, Set<number>>;
  /** Formula cell → the rectangles it reads. Scanned by containment when a cell goes dirty. */
  rangeReaders: Map<number, PrecedentRange[]>;
  /** Formula cells that read the clock, so they are dirty on every pass. */
  volatile: Set<number>;
}

/**
 * The last few sheets computed, newest first.
 *
 * More than one because a workbook has tabs and the grid computes each of them; one entry would
 * mean every tab switch, and every chart reading another sheet, threw the graph away. Small,
 * because the point is to catch "the same sheet, one cell later", which is always recent.
 */
const HISTORY = 4;
const snapshots: Snapshot[] = [];

/** Repeat calls with the identical sheet object — a re-render — cost nothing. */
const byIdentity = new WeakMap<SheetModel, ComputedSheet>();

/**
 * Above this many changed cells, rebuilding the graph costs more than recomputing. Bulk edits
 * (sort, paste, import, insert row) land here by design, which is also what keeps the worst case
 * bounded by the full pass rather than by the graph bookkeeping.
 */
const MAX_INCREMENTAL_EDITS = 256;

/** Likewise for the dirty closure: past this share of the sheet, the full pass is simply cheaper. */
const MAX_DIRTY_FRACTION = 0.4;

function displayOf(sheet: SheetModel, r: number, c: number, v: FormulaValue): string {
  const numberFormat = sheet.formats[r]?.[c]?.numberFormat;
  return typeof v === "number" && numberFormat && numberFormat !== "general"
    ? formatNumberForDisplay(v, numberFormat)
    : toDisplayString(v);
}

/** What a non-formula cell holds: a number if it reads as one, the text otherwise. */
function literalValue(raw: string): FormulaValue {
  if (raw === "") return null;
  const n = Number(raw);
  return raw.trim() !== "" && !Number.isNaN(n) ? n : raw;
}

function isFormula(raw: string): boolean {
  return raw.startsWith("=") && raw.length > 1;
}

function rangeContains(rect: PrecedentRange, row: number, col: number): boolean {
  return row >= rect.startRow && row <= rect.endRow && col >= rect.startCol && col <= rect.endCol;
}

/**
 * Walks the sheet, computing each cell's value and display.
 *
 * `pending` is a flat byte per cell: 1 while the cell still has to be computed, 0 once it has.
 * A byte array rather than a Set because the full pass marks every cell, and a Set of a million
 * numbers costs more than the recalculation it is bookkeeping for.
 */
function run(
  sheet: SheetModel,
  values: FormulaValue[][],
  display: string[][],
  pending: Uint8Array,
  programs: Map<number, FormulaProgram>,
  own: (row: number) => void
): void {
  const { rows, cols } = sheet;
  const computing = new Set<number>();

  function getCell(r: number, c: number): FormulaValue {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return null;
    const flat = r * cols + c;
    if (pending[flat] === 0) return values[r][c];

    const key = packCell(r, c);
    // Re-entering a cell that is still being computed is a reference cycle. Reported rather than
    // recursed into, and not cached as the cell's value — the cell itself still resolves to it.
    if (computing.has(key)) return CIRCULAR;
    computing.add(key);

    const raw = sheet.cells[r]?.[c] ?? "";
    let result: FormulaValue;
    if (isFormula(raw)) {
      const program = programs.get(key) ?? compileFormula(raw.slice(1));
      if (!program.ast) {
        result = program.error!;
      } else {
        try {
          const evalRes = evaluate(program.ast, { getCell });
          result = evalRes.kind === "scalar" ? evalRes.value : evalRes.rows[0]?.[0] ?? null;
        } catch {
          result = new FormulaError("#ERROR!");
        }
      }
    } else {
      result = literalValue(raw);
    }

    computing.delete(key);
    pending[flat] = 0;
    own(r);
    values[r][c] = result;
    display[r][c] = displayOf(sheet, r, c, result);
    return result;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pending[r * cols + c] === 1) getCell(r, c);
    }
  }
}

/** Records what a formula cell reads, so an edit can find its way back to the cells that read it. */
function link(snap: Snapshot, key: number, program: FormulaProgram): void {
  snap.programs.set(key, program);
  for (const precedent of program.cells) {
    let set = snap.dependents.get(precedent);
    if (!set) snap.dependents.set(precedent, (set = new Set()));
    set.add(key);
  }
  if (program.ranges.length > 0) snap.rangeReaders.set(key, program.ranges);
  if (program.volatile) snap.volatile.add(key);
}

function unlink(snap: Snapshot, key: number): void {
  const program = snap.programs.get(key);
  if (!program) return;
  for (const precedent of program.cells) {
    const set = snap.dependents.get(precedent);
    if (!set) continue;
    set.delete(key);
    if (set.size === 0) snap.dependents.delete(precedent);
  }
  snap.programs.delete(key);
  snap.rangeReaders.delete(key);
  snap.volatile.delete(key);
}

function fullCompute(sheet: SheetModel): Snapshot {
  const { rows, cols } = sheet;
  const values: FormulaValue[][] = Array.from({ length: rows }, () => new Array<FormulaValue>(cols));
  const display: string[][] = Array.from({ length: rows }, () => new Array<string>(cols));

  const snap: Snapshot = {
    sheet,
    result: { values, display },
    programs: new Map(),
    dependents: new Map(),
    rangeReaders: new Map(),
    volatile: new Set(),
  };

  // Compile first: `run` needs every formula's program to be findable, and the graph has to exist
  // before the next edit rather than after it.
  for (let r = 0; r < rows; r++) {
    const row = sheet.cells[r];
    if (!row) continue;
    for (let c = 0; c < cols; c++) {
      const raw = row[c] ?? "";
      if (isFormula(raw)) link(snap, packCell(r, c), compileFormula(raw.slice(1)));
    }
  }

  const pending = new Uint8Array(rows * cols).fill(1);
  run(sheet, values, display, pending, snap.programs, () => {});
  return snap;
}

interface Diff {
  /** Cells whose text changed: the seed of the dirty closure. */
  changed: number[];
  /** Cells whose number format changed but whose value did not: display only. */
  restyled: number[];
}

/** Null when the sheets are too different to be worth an incremental pass. */
function diffSheets(prev: SheetModel, next: SheetModel): Diff | null {
  if (prev.rows !== next.rows || prev.cols !== next.cols) return null;

  const changed: number[] = [];
  const restyled: number[] = [];
  for (let r = 0; r < next.rows; r++) {
    // Rows are shared by reference when an edit leaves them alone, so an untouched row costs one
    // comparison rather than one per column. That is the whole reason `setCellRaw` copies on write.
    if (prev.cells[r] !== next.cells[r]) {
      const a = prev.cells[r] ?? [];
      const b = next.cells[r] ?? [];
      for (let c = 0; c < next.cols; c++) {
        if ((a[c] ?? "") !== (b[c] ?? "")) {
          if (changed.length >= MAX_INCREMENTAL_EDITS) return null;
          changed.push(packCell(r, c));
        }
      }
    }
    if (prev.formats[r] !== next.formats[r]) {
      const a = prev.formats[r] ?? [];
      const b = next.formats[r] ?? [];
      for (let c = 0; c < next.cols; c++) {
        if (a[c]?.numberFormat !== b[c]?.numberFormat) {
          if (restyled.length >= MAX_INCREMENTAL_EDITS) return null;
          restyled.push(packCell(r, c));
        }
      }
    }
  }
  return { changed, restyled };
}

function incrementalCompute(prev: Snapshot, sheet: SheetModel, diff: Diff): Snapshot | null {
  const { rows, cols } = sheet;

  // The closure is taken against the *old* graph on purpose: what has to be recomputed is what
  // read the changed cell before it changed, not what reads it now.
  const dirty = new Set<number>(diff.changed);
  const queue = [...diff.changed];
  for (const key of prev.volatile) {
    if (!dirty.has(key)) {
      dirty.add(key);
      queue.push(key);
    }
  }

  const ceiling = Math.max(64, Math.floor(rows * cols * MAX_DIRTY_FRACTION));
  while (queue.length > 0) {
    const key = queue.pop()!;
    const row = Math.floor(key / 16384);
    const col = key % 16384;

    const direct = prev.dependents.get(key);
    if (direct) {
      for (const d of direct) {
        if (dirty.has(d)) continue;
        dirty.add(d);
        queue.push(d);
      }
    }
    for (const [reader, rects] of prev.rangeReaders) {
      if (dirty.has(reader)) continue;
      for (const rect of rects) {
        if (rangeContains(rect, row, col)) {
          dirty.add(reader);
          queue.push(reader);
          break;
        }
      }
    }
    // A closure this wide means the edit reaches most of the sheet; the full pass does that job
    // without also paying for the graph walk.
    if (dirty.size > ceiling) return null;
  }

  // Rows are shared with the previous result and copied the first time one of their cells is
  // written, so an edit allocates the rows it touches rather than the whole grid.
  const values = prev.result.values.slice();
  const display = prev.result.display.slice();
  const owned = new Set<number>();
  const own = (r: number) => {
    if (owned.has(r)) return;
    owned.add(r);
    values[r] = values[r].slice();
    display[r] = display[r].slice();
  };

  const snap: Snapshot = {
    sheet,
    result: { values, display },
    programs: new Map(prev.programs),
    // Copied one level down as well: the Sets are about to be edited, and the previous snapshot is
    // still a valid answer for the sheet it belongs to.
    dependents: new Map(),
    rangeReaders: new Map(prev.rangeReaders),
    volatile: new Set(prev.volatile),
  };
  for (const [precedent, readers] of prev.dependents) snap.dependents.set(precedent, new Set(readers));

  // Now the graph can be brought up to date, because the closure above is already taken.
  for (const key of diff.changed) {
    const r = Math.floor(key / 16384);
    const c = key % 16384;
    unlink(snap, key);
    const raw = sheet.cells[r]?.[c] ?? "";
    if (isFormula(raw)) link(snap, key, compileFormula(raw.slice(1)));
  }

  const pending = new Uint8Array(rows * cols);
  for (const key of dirty) {
    const r = Math.floor(key / 16384);
    const c = key % 16384;
    if (r < rows && c < cols) pending[r * cols + c] = 1;
  }
  run(sheet, values, display, pending, snap.programs, own);

  // A number format change moves no value, so it only has to be re-rendered.
  for (const key of diff.restyled) {
    const r = Math.floor(key / 16384);
    const c = key % 16384;
    if (r >= rows || c >= cols) continue;
    own(r);
    display[r][c] = displayOf(sheet, r, c, values[r][c]);
  }

  return snap;
}

function remember(snap: Snapshot): ComputedSheet {
  snapshots.unshift(snap);
  if (snapshots.length > HISTORY) snapshots.length = HISTORY;
  byIdentity.set(snap.sheet, snap.result);
  return snap.result;
}

/**
 * The values and display strings for every cell in a sheet.
 *
 * Callers pass a whole sheet and get a whole answer; that it was worked out from the previous one
 * is not their business, and the result is identical either way — which is what the property test
 * checks rather than assumes.
 */
export function computeSheet(sheet: SheetModel): ComputedSheet {
  const hit = byIdentity.get(sheet);
  if (hit) {
    computeStats.identity++;
    return hit;
  }

  for (let i = 0; i < snapshots.length; i++) {
    const prev = snapshots[i];
    if (prev.sheet === sheet) {
      computeStats.identity++;
      return prev.result;
    }
    const diff = diffSheets(prev.sheet, sheet);
    if (!diff || (diff.changed.length === 0 && diff.restyled.length === 0)) continue;
    const next = incrementalCompute(prev, sheet, diff);
    if (next) {
      computeStats.incremental++;
      return remember(next);
    }
  }

  computeStats.full++;
  return remember(fullCompute(sheet));
}

/**
 * Which path each call took, so a test can prove the incremental one actually ran.
 *
 * Without this the property test is worth very little: falling back to a full recompute every time
 * would satisfy "incremental agrees with full" perfectly while doing none of the work the module
 * exists for. The test asserts on these counts for that reason.
 */
export const computeStats = { identity: 0, incremental: 0, full: 0 };

/** Test seam: the snapshot history is module state, and a test measuring a cold start needs none. */
export function resetComputeCache(): void {
  snapshots.length = 0;
  computeStats.identity = 0;
  computeStats.incremental = 0;
  computeStats.full = 0;
}
