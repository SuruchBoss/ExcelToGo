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
    return mapFormulas(sheet, (body) =>
      adjustFormulaForStructuralOp(body, axis, opIndex, delta, { opSheet: opSheetName, formulaSheet: name })
    );
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
