import { AstNode } from "./formulaEngine/ast";
import { compileFormula, packCell, PrecedentRange } from "./formulaEngine/formulaProgram";

/**
 * Which cells a formula reads, for drawing on the grid.
 *
 * The dependency graph already works this out — it is how one edit recomputes three cells instead
 * of nine thousand — but it keeps the answer for its own purposes and in its own shape. This is the
 * same question asked for the person looking at the screen: **select `=SUMIF(B2:B50,"เหนือ",D2:D50)`
 * and see which cells it is actually about.**
 *
 * Worth having because the bug it addresses is this project's most expensive one, already written
 * up in the README: `C2:C4` and `C2:D4` differ by one character, both compute, neither errors, and
 * the wrong number is noticed a week later by somebody else. The range picker stops that when a
 * formula is *written*. Nothing stopped it when a formula is *read*, until this.
 *
 * Deliberately separate from `formulaProgram`: the graph wants speed and a shape it can walk, and
 * this wants a set of positions to colour in. Sharing the type would have coupled a UI concern to
 * the thing the engine's performance rests on.
 */

/**
 * More than this many cells and the highlight is not shown.
 *
 * `=SUM(A:A)` reads a million cells, and outlining a million cells is not information — it is the
 * whole screen turning one colour, plus a set large enough to notice building. The number is where
 * a highlight stops meaning "look here".
 */
export const MAX_HIGHLIGHT = 2_000;

export interface Precedents {
  /** Packed positions on *this* sheet, ready for a membership test per rendered cell. */
  cells: ReadonlySet<number>;
  /** The rectangles as written, for drawing an outline around each rather than per cell. */
  ranges: readonly PrecedentRange[];
  /** True when the formula reads more than is worth showing, so the UI can say so instead. */
  tooMany: boolean;
  /** True when some of what it reads is on another sheet, which cannot be drawn here. */
  elsewhere: boolean;
}

/** The answer for a cell that is not a formula, shared so the UI has one object to compare. */
export const NO_PRECEDENTS: Precedents = { cells: new Set(), ranges: [], tooMany: false, elsewhere: false };
const NONE = NO_PRECEDENTS;

/**
 * Cross-sheet references are dropped, and that is the point of walking the AST again here.
 *
 * `compileFormula` flattens `Sheet2!A1` into the same packed key as a local `A1`, because the
 * graph only needs to know *that* the formula is stale, not where from. Colouring A1 on this sheet
 * because a formula reads A1 on another one would be a lie told confidently.
 */
function collect(node: AstNode, out: { cells: number[]; ranges: PrecedentRange[]; elsewhere: boolean }): void {
  switch (node.type) {
    case "cell":
      if (node.sheet) out.elsewhere = true;
      else out.cells.push(packCell(node.row, node.col));
      return;
    case "range":
      if (node.sheet) out.elsewhere = true;
      else out.ranges.push({ startRow: node.startRow, startCol: node.startCol, endRow: node.endRow, endCol: node.endCol });
      return;
    case "unary":
      return collect(node.expr, out);
    case "binop":
      collect(node.left, out);
      collect(node.right, out);
      return;
    case "call":
      for (const arg of node.args) collect(arg, out);
      return;
    default:
      return;
  }
}

export function precedentsOf(raw: string, limit = MAX_HIGHLIGHT): Precedents {
  if (typeof raw !== "string" || !raw.startsWith("=")) return NONE;
  const program = compileFormula(raw.slice(1));
  // A formula that does not parse has no precedents worth drawing — and `#SYNTAX!` on screen is
  // already telling the person what they need to know.
  if (!program.ast) return NONE;

  const found = { cells: [] as number[], ranges: [] as PrecedentRange[], elsewhere: false };
  collect(program.ast, found);

  const cells = new Set<number>();
  for (const key of found.cells) cells.add(key);
  for (const rect of found.ranges) {
    const width = rect.endCol - rect.startCol + 1;
    const height = rect.endRow - rect.startRow + 1;
    // Counted before it is built. A whole-column range would otherwise allocate a million-entry
    // Set on the way to deciding it was too big to draw.
    if (cells.size + width * height > limit) {
      return { cells: new Set(), ranges: found.ranges, tooMany: true, elsewhere: found.elsewhere };
    }
    for (let r = rect.startRow; r <= rect.endRow; r++) {
      for (let c = rect.startCol; c <= rect.endCol; c++) cells.add(packCell(r, c));
    }
  }
  if (cells.size > limit) {
    return { cells: new Set(), ranges: found.ranges, tooMany: true, elsewhere: found.elsewhere };
  }
  return { cells, ranges: found.ranges, tooMany: false, elsewhere: found.elsewhere };
}
