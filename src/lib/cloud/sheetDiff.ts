/**
 * What changed between two versions of a workbook, cheaply enough to ask on every keystroke.
 *
 * The live layer has to know what the local person just did in order to tell anyone else. The
 * obvious way — have every action that writes a cell also call a broadcast — was tried on paper
 * and rejected: there are a dozen write paths (the grid, the formula bar, paste, fill, the
 * assistant, live data blocks, find-and-replace, the pivot builder), and the one somebody forgets
 * to annotate becomes an edit that silently never reaches the other person. A diff cannot be
 * forgotten.
 *
 * It is cheap because the model is copy-on-write: `setCellRaw` replaces the row it touched and
 * keeps every other row's array by reference. So a diff is one identity comparison per row, and
 * only the rows that actually changed are looked at cell by cell. A 20,000-row sheet with one
 * edited cell costs 20,000 pointer comparisons, which is nothing, and reading 26 strings.
 */
import { SheetModel } from "@/lib/sheet";
import { SheetTab } from "@/store/sheetStore";

export interface CellChange {
  tabId: string;
  row: number;
  col: number;
  raw: string;
}

export interface WorkbookDiff {
  cells: CellChange[];
  /**
   * Tabs whose shape changed, or that changed in more places than are worth sending one by one.
   *
   * Both cases mean the same thing to the other end: stop patching and reload. A row insert moves
   * every cell below it, so the cell messages that describe the result would be read against the
   * old positions; and a change of five hundred cells at once is an import or a pivot rebuild,
   * where a reload is both cheaper and more likely to be right.
   */
  structural: string[];
}

/** More changed cells than this in one step is reported as "reload", not as a list. */
export const BULK_LIMIT = 200;

const EMPTY: WorkbookDiff = { cells: [], structural: [] };

export function diffWorkbook(prev: SheetTab[], next: SheetTab[]): WorkbookDiff {
  if (prev === next) return EMPTY;
  const before = new Map(prev.map((t) => [t.id, t.sheet]));
  const cells: CellChange[] = [];
  const structural: string[] = [];

  for (const tab of next) {
    const old = before.get(tab.id);
    before.delete(tab.id);
    // A tab that has just appeared is not an edit anyone can patch into their copy.
    if (!old) {
      structural.push(tab.id);
      continue;
    }
    if (old === tab.sheet) continue;
    if (old.rows !== tab.sheet.rows || old.cols !== tab.sheet.cols) {
      structural.push(tab.id);
      continue;
    }
    const changed = diffSheet(tab.id, old, tab.sheet, cells);
    if (!changed) structural.push(tab.id);
  }

  // Anything left in `before` is a tab that was deleted.
  for (const id of before.keys()) structural.push(id);
  return cells.length === 0 && structural.length === 0 ? EMPTY : { cells, structural };
}

/** False when the sheet changed in more places than are worth sending one by one. */
function diffSheet(tabId: string, prev: SheetModel, next: SheetModel, into: CellChange[]): boolean {
  const start = into.length;
  for (let r = 0; r < next.rows; r++) {
    const before = prev.cells[r];
    const after = next.cells[r];
    // Copy-on-write: an untouched row is the same array, and this is the comparison that makes
    // the whole diff affordable.
    if (before === after) continue;
    for (let c = 0; c < next.cols; c++) {
      const was = before?.[c] ?? "";
      const now = after?.[c] ?? "";
      if (was === now) continue;
      if (into.length - start >= BULK_LIMIT) {
        into.length = start;
        return false;
      }
      into.push({ tabId, row: r, col: c, raw: now });
    }
  }
  // A change that is not in the grid at all — formatting, a chart, a comment — produces no cell
  // messages. Those are not synced live; see the README on what this feature does and does not do.
  return true;
}
