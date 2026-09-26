// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { exportWorkbookToXlsxBlob, importWorkbookFromFile } from "./excelIO";
import { computeSheet, createEmptySheet, createWorkbookResolver, setCellRaw, SheetModel } from "./sheet";
import { evaluateConditionalFormats } from "./conditionalFormat";
import { cellKey } from "./sheetTemplate";
import { withFreeze } from "./sheetFreeze";
import { ruleAt, withValidation } from "./dataValidation";
import { withName } from "./namedRanges";

/** Builds a real .xlsx in memory the way someone would hand-build a form in Excel. */
async function templateFile(opts: { protect?: boolean } = {}): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("ใบเสนอราคา");
  ws.getCell("A1").value = "ใบเสนอราคา";
  ws.getCell("A1").font = { bold: true };
  ws.getCell("A3").value = "ลูกค้า";
  ws.getCell("A4").value = "ความเร่งด่วน";
  ws.getCell("A5").value = "ยอดก่อนภาษี";
  ws.getCell("A6").value = "ยอดรวม";
  ws.getCell("B5").value = 1000;
  ws.getCell("B6").value = { formula: "B5*1.07", result: 1070 };
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 18;

  for (const addr of ["B3", "B4", "B5"]) ws.getCell(addr).protection = { locked: false };
  ws.getCell("B4").dataValidation = { type: "list", allowBlank: true, formulae: ['"ด่วน,ปกติ,ประหยัด"'] };
  if (opts.protect !== false) await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });

  const buf = await wb.xlsx.writeBuffer();
  return new File([buf], "quote.xlsx");
}

async function readBack(blob: Blob): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  return wb.worksheets[0];
}

function exportable(sheet: SheetModel, name = "ใบเสนอราคา") {
  return [{ name, sheet, computed: computeSheet(sheet) }];
}

describe("importing a template .xlsx", () => {
  it("marks the unlocked cells as the fields to fill in", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await templateFile());

    expect(sheet.template).toBeDefined();
    expect(Object.keys(sheet.template!.inputs).sort()).toEqual([cellKey(2, 1), cellKey(3, 1), cellKey(4, 1)].sort());
  });

  it("carries the dropdown options across", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await templateFile());
    expect(sheet.template!.choices[cellKey(3, 1)]).toEqual(["ด่วน", "ปกติ", "ประหยัด"]);
  });

  it("keeps column widths so the form still looks like the form", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await templateFile());
    expect(sheet.colWidths?.[0]).toBeGreaterThan(sheet.colWidths![1]!);
    expect(sheet.colWidths?.[0]).toBe(24 * 7 + 5);
  });

  it("still keeps the original formulas and formatting", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await templateFile());
    expect(sheet.cells[5][1]).toBe("=B5*1.07");
    expect(sheet.formats[0][0]?.bold).toBe(true);
  });

  it("treats an unprotected file as an ordinary sheet, not a template", async () => {
    // Without sheet protection the locked flags are inert in Excel too, so honouring them here
    // would lock a user out of a file Excel itself lets them edit freely.
    const [{ sheet }] = await importWorkbookFromFile(await templateFile({ protect: false }));
    expect(sheet.template).toBeUndefined();
  });
});

describe("exporting a template back to .xlsx", () => {
  it("re-protects the sheet and re-opens exactly the same cells", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await templateFile());
    const ws = await readBack(await exportWorkbookToXlsxBlob(exportable(sheet)));

    expect((ws as unknown as { sheetProtection?: { sheet?: boolean } }).sheetProtection?.sheet).toBe(true);
    expect(ws.getCell("B3").protection?.locked).toBe(false);
    expect(ws.getCell("B4").protection?.locked).toBe(false);
    expect(ws.getCell("A1").protection?.locked).not.toBe(false);
  });

  it("re-attaches the dropdown", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await templateFile());
    const ws = await readBack(await exportWorkbookToXlsxBlob(exportable(sheet)));

    const dv = ws.getCell("B4").dataValidation;
    expect(dv?.type).toBe("list");
    expect(dv?.formulae?.[0]).toBe('"ด่วน,ปกติ,ประหยัด"');
  });

  it("survives a full import → export → import cycle unchanged", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await templateFile());
    const blob = await exportWorkbookToXlsxBlob(exportable(sheet));
    const [{ sheet: again }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx"));

    expect(again.template?.inputs).toEqual(sheet.template!.inputs);
    expect(again.template?.choices).toEqual(sheet.template!.choices);
    expect(again.colWidths?.slice(0, 2)).toEqual(sheet.colWidths?.slice(0, 2));
    expect(again.cells[5][1]).toBe("=B5*1.07");
  });

  it("leaves a plain sheet unprotected", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await templateFile({ protect: false }));
    const ws = await readBack(await exportWorkbookToXlsxBlob(exportable(sheet)));
    expect((ws as unknown as { sheetProtection?: { sheet?: boolean } }).sheetProtection?.sheet).not.toBe(true);
  });
});

/** A file that leans on looks rather than protection: a coloured title band, big text, borders,
 *  a taller header row. This is what "open it and it looks the same" has to survive. */
async function styledFile(): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("รายงาน");
  ws.mergeCells("A1:D1");
  ws.getCell("A1").value = "รายงานยอดขายประจำเดือน";
  ws.getCell("A1").font = { bold: true, size: 20, color: { argb: "FFFFFFFF" }, italic: true, underline: true };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F6FEB" } };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 36;

  ws.getCell("A3").value = "สินค้า";
  ws.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FE" } };
  ws.getCell("A3").border = { top: { style: "thin" }, bottom: { style: "medium", color: { argb: "FFFF0000" } } };
  ws.getCell("A4").value = "กาแฟ";

  const buf = await wb.xlsx.writeBuffer();
  return new File([buf], "report.xlsx");
}

describe("importing a styled .xlsx", () => {
  it("keeps the coloured band and the big text of a title", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await styledFile());
    const title = sheet.formats[0][0]!;

    expect(title.fill).toBe("#1f6feb");
    expect(title.fontSize).toBe(20);
    expect(title.bold).toBe(true);
    expect(title.italic).toBe(true);
    expect(title.underline).toBe(true);
    expect(title.color).toBe("#ffffff");
    expect(title.align).toBe("center");
    expect(title.valign).toBe("middle");
  });

  it("keeps the merge that makes a title a band rather than one cell", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await styledFile());
    expect(sheet.merges).toEqual([{ startRow: 0, startCol: 0, endRow: 0, endCol: 3 }]);
  });

  it("keeps borders, with the colour the file gave them", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await styledFile());
    expect(sheet.formats[2][0]?.borders?.bottom).toBe("#ff0000");
    expect(sheet.formats[2][0]?.borders?.top).toBeDefined();
    expect(sheet.formats[2][0]?.borders?.left).toBeUndefined();
  });

  it("keeps a taller header row", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await styledFile());
    expect(sheet.rowHeights?.[0]).toBe(48); // 36pt at 96dpi
    expect(sheet.rowHeights?.[3]).toBeUndefined();
  });

  it("doesn't stamp a font size on cells that use Excel's default", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await styledFile());
    expect(sheet.formats[3][0]?.fontSize).toBeUndefined();
  });
});

describe("exporting a styled sheet", () => {
  it("writes the fill, size and merge back", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await styledFile());
    const ws = await readBack(await exportWorkbookToXlsxBlob(exportable(sheet, "รายงาน")));

    expect(ws.getCell("A1").fill).toMatchObject({ type: "pattern", fgColor: { argb: "FF1F6FEB" } });
    expect(ws.getCell("A1").font?.size).toBe(20);
    expect(ws.model?.merges).toContain("A1:D1");
  });

  it("survives a full import → export → import cycle", async () => {
    const [{ sheet }] = await importWorkbookFromFile(await styledFile());
    const blob = await exportWorkbookToXlsxBlob(exportable(sheet, "รายงาน"));
    const [{ sheet: again }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx"));

    expect(again.formats[0][0]?.fill).toBe(sheet.formats[0][0]?.fill);
    expect(again.formats[0][0]?.fontSize).toBe(20);
    expect(again.merges).toEqual(sheet.merges);
    expect(again.rowHeights?.[0]).toBe(sheet.rowHeights?.[0]);
    expect(again.formats[2][0]?.borders?.bottom).toBe("#ff0000");
  });
});

describe("conditional formatting round-trip", () => {
  /** A plain sheet carrying one rule of each kind we claim to support. */
  function ruledSheet(): SheetModel {
    const sheet = createEmptySheet(6, 3);
    for (let r = 0; r < 6; r++) sheet.cells[r][0] = String((r + 1) * 10);
    sheet.cells[0][1] = "กรุงเทพ";
    sheet.conditionalRules = [
      { id: "a", range: { startRow: 0, startCol: 0, endRow: 5, endCol: 0 }, test: { kind: "compare", op: "gt", value: 30 }, style: { fill: "#fee2e2", color: "#991b1b", bold: true } },
      { id: "b", range: { startRow: 0, startCol: 1, endRow: 5, endCol: 1 }, test: { kind: "textContains", text: "กรุงเทพ" }, style: { fill: "#dbeafe" } },
      { id: "c", range: { startRow: 0, startCol: 0, endRow: 5, endCol: 0 }, test: { kind: "rank", bottom: false, count: 2 }, style: { fill: "#dcfce7" } },
      { id: "d", range: { startRow: 0, startCol: 2, endRow: 5, endCol: 2 }, test: { kind: "colorScale", min: "#fca5a5", mid: "#fde68a", max: "#86efac" } },
      { id: "e", range: { startRow: 0, startCol: 2, endRow: 5, endCol: 2 }, test: { kind: "dataBar", color: "#6ee7b7" } },
    ];
    return sheet;
  }

  it("writes one Excel rule per rule, with the ranges intact", async () => {
    const ws = await readBack(await exportWorkbookToXlsxBlob(exportable(ruledSheet(), "ยอดขาย")));
    const cfs = (ws as unknown as { conditionalFormattings: { ref: string; rules: { type: string }[] }[] }).conditionalFormattings;

    expect(cfs).toHaveLength(5);
    expect(cfs.map((c) => c.rules[0].type)).toEqual(["cellIs", "containsText", "top10", "colorScale", "dataBar"]);
    expect(cfs[0].ref).toBe("A1:A6");
    expect(cfs[1].ref).toBe("B1:B6");
  });

  it("keeps operators Excel's own typings leave out, like ≥", async () => {
    const sheet = createEmptySheet(3, 1);
    sheet.conditionalRules = [
      { id: "a", range: { startRow: 0, startCol: 0, endRow: 2, endCol: 0 }, test: { kind: "compare", op: "gte", value: 5 }, style: { fill: "#fee2e2" } },
    ];
    const blob = await exportWorkbookToXlsxBlob(exportable(sheet, "s"));
    const [{ sheet: again }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx"));

    expect(again.conditionalRules?.[0].test).toEqual({ kind: "compare", op: "gte", value: 5, value2: undefined });
  });

  it("survives import → export → import with every rule's meaning unchanged", async () => {
    const blob = await exportWorkbookToXlsxBlob(exportable(ruledSheet(), "ยอดขาย"));
    const [{ sheet: again }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx"));

    const tests = (again.conditionalRules ?? []).map((r) => r.test);
    expect(tests).toContainEqual({ kind: "compare", op: "gt", value: 30, value2: undefined });
    expect(tests).toContainEqual({ kind: "textContains", text: "กรุงเทพ" });
    expect(tests).toContainEqual({ kind: "rank", bottom: false, count: 2 });
    expect(tests).toContainEqual({ kind: "colorScale", min: "#fca5a5", mid: "#fde68a", max: "#86efac" });
    expect(tests).toContainEqual({ kind: "dataBar", color: "#6ee7b7" });
  });

  it("brings the highlight colours back, not just the conditions", async () => {
    const blob = await exportWorkbookToXlsxBlob(exportable(ruledSheet(), "ยอดขาย"));
    const [{ sheet: again }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx"));

    const compare = (again.conditionalRules ?? []).find((r) => r.test.kind === "compare");
    expect(compare?.style).toEqual({ fill: "#fee2e2", color: "#991b1b", bold: true });
  });

  it("re-evaluates to the same highlighted cells after the round-trip", async () => {
    const before = ruledSheet();
    const blob = await exportWorkbookToXlsxBlob(exportable(before, "ยอดขาย"));
    const [{ sheet: after }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx"));

    // Import pads a sheet out to a minimum size, so compare only the region that held data —
    // otherwise the assertion fails on the blank padding rather than on any rule.
    const evalOf = (s: SheetModel) =>
      evaluateConditionalFormats(s.conditionalRules, computeSheet(s).values, s.rows, s.cols)
        .slice(0, 6)
        .map((row) => row.slice(0, 3).map((v) => v?.fill ?? ""));
    expect(evalOf(after)).toEqual(evalOf(before));
  });

  it("leaves a sheet with no rules free of conditional formatting", async () => {
    const ws = await readBack(await exportWorkbookToXlsxBlob(exportable(createEmptySheet(3, 3), "ว่าง")));
    const cfs = (ws as unknown as { conditionalFormattings: unknown[] }).conditionalFormattings;
    expect(cfs).toHaveLength(0);
  });
});

describe("cell comments through a round-trip", () => {
  function notedSheet(): SheetModel {
    const sheet = createEmptySheet(4, 3);
    sheet.cells[1][1] = "1200";
    sheet.comments = { "1,1": "รอบัญชียืนยันอีกที", "0,0": "หัวตาราง" };
    return sheet;
  }

  it("writes a note onto the cell and reads it back", async () => {
    const blob = await exportWorkbookToXlsxBlob(exportable(notedSheet(), "มีโน้ต"));
    const [{ sheet: again }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx"));
    expect(again.comments?.["1,1"]).toBe("รอบัญชียืนยันอีกที");
  });

  it("survives Thai text, which is the whole point of the app", async () => {
    const sheet = createEmptySheet(2, 2);
    sheet.cells[0][0] = "1200";
    sheet.comments = { "0,0": "ยอดนี้รวม VAT แล้วนะครับ" };
    const blob = await exportWorkbookToXlsxBlob(exportable(sheet, "ไทย"));
    const [{ sheet: again }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx"));
    expect(again.comments?.["0,0"]).toBe("ยอดนี้รวม VAT แล้วนะครับ");
  });

  it("writes a note on an empty cell into the file, where Excel will show it", async () => {
    // ExcelJS attaches a note on read only to a cell that exists in its sheet model, and a cell
    // with no value doesn't — so this note reaches Excel intact but is dropped coming back into
    // ExcelToGo. The loss is in the reader, not the writer, and this pins which: if an ExcelJS
    // upgrade ever fixes the read side, the sibling test below starts failing and says so.
    const sheet = createEmptySheet(3, 3);
    sheet.cells[1][1] = "มีค่า";
    sheet.comments = { "0,0": "กรอกช่องนี้ด้วย" };
    const blob = await exportWorkbookToXlsxBlob(exportable(sheet, "ว่างแต่มีโน้ต"));
    // The archive's own file table, read straight out of the bytes rather than through the library
    // whose reader is the thing in question.
    const text = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()));
    expect(text).toContain("comments1.xml");
  });

  it("loses a note on an empty cell when read back, which is ExcelJS's reader, not the file", async () => {
    const sheet = createEmptySheet(3, 3);
    sheet.cells[1][1] = "มีค่า";
    sheet.comments = { "0,0": "กรอกช่องนี้ด้วย" };
    const blob = await exportWorkbookToXlsxBlob(exportable(sheet, "ว่างแต่มีโน้ต"));
    const [{ sheet: again }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx"));
    expect(again.comments?.["0,0"]).toBeUndefined();
  });

  it("reads a note Excel wrote as rich text, not only one written as a plain string", async () => {
    // ExcelJS hands back a string for its own notes and a rich-text object for Excel's; reading
    // only the string form would drop every comment in a file that actually came from Excel.
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("rich");
    ws.getCell("A1").value = "x";
    (ws.getCell("A1") as unknown as { note: unknown }).note = { texts: [{ text: "ส่วน" }, { text: "ที่สอง" }] };
    const buffer = await workbook.xlsx.writeBuffer();
    const [{ sheet }] = await importWorkbookFromFile(new File([buffer], "rich.xlsx"));
    expect(sheet.comments?.["0,0"]).toBe("ส่วนที่สอง");
  });

  it("leaves a sheet with no notes carrying none", async () => {
    const blob = await exportWorkbookToXlsxBlob(exportable(createEmptySheet(3, 3), "ว่าง"));
    const [{ sheet: again }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx"));
    expect(again.comments).toBeUndefined();
  });
});

/**
 * The README used to list "a round trip loses the formula" as a known limitation, and it was not
 * true: `writeSheetToWorksheet` has written `{ formula, result }` for a long time. A limitation
 * nobody re-checks outlives the bug it described, so the claim is now pinned by a test instead of
 * by memory — if the writer ever falls back to writing numbers, this is what says so.
 */
describe("formulas through an export → import cycle", () => {
  /** Two tabs, because the interesting reference is the one that points at the *other* sheet. */
  function workbook() {
    let one = createEmptySheet(4, 3);
    one = setCellRaw(one, 0, 0, "10");
    one = setCellRaw(one, 1, 0, "20");
    one = setCellRaw(one, 2, 0, "=SUM(A1:A2)");
    let two = createEmptySheet(4, 3);
    two = setCellRaw(two, 0, 0, "=Sheet1!A3*2");
    two = setCellRaw(two, 1, 0, "=IF($A$1>50,\"มาก\",\"น้อย\")");
    return [
      { name: "Sheet1", sheet: one, computed: computeSheet(one) },
      { name: "Sheet2", sheet: two, computed: computeSheet(two) },
    ];
  }

  async function cycle() {
    const blob = await exportWorkbookToXlsxBlob(workbook());
    return importWorkbookFromFile(new File([await blob.arrayBuffer()], "again.xlsx"));
  }

  it("keeps a formula as a formula, not the number it happened to produce", async () => {
    const back = await cycle();
    expect(back[0].sheet.cells[2][0]).toBe("=SUM(A1:A2)");
  });

  it("keeps a cross-sheet reference pointing at the other sheet", async () => {
    const back = await cycle();
    expect(back[1].sheet.cells[0][0]).toBe("=Sheet1!A3*2");
  });

  it("keeps an absolute reference absolute", async () => {
    // `$A$1` surviving as `A1` would be silent: the value is identical until someone fills down.
    const back = await cycle();
    expect(back[1].sheet.cells[1][0]).toContain("$A$1");
  });

  it("recomputes to the same values it had before the trip", async () => {
    const before = workbook();
    const back = await cycle();
    const resolver = createWorkbookResolver(back.map((t) => ({ name: t.name, sheet: t.sheet })));
    expect(computeSheet(back[0].sheet, resolver).values[2][0]).toBe(before[0].computed.values[2][0]);
    expect(computeSheet(back[1].sheet, resolver).values[0][0]).toBe(60); // (10 + 20) * 2
  });
});

describe("frozen panes go into the file and come back", () => {
  const reimport = async (sheet: SheetModel) => {
    const blob = await exportWorkbookToXlsxBlob(exportable(sheet));
    const file = new File([await blob.arrayBuffer()], "frozen.xlsx");
    const [{ sheet: back }] = await importWorkbookFromFile(file);
    return back;
  };

  it("round-trips a split", async () => {
    // Excel counts the split the same way this model does — how many rows and columns are above
    // and left of the first scrolling cell — so the numbers carry across without arithmetic.
    // Worth a test rather than a comment.
    const back = await reimport(withFreeze(createEmptySheet(20, 8), { rows: 2, cols: 1 }));
    expect(back.freeze).toEqual({ rows: 2, cols: 1 });
  });

  it("writes a frozen view Excel will recognise", async () => {
    const ws = await readBack(await exportWorkbookToXlsxBlob(exportable(withFreeze(createEmptySheet(20, 8), { rows: 3, cols: 0 }))));
    const view = ws.views?.[0] as { state?: string; ySplit?: number; xSplit?: number } | undefined;
    expect(view?.state).toBe("frozen");
    expect(view?.ySplit).toBe(3);
  });

  it("writes nothing for a sheet with no split, and reads none back", async () => {
    expect((await reimport(createEmptySheet(10, 5))).freeze).toBeUndefined();
  });
});

describe("validation rules go into the file and come back", () => {
  const reimport = async (sheet: SheetModel) => {
    const blob = await exportWorkbookToXlsxBlob(exportable(sheet));
    const [{ sheet: back }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "rules.xlsx"));
    return back;
  };

  const ruled = () =>
    withValidation(
      withValidation(createEmptySheet(20, 8), { startRow: 1, startCol: 1, endRow: 3, endCol: 1 }, {
        kind: "list",
        values: ["เหนือ", "กลาง", "ใต้"],
      }),
      { startRow: 1, startCol: 2, endRow: 1, endCol: 2 },
      { kind: "number", min: 0, max: 100 }
    );

  it("keeps a dropdown and a range through a full cycle", async () => {
    const back = await reimport(ruled());
    expect(ruleAt(back, 2, 1)).toEqual({ kind: "list", values: ["เหนือ", "กลาง", "ใต้"] });
    expect(ruleAt(back, 1, 2)).toEqual({ kind: "number", min: 0, max: 100 });
    expect(ruleAt(back, 5, 5)).toBeUndefined();
  });

  it("writes validation Excel itself would recognise", async () => {
    // The round-trip above only proves this app agrees with itself. This one reads the file the
    // way any other spreadsheet would.
    const ws = await readBack(await exportWorkbookToXlsxBlob(exportable(ruled())));
    expect(ws.getCell("B2").dataValidation).toMatchObject({ type: "list", formulae: ['"เหนือ,กลาง,ใต้"'] });
    expect(ws.getCell("C2").dataValidation).toMatchObject({ type: "decimal", operator: "between" });
  });

  it("refuses rather than mangles a list the format cannot hold", async () => {
    // An option with a comma in it has no inline representation. It is dropped on the way out —
    // and the cell's *value* still goes, which is the part that would actually be a loss.
    const sheet = setCellRaw(
      withValidation(createEmptySheet(10, 5), { startRow: 1, startCol: 1, endRow: 1, endCol: 1 }, {
        kind: "list",
        values: ["ก, ข", "ค"],
      }),
      1,
      1,
      "ค"
    );
    const back = await reimport(sheet);
    expect(ruleAt(back, 1, 1)).toBeUndefined();
    expect(back.cells[1]?.[1]).toBe("ค");
  });

  it("adopts the rules on an ordinary file built elsewhere", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("data");
    ws.getCell("A1").value = "ภาค";
    ws.getCell("A2").dataValidation = { type: "list", allowBlank: true, formulae: ['"เหนือ,ใต้"'] };
    const file = new File([await wb.xlsx.writeBuffer()], "outside.xlsx");

    const [{ sheet }] = await importWorkbookFromFile(file);
    expect(ruleAt(sheet, 1, 0)).toEqual({ kind: "list", values: ["เหนือ", "ใต้"] });
    // And it is a rule of the person's own, not a template: nothing about the sheet is locked.
    expect(sheet.template).toBeUndefined();
  });

  it("leaves a template's own dropdowns to the template", async () => {
    // A protected form's rules belong to the form. Copying them into `validation` as well would
    // mean "unlock this template" left the rules behind, still refusing values.
    const [{ sheet }] = await importWorkbookFromFile(await templateFile());
    expect(sheet.template?.choices[cellKey(3, 1)]).toEqual(["ด่วน", "ปกติ", "ประหยัด"]);
    expect(sheet.validation).toBeUndefined();
  });
});

describe("named ranges go into the file and come back", () => {
  const withNames = () => {
    let sheet = createEmptySheet(20, 5);
    for (let r = 0; r < 4; r++) sheet = setCellRaw(sheet, r, 1, String((r + 1) * 10));
    sheet = setCellRaw(sheet, 5, 0, "=SUM(ยอดขาย)");
    return { ...sheet, names: withName(undefined, "ยอดขาย", "$B$1:$B$4") };
  };

  it("keeps the name, and the formula that uses it still adds up", async () => {
    const blob = await exportWorkbookToXlsxBlob(exportable(withNames()));
    const [{ sheet }] = await importWorkbookFromFile(new File([await blob.arrayBuffer()], "names.xlsx"));
    // Qualified on the way out, because a file's defined names are workbook-wide; bare again on
    // the way back, because here they belong to the sheet that holds them.
    expect(sheet.names?.["ยอดขาย"]?.ref).toBe("$B$1:$B$4");
    expect(sheet.cells[5][0]).toBe("=SUM(ยอดขาย)");
    expect(computeSheet(sheet).values[5][0]).toBe(100);
  });

  it("writes a defined name Excel itself would read", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await (await exportWorkbookToXlsxBlob(exportable(withNames()))).arrayBuffer());
    // ExcelJS quotes a non-ASCII sheet name on the way out; both spellings are legal and both
    // resolve, so the assertion is on what the name means rather than on its punctuation.
    const written = wb.definedNames.model.find((n) => n.name === "ยอดขาย");
    expect(written?.ranges[0]).toMatch(/^'?ใบเสนอราคา'?!\$B\$1:\$B\$4$/);
  });

  it("adopts the names in a file built elsewhere", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("data");
    ws.getCell("B1").value = 5;
    wb.definedNames.model = [
      { name: "Tax", ranges: ["data!$B$1"] },
      // Excel stores a print area as a defined name too. It is the file's bookkeeping, and a dot
      // is not a legal first character for a name here, so it is left where it belongs.
      { name: "_xlnm.Print_Area", ranges: ["data!$A$1:$C$9"] },
      // A target on a sheet this workbook does not have resolves to nothing at all.
      { name: "Elsewhere", ranges: ["ghost!$A$1"] },
    ];
    const [{ sheet }] = await importWorkbookFromFile(new File([await wb.xlsx.writeBuffer()], "outside.xlsx"));

    expect(Object.keys(sheet.names ?? {})).toEqual(["TAX"]);
  });

  it("drops the second of two tabs claiming the same name rather than renaming it", async () => {
    // The file format's names are workbook-wide, so the collision is real. Renaming would write a
    // file whose formulas point somewhere nobody asked for.
    const first = { ...createEmptySheet(10, 3), names: withName(undefined, "ยอด", "หนึ่ง!$A$1") };
    const second = { ...createEmptySheet(10, 3), names: withName(undefined, "ยอด", "สอง!$C$3") };
    const blob = await exportWorkbookToXlsxBlob([
      { name: "หนึ่ง", sheet: first, computed: computeSheet(first) },
      { name: "สอง", sheet: second, computed: computeSheet(second) },
    ]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.definedNames.model.map((n) => n.name)).toEqual(["ยอด"]);
    expect(wb.definedNames.model[0].ranges[0]).toMatch(/หนึ่ง'?!\$A\$1$/);
  });
});

/**
 * A `list` rule pointing at a range on another sheet reads that sheet. It used to drop the sheet
 * name and read the same range from the sheet being imported, so the options were whatever sat
 * there — with nothing to say they were wrong.
 */
describe("dropdowns whose list lives on another sheet", () => {
  /** A workbook with a sheet `Form` carrying one list rule, plus whatever other sheets are given. */
  async function workbookWith(
    formula: string,
    others: { name: string; values: string[]; hidden?: boolean }[],
    opts: { protect?: boolean; otherFirst?: boolean } = {}
  ): Promise<File> {
    const wb = new ExcelJS.Workbook();
    const addOthers = () => {
      for (const o of others) {
        const ws = wb.addWorksheet(o.name, o.hidden ? { state: "hidden" } : undefined);
        o.values.forEach((v, i) => (ws.getCell(i + 1, 1).value = v));
      }
    };
    if (opts.otherFirst) addOthers();
    const form = wb.addWorksheet("Form");
    // Decoys in the same cells the rule names, on the rule's own sheet: reading the wrong sheet
    // offers these, which is exactly what the old code did.
    ["decoy-1", "decoy-2", "decoy-3", "decoy-4", "decoy-5"].forEach((v, i) => (form.getCell(i + 1, 1).value = v));
    form.getCell("C2").dataValidation = { type: "list", allowBlank: true, formulae: [formula] };
    if (opts.protect) {
      form.getCell("C2").protection = { locked: false };
      await form.protect("", {});
    }
    if (!opts.otherFirst) addOthers();
    return new File([await wb.xlsx.writeBuffer()], "cross.xlsx");
  }
  const formSheet = async (file: File) => (await importWorkbookFromFile(file)).find((s) => s.name === "Form")!.sheet;
  const listAt = (sheet: SheetModel) => {
    const rule = ruleAt(sheet, 1, 2);
    return rule?.kind === "list" ? rule.values : undefined;
  };
  const REF = { name: "Ref", values: ["unit", "kg", "g", "pcs"] };

  it("reads an ordinary sheet's rule from the sheet it names, whichever order the sheets come in", async () => {
    expect(listAt(await formSheet(await workbookWith("Ref!$A$2:$A$4", [REF])))).toEqual(["kg", "g", "pcs"]);
    expect(listAt(await formSheet(await workbookWith("Ref!$A$2:$A$4", [REF], { otherFirst: true })))).toEqual(["kg", "g", "pcs"]);
  });

  it("reads a template's choices from the sheet it names, even when that sheet is hidden", async () => {
    const sheet = await formSheet(await workbookWith("Ref!$A$2:$A$4", [{ ...REF, hidden: true }], { protect: true }));
    expect(sheet.template?.choices[cellKey(1, 2)]).toEqual(["kg", "g", "pcs"]);
  });

  it("reads quoted sheet names: Thai, with a space, and with an escaped quote", async () => {
    const cases: [string, string][] = [
      ["'ใบเสนอราคา'!$A$1:$A$3", "ใบเสนอราคา"],
      ["'My Sheet'!A1:A3", "My Sheet"],
      ["'Bob''s list'!$A$1:$A$3", "Bob's list"],
    ];
    for (const [formula, name] of cases) {
      const sheet = await formSheet(await workbookWith(formula, [{ name, values: ["a", "b", "c"] }]));
      expect(listAt(sheet), formula).toEqual(["a", "b", "c"]);
    }
  });

  it("gives no dropdown for a sheet the file does not have, rather than one from another sheet", async () => {
    const sheet = await formSheet(await workbookWith("Missing!$A$1:$A$3", [REF]));
    expect(ruleAt(sheet, 1, 2)).toBeUndefined();
    const template = await formSheet(await workbookWith("Missing!$A$1:$A$3", [REF], { protect: true }));
    expect(template.template?.choices[cellKey(1, 2)]).toBeUndefined();
  });

  it("still reads a bare range from the rule's own sheet", async () => {
    expect(listAt(await formSheet(await workbookWith("$A$1:$A$3", [REF])))).toEqual(["decoy-1", "decoy-2", "decoy-3"]);
  });

  it("leaves a named-range list as it was: no dropdown, and no error", async () => {
    const sheet = await formSheet(await workbookWith("Units", [REF]));
    expect(ruleAt(sheet, 1, 2)).toBeUndefined();
  });

  it("gives every dropdown in the PaynEat ERP draft-0 template the values from its Ref sheet", async () => {
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(new URL("./fixtures/payneat-erp-sample-import-template.xlsx", import.meta.url));
    const sheets = await importWorkbookFromFile(new File([bytes], "sample-import-template.xlsx"));
    const choicesOf = (name: string, row: number, col: number) =>
      sheets.find((s) => s.name === name)!.sheet.template?.choices[cellKey(row, col)];

    const units = ["kg", "g", "pcs", "L", "ml", "case", "bag", "tin"];
    expect(choicesOf("Items", 1, 3)).toEqual(units); // base_unit
    expect(choicesOf("Items", 1, 6)).toEqual(units); // purchase_unit
    expect(choicesOf("OpeningBalance", 1, 0)).toEqual(["PLANT-01", "BR-SILOM", "BR-ARI", "BR-BANGNA"]);
    expect(choicesOf("OpeningBalance", 1, 1)).toEqual([
      "WHOLE-CHICKEN", "CHICKEN-BREAST", "CHICKEN-THIGH", "CHICKEN-DRUMSTICK", "CHICKEN-WING",
      "CHICKEN-FRAME", "FLOUR", "FRYING-OIL", "SEASONING",
    ]);
    // An inline list on the same sheet is untouched.
    expect(choicesOf("Items", 1, 4)).toEqual(["TRUE", "FALSE"]);
  });
});
