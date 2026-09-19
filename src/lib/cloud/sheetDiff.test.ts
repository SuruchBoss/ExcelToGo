import { describe, expect, it } from "vitest";
import { addRow, createEmptySheet, setCellRaw, SheetModel } from "@/lib/sheet";
import { SheetTab } from "@/store/sheetStore";
import { BULK_LIMIT, diffWorkbook } from "./sheetDiff";

const tab = (id: string, sheet: SheetModel): SheetTab => ({ id, name: id, sheet });
const base = () => createEmptySheet(20, 8);

describe("what one edit looks like from outside", () => {
  it("reports the cell that changed and nothing else", () => {
    const before = base();
    const after = setCellRaw(before, 3, 2, "กาแฟ");
    const diff = diffWorkbook([tab("t1", before)], [tab("t1", after)]);
    expect(diff.cells).toEqual([{ tabId: "t1", row: 3, col: 2, raw: "กาแฟ" }]);
    expect(diff.structural).toEqual([]);
  });

  it("reports a cell that was emptied, which is an edit like any other", () => {
    const before = setCellRaw(base(), 1, 1, "45");
    const after = setCellRaw(before, 1, 1, "");
    expect(diffWorkbook([tab("t1", before)], [tab("t1", after)]).cells).toEqual([
      { tabId: "t1", row: 1, col: 1, raw: "" },
    ]);
  });

  it("says nothing at all when nothing changed", () => {
    const sheet = base();
    const tabs = [tab("t1", sheet)];
    expect(diffWorkbook(tabs, tabs)).toEqual({ cells: [], structural: [] });
    expect(diffWorkbook([tab("t1", sheet)], [tab("t1", sheet)])).toEqual({ cells: [], structural: [] });
  });

  it("picks up an edit on a tab that is not the one in front", () => {
    const a = base();
    const b = base();
    const diff = diffWorkbook([tab("t1", a), tab("t2", b)], [tab("t1", a), tab("t2", setCellRaw(b, 0, 0, "x"))]);
    expect(diff.cells).toEqual([{ tabId: "t2", row: 0, col: 0, raw: "x" }]);
  });

  it("reports every cell of a paste in one go", () => {
    let after = base();
    for (let r = 0; r < 5; r++) after = setCellRaw(after, r, 0, `แถว ${r}`);
    expect(diffWorkbook([tab("t1", base())], [tab("t1", after)]).cells).toHaveLength(5);
  });
});

describe("changes nobody can patch into their own copy", () => {
  it("calls an added row structural, because it moves every cell below it", () => {
    const before = base();
    const diff = diffWorkbook([tab("t1", before)], [tab("t1", addRow(before))]);
    expect(diff.structural).toEqual(["t1"]);
    expect(diff.cells).toEqual([]);
  });

  it("calls a new tab structural", () => {
    expect(diffWorkbook([tab("t1", base())], [tab("t1", base()), tab("t2", base())]).structural).toEqual(["t2"]);
  });

  it("calls a deleted tab structural", () => {
    expect(diffWorkbook([tab("t1", base()), tab("t2", base())], [tab("t1", base())]).structural).toEqual(["t2"]);
  });

  it("gives up on listing cells once a change is clearly an import, not typing", () => {
    // Five hundred cells at once is a paste of a whole table, a pivot rebuild or an import. A
    // reload is cheaper than the list and likelier to be right.
    let after = createEmptySheet(300, 8);
    const before = createEmptySheet(300, 8);
    for (let r = 0; r < BULK_LIMIT + 5; r++) after = setCellRaw(after, r, 0, `${r}`);
    const diff = diffWorkbook([tab("t1", before)], [tab("t1", after)]);
    expect(diff.cells).toEqual([]);
    expect(diff.structural).toEqual(["t1"]);
  });

  it("still lists a change that stops just short of the limit", () => {
    let after = createEmptySheet(300, 8);
    const before = createEmptySheet(300, 8);
    for (let r = 0; r < BULK_LIMIT; r++) after = setCellRaw(after, r, 0, `${r}`);
    expect(diffWorkbook([tab("t1", before)], [tab("t1", after)]).cells).toHaveLength(BULK_LIMIT);
  });
});

describe("what the diff costs", () => {
  it("does not read a row the edit did not touch", () => {
    // Copy-on-write is what makes this affordable: an untouched row is the same array, so the
    // whole sheet costs one pointer comparison per row. If that ever stops being true, this test
    // is where it shows up — it counts how many rows the diff had to look inside.
    const before = createEmptySheet(5_000, 26);
    const after = setCellRaw(before, 4_999, 25, "มุมขวาล่าง");
    let rowsRead = 0;
    const counted: SheetModel = {
      ...after,
      cells: new Proxy(after.cells, {
        get(target, key) {
          if (typeof key === "string" && /^\d+$/.test(key)) rowsRead++;
          return Reflect.get(target, key);
        },
      }),
    };
    const diff = diffWorkbook([tab("t1", before)], [tab("t1", counted)]);
    expect(diff.cells).toEqual([{ tabId: "t1", row: 4_999, col: 25, raw: "มุมขวาล่าง" }]);
    // 5,000 identity checks, and exactly one row read a second time for its 26 cells.
    expect(rowsRead).toBeLessThan(5_100);
  });
});
