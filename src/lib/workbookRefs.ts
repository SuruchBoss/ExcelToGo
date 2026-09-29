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
import { shiftNames } from "./namedRanges";
import { sheetRefPrefix, splitSheetRef } from "./formulaEngine/address";
import { tokenize } from "./formulaEngine/tokenizer";
import { adjustFormulaForStructuralOp, Axis } from "./formulaEngine/structuralShift";
import { cloneSheet, SheetModel } from "./sheet";
import { cleanSheetName, sheetNameProblem, uniqueSheetName } from "./sheetNames";

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
  return tabs.map(({ sheet }) =>
    mapFormulas(sheet, (body) => {
      const tokens = tokenize(body);
      let out = "";
      for (const t of tokens) {
        if (t.type === "EOF") continue;
        if (t.type === "CELL" || t.type === "RANGE") {
          const { sheet: prefix, ref } = splitSheetRef(t.value);
          out += prefix !== null && prefix.toLowerCase() === from.toLowerCase() ? `${sheetRefPrefix(to)}${ref}` : t.value;
          continue;
        }
        // Rebuilt rather than sliced out of the original text: the tokenizer has already dropped
        // whitespace and normalised quoting, so re-emitting is the only way back to valid text.
        out += t.type === "STRING" ? `"${t.value.replace(/"/g, '""')}"` : t.value;
      }
      return out;
    })
  );
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

/**
 * Gives every tab a name Excel accepts, unique ignoring case (#54), rewriting the formulas that
 * follow a renamed tab.
 *
 * For workbooks that already hold names the app used to allow: a save in the browser, or a file
 * whose names came from somewhere other than Excel. Two rules decide what moves:
 *
 * - **The first tab keeps a duplicated name.** It is the one the name was made for — QA's second
 *   "Sheet3" appeared when a new tab was counted into a name already in use — so formulas that
 *   say `Sheet3!A1` go on meaning the first, and the later tab is renamed *without* rewriting
 *   anything. (The resolver used to let the later tab win, which is how the new tab's 999 turned
 *   up in a formula written for the old one.)
 * - **An invalid name that is not a duplicate is renamed together with its formulas**, through
 *   the same rewrite a manual rename uses: `'Q1/Q2'!A1` becomes `'Q1 Q2'!A1`.
 *
 * Returns the same array when nothing needed fixing, so a clean workbook costs nothing and keeps
 * every object identity the compute cache and undo history are keyed on.
 */
export function fitSheetNames<T extends NamedSheet>(tabs: T[]): T[] {
  const claimed = new Set<string>();
  const keeps = tabs.map((t) => {
    const key = t.name.toLowerCase();
    const fine = sheetNameProblem(t.name, []) === null && t.name === t.name.trim() && !claimed.has(key);
    claimed.add(key);
    return fine;
  });
  if (keeps.every(Boolean)) return tabs;

  const taken = new Set(tabs.filter((_, i) => keeps[i]).map((t) => t.name.toLowerCase()));
  const originals = tabs.map((t) => t.name.toLowerCase());
  let out = tabs.map((t) => ({ ...t }));
  for (let i = 0; i < out.length; i++) {
    if (keeps[i]) continue;
    const from = out[i].name;
    const to = uniqueSheetName(cleanSheetName(from), taken);
    taken.add(to.toLowerCase());
    out[i] = { ...out[i], name: to };
    const duplicate = originals.slice(0, i).includes(from.toLowerCase());
    if (duplicate) continue;
    const fixed = renameSheetInFormulas(out, from, to);
    out = out.map((t, j) => (fixed[j] === t.sheet ? t : { ...t, sheet: fixed[j] }));
  }
  return out;
}
