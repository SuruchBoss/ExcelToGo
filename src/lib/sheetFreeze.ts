import { SheetModel } from "./sheet";

/**
 * Rows and columns that stay put while the rest scrolls.
 *
 * The grid has always had a sticky header row and a sticky column of row numbers, which is a
 * different thing: those are the *chrome*. This is the sheet's own first rows and columns — the
 * ones holding "Item", "Price", "Branch" — staying visible at row four thousand, which is the
 * difference between a long sheet you can read and one you scroll blind.
 *
 * Stored on the model rather than in view state, for three reasons that all point the same way:
 * it survives a reload, it goes into the undo history with everything else, and `.xlsx` has a
 * place for it, so a file that arrives frozen opens frozen.
 */
export interface FreezePanes {
  /** How many rows from the top stay put. 0 means none. */
  rows: number;
  cols: number;
}

export const NO_FREEZE: FreezePanes = { rows: 0, cols: 0 };

export const isFrozen = (freeze: FreezePanes | undefined): freeze is FreezePanes =>
  freeze !== undefined && (freeze.rows > 0 || freeze.cols > 0);

/**
 * Keeps a split inside the sheet, and refuses one that would freeze all of it.
 *
 * Freezing every row is not a smaller version of freezing three — it is a sheet that cannot
 * scroll, which looks exactly like a bug. Excel refuses it too.
 */
export function clampFreeze(sheet: SheetModel, freeze: FreezePanes): FreezePanes {
  return {
    rows: Math.max(0, Math.min(Math.trunc(freeze.rows), Math.max(0, sheet.rows - 1))),
    cols: Math.max(0, Math.min(Math.trunc(freeze.cols), Math.max(0, sheet.cols - 1))),
  };
}

/** Sets the split, dropping the field entirely when there is nothing frozen. */
export function withFreeze(sheet: SheetModel, freeze: FreezePanes): SheetModel {
  const wanted = clampFreeze(sheet, freeze);
  if (!isFrozen(wanted)) {
    if (!sheet.freeze) return sheet;
    const next = { ...sheet };
    delete next.freeze;
    return next;
  }
  const at = sheet.freeze;
  if (at && at.rows === wanted.rows && at.cols === wanted.cols) return sheet;
  return { ...sheet, freeze: wanted };
}

/**
 * Excel's "Freeze Panes": everything above and to the left of the cursor.
 *
 * Standing on B3 freezes two rows and one column. Pressing it again unfreezes, because a button
 * that only ever adds is a button people press once and then go looking for the other one.
 */
export function toggleFreezeAt(sheet: SheetModel, row: number, col: number): SheetModel {
  if (isFrozen(sheet.freeze)) return withFreeze(sheet, NO_FREEZE);
  return withFreeze(sheet, { rows: row, cols: col });
}

/**
 * Moves the split when rows or columns are inserted or removed above or left of it.
 *
 * A header row that has had a row inserted above it is still the header row, and a split that
 * stayed on its old index would cut the sheet in the wrong place — quietly, since nothing about
 * the screen says which row the split is *supposed* to be.
 */
export function shiftFreeze(sheet: SheetModel, axis: "row" | "col", at: number, delta: 1 | -1): SheetModel {
  const freeze = sheet.freeze;
  if (!isFrozen(freeze)) return sheet;
  const count = axis === "row" ? freeze.rows : freeze.cols;
  // A change at or after the split leaves the frozen block alone; only what is above it moves it.
  if (at >= count) return sheet;
  const moved = Math.max(0, count + delta);
  return withFreeze(sheet, axis === "row" ? { ...freeze, rows: moved } : { ...freeze, cols: moved });
}
