// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { AstNode } from "./formulaEngine/ast";
import { parseCellRef, parseRangeRef, rangeRefString, splitSheetRef } from "./formulaEngine/address";
import { adjustFormulaForStructuralOp, type Axis, type ShiftScope } from "./formulaEngine/structuralShift";
import { FUNCTIONS } from "./formulaEngine/functions";

/**
 * Names people give to ranges, so a formula can say what it means.
 *
 * `=SUMIF(ยอดขาย,">1000")` against `=SUMIF(B2:B500,">1000")`: the second is what the sheet had
 * before, and the difference is not tidiness. A reader of the second has to go and look at what is
 * in column B, every time, and a reader who guesses wrong has no way to find out. The formula bar
 * is where a spreadsheet explains itself, and an address explains nothing.
 *
 * Three decisions worth stating, because each closed off something:
 *
 * 1. **Names are scoped to the sheet that defines them.** Excel has both workbook-scoped and
 *    sheet-scoped names; this has only the second. The reason is mechanical rather than
 *    principled — `computeSheet(sheet)` takes a sheet, and fifteen call sites pass one with no
 *    workbook in reach. A name whose *target* names another tab (`ยอดขาย → ข้อมูล!B2:B500`) works
 *    fine, which covers the lookup-table case; what does not work is defining a name once and
 *    using it from every tab. That is written down as a gap rather than half-built.
 * 2. **A name is resolved when the formula compiles, not when it evaluates.** That is what keeps
 *    the dependency graph honest: precedents are read off the tree, so the tree has to hold the
 *    real rectangle by the time anything looks at it. The compile cache is keyed by the name
 *    table's fingerprint as well as the formula text, so redefining a name recompiles the
 *    formulas that use it instead of serving a stale tree.
 * 3. **The stored formula keeps the name.** Filling `=SUM(ยอดขาย)` down a column leaves the text
 *    alone, which is also Excel's behaviour: a name is absolute. That falls out for free, because
 *    `shiftFormulaRefs` only rewrites CELL and RANGE tokens.
 */

/** Keyed by the upper-cased name, so `ยอดขาย` and `Sales`/`SALES` each match one entry. The value
 *  is the reference as text — `B2:B500`, `$A$1`, or `ข้อมูล!B2:B500`. */
export type NameTable = Record<string, NamedRange>;

export interface NamedRange {
  /** Spelled the way it was typed, for showing back. Matching is on the key, which is upper-cased. */
  label: string;
  /** The target, as reference text. */
  ref: string;
}

export const nameKey = (name: string) => name.trim().toUpperCase();

/** What is wrong with a proposed name, or null when nothing is. */
export type NameProblem = "empty" | "looksLikeRef" | "badChars" | "reserved" | "tooLong" | "taken";

const NAME_RE = /^[A-Za-z_฀-๿][A-Za-z0-9_.฀-๿]*$/;
/** Excel's own ceiling. Nothing here breaks above it; a file written past it would. */
const MAX_NAME_LENGTH = 255;

/**
 * Whether a name may be used, and if not, why.
 *
 * The rules are Excel's, and each one exists because the alternative is ambiguous rather than
 * merely untidy. `B2` as a name would shadow a cell; `TRUE` would shadow a literal; a space would
 * make `=SUM(ยอด ขาย)` two tokens. The character rule is the tokenizer's `IDENT_RE` — if a name
 * cannot be tokenized as one word it cannot be referred to, and accepting it would create a name
 * that exists and is unusable.
 */
export function nameProblem(name: string, table: NameTable | undefined, replacing?: string): NameProblem | null {
  const trimmed = name.trim();
  if (trimmed === "") return "empty";
  if (trimmed.length > MAX_NAME_LENGTH) return "tooLong";
  // Checked before the character rule, so `A1:B2` is told what is actually wrong with it — it is
  // an address — rather than being told off for its colon.
  if (parseCellRef(trimmed) || parseRangeRef(trimmed)) return "looksLikeRef";
  if (!NAME_RE.test(trimmed)) return "badChars";
  const key = nameKey(trimmed);
  // A single `R` or `C` is Excel's shorthand for a whole row or column in R1C1 notation. This
  // engine has no R1C1, but a file written with such a name is rejected by Excel on open, so the
  // name would only be a trap for anyone exporting.
  if (key === "TRUE" || key === "FALSE" || key === "R" || key === "C") return "reserved";
  if (key in FUNCTIONS) return "reserved";
  if (table && key in table && key !== (replacing ? nameKey(replacing) : undefined)) return "taken";
  return null;
}

/** The AST node a reference text means, or undefined when it is not a reference at all. */
export function refToNode(ref: string): AstNode | undefined {
  const { sheet, ref: address } = splitSheetRef(ref.trim());
  const range = parseRangeRef(address);
  if (range) return { type: "range", ...range, ...(sheet ? { sheet } : {}) };
  const cell = parseCellRef(address);
  if (cell) return { type: "cell", row: cell.row, col: cell.col, ...(sheet ? { sheet } : {}) };
  return undefined;
}

/**
 * The name table as the compiler sees it: a lookup, plus a key that changes when the table does.
 *
 * `key` is what goes into the formula cache's key. Without it, redefining `ยอดขาย` from `B2:B10`
 * to `B2:B500` would leave every formula that uses it compiled against the old rectangle — the
 * values would be right (the cache holds a tree, and the tree would be re-evaluated) and the
 * dependency graph would be wrong, which is the failure that does not announce itself.
 */
export interface NameScope {
  key: string;
  resolve(name: string): AstNode | undefined;
}

const scopes = new WeakMap<NameTable, NameScope>();

export function nameScope(names: NameTable | undefined): NameScope | undefined {
  if (!names) return undefined;
  const keys = Object.keys(names);
  if (keys.length === 0) return undefined;
  const cached = scopes.get(names);
  if (cached) return cached;

  const nodes = new Map<string, AstNode | undefined>();
  for (const key of keys) nodes.set(key, refToNode(names[key].ref));
  const scope: NameScope = {
    key: keys
      .sort()
      .map((k) => `${k}=${names[k].ref}`)
      .join("|"),
    resolve: (name) => nodes.get(nameKey(name)),
  };
  scopes.set(names, scope);
  return scope;
}

/** Replaces every name node the scope knows, leaving the rest to become `#NAME?`. */
export function substituteNames(node: AstNode, scope: NameScope): AstNode {
  switch (node.type) {
    case "name":
      return scope.resolve(node.name) ?? node;
    case "unary": {
      const expr = substituteNames(node.expr, scope);
      return expr === node.expr ? node : { ...node, expr };
    }
    case "binop": {
      const left = substituteNames(node.left, scope);
      const right = substituteNames(node.right, scope);
      return left === node.left && right === node.right ? node : { ...node, left, right };
    }
    case "call": {
      let changed = false;
      const args = node.args.map((a) => {
        const next = substituteNames(a, scope);
        if (next !== a) changed = true;
        return next;
      });
      return changed ? { ...node, args } : node;
    }
    default:
      return node;
  }
}

/** Adds or replaces one name, returning a new table. */
export function withName(table: NameTable | undefined, label: string, ref: string): NameTable {
  return { ...(table ?? {}), [nameKey(label)]: { label: label.trim(), ref: ref.trim() } };
}

/** Removes one, and the table itself once it is empty — an empty object would still key the
 *  formula cache differently from no table at all. */
export function withoutName(table: NameTable | undefined, label: string): NameTable | undefined {
  if (!table) return undefined;
  const next = { ...table };
  delete next[nameKey(label)];
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Moves every name's target when a row or column is inserted or deleted.
 *
 * Reuses the formula rewriter rather than repeating its arithmetic, because a name's target *is*
 * a reference and the rules for growing a range around an insert are the fiddly part. A target
 * that a deletion destroys becomes `#REF!` and is dropped: a name that resolves to nothing is a
 * `#NAME?` in every formula that uses it, which says "this name does not exist" — true, and more
 * useful than a name that exists and points at wreckage.
 */
export function shiftNames(
  table: NameTable | undefined,
  axis: Axis,
  index: number,
  delta: 1 | -1,
  scope?: ShiftScope
): NameTable | undefined {
  if (!table) return undefined;
  const next: NameTable = {};
  let changed = false;
  for (const [key, entry] of Object.entries(table)) {
    const moved = adjustFormulaForStructuralOp(entry.ref, axis, index, delta, scope);
    if (moved.includes("#REF!")) {
      changed = true;
      continue;
    }
    if (moved !== entry.ref) changed = true;
    next[key] = moved === entry.ref ? entry : { ...entry, ref: moved };
  }
  if (!changed) return table;
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * The reference text for a selected rectangle, written absolutely so the name does not drift.
 *
 * Unqualified, even though names are sheet-scoped and a prefix would be more explicit. A qualified
 * target is a *cross-sheet* reference to the evaluator, and a cross-sheet reference needs the
 * workbook resolver — which half the `computeSheet` callers do not pass. Naming a range on the
 * sheet you are looking at would then read `#REF!` in a PDF export and be fine on screen. The
 * sheet prefix is put back where it is genuinely needed, on the way into an `.xlsx`, whose defined
 * names are workbook-wide.
 */
export function refForSelection(sel: { startRow: number; startCol: number; endRow: number; endCol: number }): string {
  return rangeRefString(sel.startRow, sel.startCol, sel.endRow, sel.endCol)
    .split(":")
    .map((part) => part.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2"))
    .join(":");
}

/** The names in a table, in the order they read best: alphabetical by what was typed. */
export function listNames(table: NameTable | undefined): (NamedRange & { key: string })[] {
  return Object.entries(table ?? {})
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => a.label.localeCompare(b.label, "th"));
}
