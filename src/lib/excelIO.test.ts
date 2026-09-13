import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { exportWorkbookToXlsxBlob, importWorkbookFromFile } from "./excelIO";
import { computeSheet, createEmptySheet, SheetModel } from "./sheet";
import { evaluateConditionalFormats } from "./conditionalFormat";
import { cellKey } from "./sheetTemplate";

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
