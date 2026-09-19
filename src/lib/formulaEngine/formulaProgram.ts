import { AstNode } from "./ast";
import { parseFormula, FormulaSyntaxError } from "./parser";
import { FormulaError } from "./types";
import { type NameScope, substituteNames } from "../namedRanges";

/**
 * What a formula compiles to: its syntax tree, the cells it reads, and whether it can ever be
 * considered up to date.
 *
 * Splitting this out from evaluation is what makes an incremental recalc possible. Two things fall
 * out of it, and neither is available while parsing happens inside the evaluation loop:
 *
 * 1. **Parsing happens once per distinct formula, not once per recalc.** A sheet with `=A1*B1`
 *    filled down three thousand rows holds three thousand different formulas, but a sheet that
 *    recalculates on every keystroke used to re-parse all of them every time.
 * 2. **The precedents are known before the formula runs.** This language has no `INDIRECT` and no
 *    `OFFSET` — every reference is a `cell` or `range` node sitting in the tree — so walking the
 *    tree gives the complete set of cells a formula depends on. That is what the dependency graph
 *    is built from, and it is only sound because of that missing pair of functions. Adding either
 *    one means the graph has to learn about references discovered at evaluation time.
 */

/** A rectangle of cells a formula reads, as written: `A1:B10`. */
export interface PrecedentRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface FormulaProgram {
  /** Null when the formula does not parse; `error` then holds what to display. */
  ast: AstNode | null;
  error: FormulaError | null;
  /** Individually referenced cells, packed with `packCell`. */
  cells: number[];
  ranges: PrecedentRange[];
  /**
   * True when the formula reads something outside the sheet — the clock. A volatile cell is
   * recomputed on every pass, because nothing in the sheet changes to tell us it went stale, and a
   * cache that did not know this would freeze `=TODAY()` at the moment it was first typed.
   */
  volatile: boolean;
}

/** Excel's own column ceiling, so a packed key is one number rather than a string to hash. */
export const MAX_COLS = 16384;

export function packCell(row: number, col: number): number {
  return row * MAX_COLS + col;
}

export function unpackRow(key: number): number {
  return Math.floor(key / MAX_COLS);
}

export function unpackCol(key: number): number {
  return key % MAX_COLS;
}

/** Functions whose answer depends on when you ask. */
const VOLATILE_FUNCTIONS = new Set(["TODAY", "NOW"]);

function walk(node: AstNode, out: FormulaProgram): void {
  switch (node.type) {
    case "cell":
      out.cells.push(packCell(node.row, node.col));
      return;
    case "range":
      out.ranges.push({
        startRow: node.startRow,
        startCol: node.startCol,
        endRow: node.endRow,
        endCol: node.endCol,
      });
      return;
    case "unary":
      walk(node.expr, out);
      return;
    case "binop":
      walk(node.left, out);
      walk(node.right, out);
      return;
    case "call":
      if (VOLATILE_FUNCTIONS.has(node.name.toUpperCase())) out.volatile = true;
      for (const arg of node.args) walk(arg, out);
      return;
    default:
      return;
  }
}

// Keyed by the formula's text, so filling one formula down a column compiles it once. Bounded
// because a workbook can hold as many distinct formulas as it has cells, and this outlives any one
// of them; when it fills, the oldest half goes, which is cheaper than tracking exact use order and
// good enough for a cache whose misses only cost a parse.
const CACHE_LIMIT = 8192;
const cache = new Map<string, FormulaProgram>();

/**
 * Compiles a formula body (no leading `=`), reusing an earlier result when the same text has been
 * seen before.
 *
 * A formula that does not parse is cached too. Re-parsing broken text on every keystroke is the
 * worst case to leave uncached: it is the state a formula is in for as long as someone is still
 * typing it.
 */
export function compileFormula(body: string, scope?: NameScope): FormulaProgram {
  // A sheet with no names keys the cache by the formula text alone, exactly as before: the common
  // case pays nothing for a feature it is not using. With names, the table's fingerprint joins the
  // key, so redefining one recompiles the formulas that read it rather than serving a tree built
  // around the old rectangle — and the dependency graph is built from that tree.
  const key = scope ? `${scope.key}\u0000${body}` : body;
  const hit = cache.get(key);
  if (hit) return hit;

  const program: FormulaProgram = { ast: null, error: null, cells: [], ranges: [], volatile: false };
  try {
    const parsed = parseFormula(body);
    program.ast = scope ? substituteNames(parsed, scope) : parsed;
    walk(program.ast, program);
  } catch (e) {
    program.ast = null;
    program.error = new FormulaError(e instanceof FormulaSyntaxError ? "#SYNTAX!" : "#ERROR!");
  }

  if (cache.size >= CACHE_LIMIT) {
    let drop = Math.floor(CACHE_LIMIT / 2);
    for (const oldest of cache.keys()) {
      cache.delete(oldest);
      if (--drop <= 0) break;
    }
  }
  cache.set(key, program);
  return program;
}

/** Test seam: the cache is module state, and a test that measures misses needs it empty. */
export function clearFormulaCache(): void {
  cache.clear();
}
