import { describe, expect, it } from "vitest";
import { packCell } from "./formulaEngine/formulaProgram";
import { MAX_HIGHLIGHT, precedentsOf } from "./precedents";

const has = (raw: string, row: number, col: number) => precedentsOf(raw).cells.has(packCell(row, col));

describe("what a formula is about", () => {
  it("finds a single cell", () => {
    expect(has("=A1*2", 0, 0)).toBe(true);
    expect(has("=A1*2", 1, 0)).toBe(false);
  });

  it("fills in a range, so every cell in it can be drawn", () => {
    const { cells } = precedentsOf("=SUM(B2:B5)");
    expect(cells.size).toBe(4);
    expect(cells.has(packCell(1, 1))).toBe(true);
    expect(cells.has(packCell(4, 1))).toBe(true);
    expect(cells.has(packCell(5, 1))).toBe(false);
  });

  it("finds every argument, not just the first", () => {
    // The bug this feature is for: `C2:C4` and `C2:D4` differ by one character and both compute.
    const { cells } = precedentsOf('=SUMIF(B2:B4,"เหนือ",D2:D4)');
    expect(cells.has(packCell(1, 1))).toBe(true);
    expect(cells.has(packCell(3, 3))).toBe(true);
  });

  it("reaches through arithmetic and nested calls", () => {
    expect(has("=IF(A1>0,SUM(C1:C2),-B7)", 6, 1)).toBe(true);
    expect(has("=IF(A1>0,SUM(C1:C2),-B7)", 1, 2)).toBe(true);
  });

  it("keeps the ranges as written, so an outline can be drawn round each", () => {
    expect(precedentsOf("=SUM(B2:B5)").ranges).toEqual([{ startRow: 1, startCol: 1, endRow: 4, endCol: 1 }]);
  });
});

describe("what it refuses to draw", () => {
  it("says nothing about a cell that is not a formula", () => {
    for (const raw of ["", "45", "กาแฟ", "  =A1"]) expect(precedentsOf(raw).cells.size).toBe(0);
  });

  it("says nothing about a formula that does not parse", () => {
    // `#SYNTAX!` on screen is already telling the person what they need to know.
    expect(precedentsOf("=SUM(").cells.size).toBe(0);
  });

  it("drops a reference to another sheet rather than colouring the same address here", () => {
    // `compileFormula` flattens `Sheet2!A1` into the same key as a local `A1`, because the graph
    // only needs to know *that* a formula is stale. Colouring A1 on this sheet for it would be a
    // lie told confidently.
    const here = precedentsOf("=Sheet2!A1+B1");
    expect(here.cells.has(packCell(0, 0))).toBe(false);
    expect(here.cells.has(packCell(0, 1))).toBe(true);
    expect(here.elsewhere).toBe(true);
  });

  it("gives up on a range too large to mean anything", () => {
    // Outlining a million cells is not information; it is the screen turning one colour.
    const whole = precedentsOf("=SUM(A1:A100000)");
    expect(whole.tooMany).toBe(true);
    expect(whole.cells.size).toBe(0);
    expect(whole.ranges).toHaveLength(1);
  });

  it("measures a range before building it, not after", () => {
    // Counted first, so a whole-column reference does not allocate a million-entry Set on the way
    // to deciding it was too big to draw. A timing test rather than a behaviour one, which is why
    // it is loose: the failure it guards against is seconds, not milliseconds.
    const started = performance.now();
    expect(precedentsOf("=SUM(A1:Z1000000)").tooMany).toBe(true);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it("draws a range right up to the limit", () => {
    const edge = precedentsOf(`=SUM(A1:A${MAX_HIGHLIGHT})`);
    expect(edge.tooMany).toBe(false);
    expect(edge.cells.size).toBe(MAX_HIGHLIGHT);
  });
});
