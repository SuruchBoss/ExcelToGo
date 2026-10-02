// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { AstNode } from "./formulaEngine/ast";
import { parseCellRef, parseRangeRef, rangeRefString, sheetRefPrefix, splitSheetRef } from "./formulaEngine/address";
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
 * 1. **A name belongs to the workbook unless it says otherwise (#60)**, as in Excel: one defined
 *    on `ข้อมูล` works from every tab. It is still *stored* on a sheet — the one it was made on, or
 *    the one it points at when it came from a file — because that is where undo, autosave, the
 *    cloud copy and live editing already carry a sheet's things, and a target written bare there
 *    means that sheet. `scope: "sheet"` marks the other kind, which only formulas on its own sheet
 *    see, or others as `Sheet!Name`. What a formula sees is `effectiveNames`: every workbook name,
 *    qualified with its sheet, and its own sheet's names over them.
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
  /** The target, as reference text. Bare, it means the sheet the name is stored on. */
  ref: string;
  /** Absent for a workbook-level name, which is the default (#60); `"sheet"` for one that only its
   *  own sheet sees — how a file's `localSheetId` names arrive. */
  scope?: "sheet";
}

/**
 * The key a name is matched on: upper-cased, and for `Sheet!Name` the sheet's own name without its
 * quotes, so `'ใบ ขาย'!ยอด` and `ใบ ขาย!ยอด` written two ways are one key.
 */
export function nameKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed.includes("!")) return trimmed.toUpperCase();
  const { sheet, ref } = splitSheetRef(trimmed);
  return sheet === null ? trimmed.toUpperCase() : `${sheet.toUpperCase()}!${ref.trim().toUpperCase()}`;
}

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

/** Adds or replaces one name, returning a new table. Workbook-level unless `scope` says otherwise. */
export function withName(table: NameTable | undefined, label: string, ref: string, scope?: "sheet"): NameTable {
  const entry: NamedRange = { label: label.trim(), ref: ref.trim() };
  if (scope) entry.scope = scope;
  return { ...(table ?? {}), [nameKey(label)]: entry };
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
 * Unqualified: the name is stored on the sheet it was made on, and a bare target means that sheet.
 * `effectiveNames` puts the prefix on for every other sheet (#60), and the export puts it on for
 * the file, whose defined names always carry one.
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

export interface NamedTab {
  name: string;
  sheet: { names?: NameTable };
}

/**
 * A target as a formula on `self` must see it: qualified with the sheet the name lives on, unless
 * that is `self`, where a prefix would send the reference through the workbook resolver back into
 * the sheet being computed — a cycle, not a value.
 */
function targetFrom(ref: string, home: string, self: string): string {
  const { sheet, ref: address } = splitSheetRef(ref.trim());
  const on = sheet ?? home;
  return on.toLowerCase() === self.toLowerCase() ? address : `${sheetRefPrefix(on)}${address}`;
}

/** Recent effective tables by content, so an unchanged workbook hands back the same object. */
const effective = new Map<string, NameTable | undefined>();
const EFFECTIVE_KEPT = 64;

/**
 * The names a formula on `tabs[selfIndex]` can use (#60).
 *
 * - Every workbook-level name, from whichever sheet holds it; if two sheets hold one (two files
 *   added together), the first tab's wins — the same rule the export already follows.
 * - The sheet's own sheet-level names over those, as in Excel.
 * - Every sheet-level name of every sheet as `Sheet!Name`, which is how Excel reaches one.
 *
 * The result is the same object for the same content. The compute cache and the compile cache are
 * both keyed on that identity, so a table rebuilt on every render would recompile every formula.
 */
export function effectiveNames(tabs: readonly NamedTab[], selfIndex: number): NameTable | undefined {
  const self = tabs[selfIndex];
  if (!self || !tabs.some((t) => t.sheet.names)) return undefined;
  const table: NameTable = {};
  for (const tab of tabs) {
    for (const [key, entry] of Object.entries(tab.sheet.names ?? {})) {
      const ref = targetFrom(entry.ref, tab.name, self.name);
      if (entry.scope === "sheet") table[`${tab.name.toUpperCase()}!${key}`] = { ...entry, ref };
      else if (!(key in table)) table[key] = { label: entry.label, ref };
    }
  }
  for (const [key, entry] of Object.entries(self.sheet.names ?? {})) {
    if (entry.scope === "sheet") table[key] = { ...entry, ref: targetFrom(entry.ref, self.name, self.name) };
  }
  const keys = Object.keys(table).sort();
  if (keys.length === 0) return undefined;
  const fingerprint = keys.map((k) => `${k}=${table[k].ref}`).join("|");
  if (effective.has(fingerprint)) return effective.get(fingerprint);
  if (effective.size >= EFFECTIVE_KEPT) effective.delete(effective.keys().next().value!);
  effective.set(fingerprint, table);
  return table;
}

/** Where a name the person can see lives: the tab that holds it, and whether it is sheet-level. */
export interface NameHome {
  tabIndex: number;
  key: string;
  entry: NamedRange;
}

/**
 * The names the name box lists for the sheet in front of the person: its own sheet-level names,
 * then every workbook-level name, each with the tab it lives on.
 */
export function visibleNames(tabs: readonly NamedTab[], selfIndex: number): NameHome[] {
  const out: NameHome[] = [];
  const seen = new Set<string>();
  for (const [key, entry] of Object.entries(tabs[selfIndex]?.sheet.names ?? {})) {
    if (entry.scope === "sheet") out.push({ tabIndex: selfIndex, key, entry });
  }
  tabs.forEach((tab, tabIndex) => {
    for (const [key, entry] of Object.entries(tab.sheet.names ?? {})) {
      if (entry.scope === "sheet" || seen.has(key)) continue;
      seen.add(key);
      out.push({ tabIndex, key, entry });
    }
  });
  return out.sort((a, b) => a.entry.label.localeCompare(b.entry.label, "th"));
}

/** The one a formula on `selfIndex` means by `label`: its own sheet-level name first, as in Excel. */
export function findNameHome(tabs: readonly NamedTab[], selfIndex: number, label: string): NameHome | undefined {
  const key = nameKey(label);
  return visibleNames(tabs, selfIndex).find((h) => h.key === key);
}
