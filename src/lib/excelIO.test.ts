import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { exportWorkbookToXlsxBlob, importWorkbookFromFile } from "./excelIO";
import { computeSheet, SheetModel } from "./sheet";
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
