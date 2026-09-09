export interface SelectionRect {
  anchorRow: number;
  anchorCol: number;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export function singleCellSelection(row: number, col: number): SelectionRect {
  return { anchorRow: row, anchorCol: col, startRow: row, startCol: col, endRow: row, endCol: col };
}

export function normalizeSelection(a: { row: number; col: number }, b: { row: number; col: number }): SelectionRect {
  return {
    anchorRow: a.row,
    anchorCol: a.col,
    startRow: Math.min(a.row, b.row),
    startCol: Math.min(a.col, b.col),
    endRow: Math.max(a.row, b.row),
    endCol: Math.max(a.col, b.col),
  };
}

export function isSingleCell(sel: SelectionRect): boolean {
  return sel.startRow === sel.endRow && sel.startCol === sel.endCol;
}
