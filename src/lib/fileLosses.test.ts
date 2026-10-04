// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { findFileLosses, unknownFunctionsIn } from "./fileLosses";
import { exportWorkbookToXlsxBlob, importWorkbookFromFile } from "./excelIO";
import { computeSheet, createEmptySheet } from "./sheet";

/**
 * What an opened file holds that the app does not keep (#83).
 *
 * The first cases read a real file — `fixtures/losses-picture-chart.xlsx`, saved by openpyxl with a
 * picture (written by ExcelJS), a bar chart (written by the app's own chart writer) and a formula
 * calling a function the engine lacks — because a detector
 * checked only against what its author thought the package looks like is how the importer came to
 * drop pictures silently in the first place. The kinds no tool here can write (PivotTables,
 * macros, links, shapes) are spec-shaped parts added to a real workbook.
 */
const FIXTURE = new URL("./fixtures/losses-picture-chart.xlsx", import.meta.url);

async function openFixture(bytes: Uint8Array) {
  const sheets = await importWorkbookFromFile(new File([Uint8Array.from(bytes)], "file.xlsx"));
  return { sheets, losses: await findFileLosses(bytes, sheets) };
}

describe("a real file with a picture, a chart and a function the engine lacks", () => {
  it("counts each and names the sheet it is on", async () => {
    const { losses } = await openFixture(readFileSync(FIXTURE));
    expect(losses).toEqual([
      { kind: "pictures", count: 1, sheets: ["ใบเสนอราคา"] },
      { kind: "charts", count: 1, sheets: ["ใบเสนอราคา"] },
      { kind: "unknownFunctions", count: 1, sheets: ["ใบเสนอราคา"], names: ["TEXTBEFORE"] },
    ]);
  });

  it("the formula the engine cannot run still goes back out as the formula it was", async () => {
    const { sheets } = await openFixture(readFileSync(FIXTURE));
    const quote = sheets[0].sheet;
    expect(quote.cells[2][3]).toBe('=TEXTBEFORE(A2,"ฟ")');
    expect((computeSheet(quote).values[2][3] as { code?: string }).code).toBe("#NAME?");
    const back = await JSZip.loadAsync(await (await exportWorkbookToXlsxBlob([{ name: sheets[0].name, sheet: quote, computed: computeSheet(quote) }])).arrayBuffer());
    expect(await back.file("xl/worksheets/sheet1.xml")!.async("string")).toContain("<f>TEXTBEFORE(A2,&quot;ฟ&quot;)</f>");
  });
});

describe("a file with nothing the app drops", () => {
  it("reports nothing — most files must see no notice at all", async () => {
    const sheet = createEmptySheet();
    sheet.cells[0][0] = "10";
    sheet.cells[1][0] = "=SUM(A1:A1)*2";
    const blob = await exportWorkbookToXlsxBlob([{ name: "Sheet1", sheet, computed: computeSheet(sheet) }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect((await openFixture(bytes)).losses).toEqual([]);
  });

  it("a newer function the engine has is not reported for Excel's _xlfn. spelling", () => {
    expect(unknownFunctionsIn("_xlfn.XLOOKUP(A1,B:B,C:C)+SUM(A1)")).toEqual([]);
    expect(unknownFunctionsIn('_xlfn.TEXTBEFORE(A1,",")&LAMBDA_ISH(1)')).toEqual(["TEXTBEFORE", "LAMBDA_ISH"]);
  });
});

describe("the kinds no tool here writes, as the spec shapes them", () => {
  /** A real workbook from the fixture, with extra parts dropped in the way Excel lays them out. */
  async function withParts(add: (zip: JSZip) => void) {
    const zip = await JSZip.loadAsync(readFileSync(FIXTURE));
    add(zip);
    return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
  }
  const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  it("a PivotTable, a text box, macros and an external link each become a line", async () => {
    const bytes = await withParts((zip) => {
      zip.file(
        "xl/worksheets/_rels/sheet2.xml.rels",
        `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="${REL}/pivotTable" Target="../pivotTables/pivotTable1.xml"/>` +
          `<Relationship Id="rId2" Type="${REL}/drawing" Target="../drawings/drawing2.xml"/></Relationships>`
      );
      zip.file("xl/pivotTables/pivotTable1.xml", "<pivotTableDefinition/>");
      zip.file(
        "xl/drawings/drawing2.xml",
        `<xdr:wsDr xmlns:xdr="x" xmlns:a="a"><xdr:twoCellAnchor><xdr:sp><xdr:spPr/></xdr:sp></xdr:twoCellAnchor>` +
          `<xdr:twoCellAnchor><xdr:cxnSp/></xdr:twoCellAnchor></xdr:wsDr>`
      );
      zip.file("xl/vbaProject.bin", new Uint8Array([0xd0, 0xcf]));
      zip.file("xl/externalLinks/externalLink1.xml", "<externalLink/>");
    });
    const { losses } = await openFixture(bytes);
    expect(losses.map((l) => [l.kind, l.count, l.sheets.join()])).toEqual([
      ["pictures", 1, "ใบเสนอราคา"],
      ["charts", 1, "ใบเสนอราคา"],
      ["shapes", 2, "ข้อมูล"],
      ["pivots", 1, "ข้อมูล"],
      ["unknownFunctions", 1, "ใบเสนอราคา"],
      ["externalLinks", 1, ""],
      ["macros", 1, ""],
    ]);
  });

  it("a chart sheet is a tab that is nothing but a chart", async () => {
    const zip = await JSZip.loadAsync(readFileSync(FIXTURE));
    const wb = (await zip.file("xl/workbook.xml")!.async("string")).replace(
      "</sheets>",
      `<sheet name="กราฟยอดขาย" sheetId="9" r:id="rId99"/></sheets>`
    );
    zip.file("xl/workbook.xml", wb);
    const rels = (await zip.file("xl/_rels/workbook.xml.rels")!.async("string")).replace(
      "</Relationships>",
      `<Relationship Id="rId99" Type="${REL}/chartsheet" Target="chartsheets/sheet1.xml"/></Relationships>`
    );
    zip.file("xl/_rels/workbook.xml.rels", rels);
    zip.file("xl/chartsheets/sheet1.xml", "<chartsheet/>");
    const losses = await findFileLosses(await zip.generateAsync({ type: "uint8array" }), []);
    expect(losses.find((l) => l.kind === "charts")).toEqual({ kind: "charts", count: 2, sheets: ["ใบเสนอราคา", "กราฟยอดขาย"] });
  });

  it("a file that is not a zip reports nothing rather than failing the open", async () => {
    expect(await findFileLosses(new TextEncoder().encode("not a zip"), [])).toEqual([]);
  });
});

/** The fixture with range names the importer cannot bring in (#60): a formula and a whole column. */
async function fixtureWithNames(): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(readFileSync(FIXTURE));
  const wb = (await zip.file("xl/workbook.xml")!.async("string")).replace(
    "</sheets>",
    "</sheets><definedNames>" +
      `<definedName name="Dynamic">OFFSET('ข้อมูล'!$A$1,0,0,COUNTA('ข้อมูล'!$A:$A),1)</definedName>` +
      `<definedName name="WholeColumn">'ข้อมูล'!$B:$B</definedName>` +
      "</definedNames>"
  );
  zip.file("xl/workbook.xml", wb);
  return zip.generateAsync({ type: "uint8array" });
}

describe("range names a file holds that cannot come in (#60), in the same report", () => {
  it("are one line of it, right under the functions the engine lacks, since both read #NAME?", async () => {
    const { sheets, losses } = await openFixture(await fixtureWithNames());
    expect(sheets[0].droppedNames).toEqual(["Dynamic", "WholeColumn"]);
    expect(losses.map((l) => l.kind)).toEqual(["pictures", "charts", "unknownFunctions", "names"]);
    expect(losses.at(-1)).toEqual({ kind: "names", count: 2, sheets: [], names: ["Dynamic", "WholeColumn"] });
  });

  it("are the whole report for a file with nothing else to lose", async () => {
    const sheet = createEmptySheet();
    sheet.cells[0][0] = "10";
    const blob = await exportWorkbookToXlsxBlob([{ name: "Sheet1", sheet, computed: computeSheet(sheet) }]);
    const losses = await findFileLosses(new Uint8Array(await blob.arrayBuffer()), [{ name: "Sheet1", sheet, droppedNames: ["Dynamic"] }]);
    expect(losses).toEqual([{ kind: "names", count: 1, sheets: [], names: ["Dynamic"] }]);
  });

  it("are still said when the package cannot be read again", async () => {
    const losses = await findFileLosses(new TextEncoder().encode("not a zip"), [{ name: "Sheet1", sheet: createEmptySheet(), droppedNames: ["Dynamic"] }]);
    expect(losses).toEqual([{ kind: "names", count: 1, sheets: [], names: ["Dynamic"] }]);
  });
});

describe("constant error cells (#227), shown as text until #226", () => {
  /** Two sheets: errors typed into the first, as Excel writes them, and a formula that errs in the second. */
  async function errorsFile(): Promise<Uint8Array> {
    const wb = new ExcelJS.Workbook();
    const sales = wb.addWorksheet("ยอดขาย");
    sales.getCell("A1").value = { error: "#DIV/0!" } as ExcelJS.CellErrorValue;
    sales.getCell("A2").value = { error: "#N/A" } as ExcelJS.CellErrorValue;
    sales.getCell("A3").value = 5;
    sales.getCell("A4").value = { formula: "SUM(A1:A3)", result: { error: "#DIV/0!" } } as ExcelJS.CellFormulaValue;
    const other = wb.addWorksheet("อื่นๆ");
    other.getCell("B2").value = { formula: "1/0", result: { error: "#DIV/0!" } } as ExcelJS.CellFormulaValue;
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }

  it("are counted and placed; a formula whose result is an error is not, since it calculates again", async () => {
    const { losses } = await openFixture(await errorsFile());
    expect(losses).toEqual([{ kind: "errorValues", count: 2, sheets: ["ยอดขาย"] }]);
  });

  it("are still there, and still said, after the file goes out of the app and back in", async () => {
    const { sheets } = await openFixture(await errorsFile());
    const blob = await exportWorkbookToXlsxBlob(sheets.map(({ name, sheet }) => ({ name, sheet, computed: computeSheet(sheet) })));
    const { losses } = await openFixture(new Uint8Array(await blob.arrayBuffer()));
    expect(losses).toEqual([{ kind: "errorValues", count: 2, sheets: ["ยอดขาย"] }]);
  });
});
