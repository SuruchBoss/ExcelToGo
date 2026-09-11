/**
 * Templates that come out of an imported .xlsx.
 *
 * A spreadsheet built as a form already says which cells people are meant to fill in — Excel's
 * model is that every cell is "locked" by default and that flag only bites once the *sheet* is
 * protected, so whoever built the template deliberately unlocked the input cells. Reading that
 * back gives the template concept for free: the fixed structure stays fixed, the input cells stay
 * open, and nobody has to redraw the form or mark anything up by hand.
 *
 * `SheetModel.template` exists only while that protection is in force. Turning it off deletes the
 * whole object rather than flipping a flag, so there is never a stale set of "r,c" keys pointing at
 * rows that have since moved.
 */

/** Key into `inputs` / `choices`. */
export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export interface SheetTemplate {
  /** Cells the template leaves open for typing. Everything else is fixed structure. */
  inputs: Record<string, true>;
  /** Allowed values for input cells that carried an Excel dropdown (data validation list). */
  choices: Record<string, string[]>;
}

/** A cell is fixed when a template is in force and it isn't one of the template's input cells. */
export function isTemplateLocked(template: SheetTemplate | undefined, row: number, col: number): boolean {
  return template !== undefined && template.inputs[cellKey(row, col)] !== true;
}

export function templateChoices(template: SheetTemplate | undefined, row: number, col: number): string[] | undefined {
  return template?.choices[cellKey(row, col)];
}

export function inputCount(template: SheetTemplate | undefined): number {
  return template ? Object.keys(template.inputs).length : 0;
}

/**
 * Reads an Excel data-validation list into plain options.
 *
 * The `formulae` entry is either an inline quoted list (`"ด่วน,ปกติ,ประหยัด"`) or a reference to a
 * range holding the options (`$E$1:$E$5`). Only the inline form can be resolved without the sheet,
 * so `readRange` is handed the reference for the caller to look up — a template whose dropdown
 * points at a lookup column is common enough that dropping it would be a real loss.
 */
export function parseValidationList(
  formulae: unknown[] | undefined,
  readRange?: (ref: string) => string[]
): string[] | undefined {
  const raw = formulae?.[0];
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const text = raw.trim();

  // [\s\S] rather than the `s` flag, which the project's TS target predates.
  const quoted = /^"([\s\S]*)"$/.exec(text);
  if (quoted) {
    const options = quoted[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    return options.length > 0 ? options : undefined;
  }

  if (readRange) {
    const options = readRange(text.replace(/^=/, "")).filter((s) => s.trim() !== "");
    if (options.length > 0) return options;
  }
  return undefined;
}

/** Excel column widths are in "characters"; this is the conversion Excel itself documents. */
export function excelWidthToPx(width: number | undefined): number | undefined {
  if (width === undefined || !Number.isFinite(width) || width <= 0) return undefined;
  return Math.min(Math.max(Math.round(width * 7 + 5), 40), 400);
}

export function pxToExcelWidth(px: number | undefined): number | undefined {
  if (px === undefined || !Number.isFinite(px) || px <= 0) return undefined;
  return Math.round(((px - 5) / 7) * 100) / 100;
}

/** True when any cell in the rectangle is part of the template's fixed structure. Used to refuse
 *  whole-range operations (paste, clear, sort) that would quietly overwrite the form. */
export function rangeHasLockedCells(
  template: SheetTemplate | undefined,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): boolean {
  if (!template) return false;
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      if (isTemplateLocked(template, r, c)) return true;
    }
  }
  return false;
}
