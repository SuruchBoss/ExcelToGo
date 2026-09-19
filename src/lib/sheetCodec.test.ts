import { describe, expect, it } from "vitest";
import { createEmptySheet, setCellRaw, SheetModel } from "./sheet";
import { fromStorage, isPacked, packSheet, toStorage, unpackSheet } from "./sheetCodec";
import { rescueSheets } from "./crashRescue";
import { ruleAt, withValidation } from "./dataValidation";

/** The size of what would actually be written, which is the number the ceiling is made of. */
const storedKb = (sheet: SheetModel) =>
  JSON.stringify({ state: { sheets: [{ id: "a", name: "Sheet1", sheet: toStorage(sheet) }] } }).length / 1024;

function sheetWith(rows: number, cols: number, cells: [number, number, string][] = []): SheetModel {
  let sheet = createEmptySheet(rows, cols);
  for (const [r, c, raw] of cells) sheet = setCellRaw(sheet, r, c, raw);
  return sheet;
}

describe("what a sheet costs to store", () => {
  it("costs what was typed, not what the sheet is sized to", () => {
    // The measurement that made this module exist: dense, a 20,000-row sheet holding one value
    // serialised to 4,141 KB against a browser's ~5 MB quota, on every keystroke. The dimensions
    // set the ceiling; the content had nothing to do with it.
    const small = storedKb(sheetWith(30, 10, [[0, 0, "ยอดขาย"]]));
    const huge = storedKb(sheetWith(20_000, 26, [[0, 0, "ยอดขาย"]]));

    expect(huge).toBeLessThan(5);
    expect(huge - small).toBeLessThan(1);
  });

  it("grows with the number of filled cells, which is the honest thing to charge for", () => {
    const one = storedKb(sheetWith(1000, 26, [[0, 0, "ก"]]));
    const many = storedKb(sheetWith(1000, 26, Array.from({ length: 500 }, (_, i) => [i, 0, `แถว ${i}`] as [number, number, string])));
    expect(many).toBeGreaterThan(one * 5);
  });
});

describe("packing and unpacking", () => {
  it("brings back every cell that had something in it", () => {
    const sheet = sheetWith(50, 8, [
      [0, 0, "ชื่อ"],
      [0, 1, "ยอด"],
      [7, 3, "=SUM(B1:B5)"],
      [49, 7, "มุมขวาล่าง"],
    ]);
    const back = unpackSheet(packSheet(sheet));

    expect(back.rows).toBe(50);
    expect(back.cols).toBe(8);
    expect(back.cells[0][0]).toBe("ชื่อ");
    expect(back.cells[7][3]).toBe("=SUM(B1:B5)");
    expect(back.cells[49][7]).toBe("มุมขวาล่าง");
    expect(back.cells[1][1]).toBe("");
  });

  it("keeps formatting, and stores nothing for a format object that says nothing", () => {
    const sheet = sheetWith(5, 5, [[1, 1, "x"]]);
    sheet.formats[1][1] = { bold: true };
    sheet.formats[2][2] = {};

    const packed = packSheet(sheet);
    expect(Object.keys(packed.formats ?? {})).toEqual(["1,1"]);
    expect(unpackSheet(packed).formats[1][1]).toEqual({ bold: true });
  });

  it("carries everything else through untouched", () => {
    const sheet = sheetWith(6, 6, [[0, 0, "x"]]);
    sheet.merges = [{ startRow: 0, startCol: 0, endRow: 1, endCol: 1 }];
    sheet.comments = { "0,0": "โน้ต" };
    sheet.colWidths = [120, undefined, 80];

    const back = unpackSheet(packSheet(sheet));
    expect(back.merges).toEqual(sheet.merges);
    expect(back.comments).toEqual(sheet.comments);
    expect(back.colWidths).toEqual(sheet.colWidths);
  });
});

describe("what is already in someone's browser", () => {
  it("still loads a sheet saved in the old dense shape", () => {
    // The release that packs sheets must not lose the work of anyone who saved before it. Their
    // storage holds arrays; `fromStorage` has to recognise that and hand it back unchanged.
    const dense = sheetWith(4, 3, [[0, 0, "เดิม"], [2, 1, "ค่า"]]);
    const asStored = JSON.parse(JSON.stringify(dense)) as SheetModel;

    expect(isPacked(asStored)).toBe(false);
    const back = fromStorage(asStored);
    expect(back.cells[0][0]).toBe("เดิม");
    expect(back.cells[2][1]).toBe("ค่า");
  });

  it("recognises the new shape as the new shape", () => {
    expect(isPacked(toStorage(sheetWith(3, 3)))).toBe(true);
  });

  it("rescues from either shape after a crash", () => {
    // `crashRescue.ts` reads storage directly and imports neither the store nor this module, so
    // the two formats have to be handled there as well. A rescue that reports "nothing to
    // rescue" over a full sheet is the worst failure that path has.
    const sheet = sheetWith(3, 2, [[0, 0, "สินค้า"], [1, 0, "กาแฟ"], [1, 1, "45"]]);
    for (const stored of [sheet, toStorage(sheet)]) {
      const json = JSON.stringify({ state: { sheets: [{ id: "a", name: "ยอดขาย", sheet: stored }] } });
      const [rescued] = rescueSheets(json);
      expect(rescued?.csv).toContain("กาแฟ");
      expect(rescued?.csv).toContain("45");
    }
  });
});

describe("storage that is not what it should be", () => {
  it("ignores a key that is not a cell position", () => {
    const back = unpackSheet({ rows: 3, cols: 3, cells: { "0,0": "ok", nonsense: "x", "-1,2": "y", "1,": "z" } });
    expect(back.cells[0][0]).toBe("ok");
    expect(back.rows).toBe(3);
  });

  it("grows the sheet rather than dropping a cell that lands outside it", () => {
    // A truncated or hand-edited save can disagree with itself. Losing the value quietly is the
    // one outcome worth extra code to avoid.
    const back = unpackSheet({ rows: 2, cols: 2, cells: { "9,4": "ไกลไปหน่อย" } });
    expect(back.rows).toBe(10);
    expect(back.cols).toBe(5);
    expect(back.cells[9][4]).toBe("ไกลไปหน่อย");
  });

  it("returns a usable sheet for a packed object with nothing in it", () => {
    const back = unpackSheet({ rows: 0, cols: 0, cells: {} });
    expect(back.rows).toBeGreaterThan(0);
    expect(back.cols).toBeGreaterThan(0);
  });
});

describe("rules on what can be typed survive a save", () => {
  it("comes back the same object after a pack and unpack", () => {
    // `rest` carries it without naming it, which is exactly why this test exists: nothing in the
    // codec mentions validation, so nothing in the codec would fail if it stopped travelling.
    const sheet = withValidation(createEmptySheet(10, 5), { startRow: 0, startCol: 0, endRow: 2, endCol: 0 }, {
      kind: "list",
      values: ["ก", "ข"],
    });
    const back = unpackSheet(JSON.parse(JSON.stringify(packSheet(sheet))));
    expect(ruleAt(back, 2, 0)).toEqual({ kind: "list", values: ["ก", "ข"] });
  });
});
