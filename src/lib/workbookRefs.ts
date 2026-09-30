// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Formula rewrites that are not a fact about one sheet.
 *
 * `sheet.ts` already adjusts a sheet's own formulas when a row is inserted into it. Once a formula
 * can say `Sheet2!A5`, that is only half the job: the other sheets hold references into the edited
 * one and have to move too, and — the half that is easy to forget — their *unqualified* references
 * must not, because those name the sheet they are written on.
 *
 * Kept out of `sheet.ts` because everything there takes one `SheetModel` and answers with one. The
 * moment a rewrite needs to know what the other tabs are called, it belongs somewhere that knows a
 * workbook exists.
 */
import { shiftNames, type NameTable } from "./namedRanges";
import { sheetRefPrefix, splitSheetRef } from "./formulaEngine/address";
import { tokenize } from "./formulaEngine/tokenizer";
import { adjustFormulaForStructuralOp, Axis } from "./formulaEngine/structuralShift";
import { cloneSheet, SheetModel } from "./sheet";

export interface NamedSheet {
  name: string;
  sheet: SheetModel;
}

const isFormula = (raw: string) => raw.startsWith("=") && raw.length > 1;

/** Runs `rewrite` over every formula body in a sheet, returning the original when nothing changed. */
function mapFormulas(sheet: SheetModel, rewrite: (body: string) => string): SheetModel {
  let next: SheetModel | null = null;
  for (let r = 0; r < sheet.rows; r++) {
    const row = sheet.cells[r];
    if (!row) continue;
    for (let c = 0; c < sheet.cols; c++) {
      const raw = row[c] ?? "";
      if (!isFormula(raw)) continue;
      const body = rewrite(raw.slice(1));
      if (`=${body}` === raw) continue;
      // Copied only once something actually changes, so a workbook of untouched tabs keeps its
      // object identities — which is what the compute cache and the undo history are keyed on.
      next ??= cloneSheet(sheet);
      next.cells[r][c] = `=${body}`;
    }
  }
  return next ?? sheet;
}

/**
 * Adjusts references in **other** sheets after a row or column op in `opSheetName`.
 *
 * The edited sheet is left alone: `insertRowBefore` and friends have already rewritten its own
 * formulas, and doing it twice would move every reference two rows.
 */
export function shiftOtherSheetsForStructuralOp(
  tabs: NamedSheet[],
  opSheetName: string,
  axis: Axis,
  opIndex: number,
  delta: 1 | -1
): SheetModel[] {
  return tabs.map(({ name, sheet }) => {
    if (name.toLowerCase() === opSheetName.toLowerCase()) return sheet;
    const scope = { opSheet: opSheetName, formulaSheet: name };
    const shifted = mapFormulas(sheet, (body) => adjustFormulaForStructuralOp(body, axis, opIndex, delta, scope));
    // A name on this tab can point at the edited one — `ยอดขาย → ข้อมูล!B2:B500` is the whole
    // reason a name may carry a sheet prefix — so the table moves for the same reason the
    // formulas do, and by the same rewriter.
    const names = shiftNames(sheet.names, axis, opIndex, delta, scope);
    if (names === sheet.names) return shifted;
    const next: SheetModel = { ...shifted, names };
    if (!names) delete next.names;
    return next;
  });
}

/**
 * Rewrites every formula that names `from` so it names `to` instead.
 *
 * Renaming a tab would otherwise break every formula pointing at it — the reference is by name,
 * because that is what the text of a formula holds. Excel does the same rewrite silently, and a
 * user who renames "Sheet2" to "ยอดขาย" is not thinking about anyone's formulas.
 */
export function renameSheetInFormulas(tabs: NamedSheet[], from: string, to: string): SheetModel[] {
  if (from.toLowerCase() === to.toLowerCase() && from === to) return tabs.map((t) => t.sheet);
  return tabs.map(({ sheet }) => {
    const rewritten = mapFormulas(sheet, (body) => {
      const tokens = tokenize(body);
      let out = "";
      for (const t of tokens) {
        if (t.type === "EOF") continue;
        // `Sheet!Name` too (#60): a sheet-level name reached from another sheet is by the sheet's name.
        if (t.type === "CELL" || t.type === "RANGE" || (t.type === "NAME" && t.value.includes("!"))) {
          const { sheet: prefix, ref } = splitSheetRef(t.value);
          out += prefix !== null && prefix.toLowerCase() === from.toLowerCase() ? `${sheetRefPrefix(to)}${ref}` : t.value;
          continue;
        }
        // Rebuilt rather than sliced out of the original text: the tokenizer has already dropped
        // whitespace and normalised quoting, so re-emitting is the only way back to valid text.
        out += t.type === "STRING" ? `"${t.value.replace(/"/g, '""')}"` : t.value;
      }
      return out;
    });
    // A name's target is a reference like any other, and one qualified with the old name would
    // point at a sheet that no longer exists.
    const names = renameSheetInNames(rewritten.names, from, to);
    if (names === rewritten.names) return rewritten;
    return { ...rewritten, names };
  });
}

function renameSheetInNames(table: NameTable | undefined, from: string, to: string): NameTable | undefined {
  if (!table) return table;
  let changed = false;
  const next: NameTable = {};
  for (const [key, entry] of Object.entries(table)) {
    const { sheet: prefix, ref } = splitSheetRef(entry.ref);
    if (prefix !== null && prefix.toLowerCase() === from.toLowerCase()) {
      next[key] = { ...entry, ref: `${sheetRefPrefix(to)}${ref}` };
      changed = true;
    } else {
      next[key] = entry;
    }
  }
  return changed ? next : table;
}

/**
 * Makes an incoming workbook's sheets fit beside the ones already open.
 *
 * Opening a file used to replace the whole workbook without a word, and the fix is to let it be
 * added instead — which means two tabs can arrive with the same name. The incoming one is the one
 * renamed ("Sheet1 (2)"), never an existing one, and its own file's formulas that pointed at it
 * follow it, through the same rewrite a manual rename uses. New names avoid every name on both
 * sides, so one rename can never land on a sheet the next rename is about to move.
 */
export function renameIncomingToFit(existingNames: string[], incoming: NamedSheet[]): NamedSheet[] {
  const taken = new Set([...existingNames, ...incoming.map((t) => t.name)].map((n) => n.toLowerCase()));
  const existing = new Set(existingNames.map((n) => n.toLowerCase()));
  let tabs = incoming.map((t) => ({ ...t }));
  for (let i = 0; i < tabs.length; i++) {
    const from = tabs[i].name;
    if (!existing.has(from.toLowerCase())) continue;
    let n = 2;
    let to = "";
    do {
      const suffix = ` (${n++})`;
      // Excel stops a sheet name at 31 characters; the suffix is what has to survive.
      to = from.slice(0, 31 - suffix.length) + suffix;
    } while (taken.has(to.toLowerCase()));
    taken.add(to.toLowerCase());
    const renamed = tabs.map((t, j) => (j === i ? { ...t, name: to } : t));
    const fixed = renameSheetInFormulas(renamed, from, to);
    tabs = renamed.map((t, j) => ({ ...t, sheet: fixed[j] }));
  }
  return tabs;
}
