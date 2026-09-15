import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { exportWorkbookToXlsxBlob } from "./excelIO";
import { computeSheet, createEmptySheet } from "./sheet";
import type { ChartKind } from "./charts";

function sheetWithCharts(kinds: ChartKind[], name = "Sales") {
  const sheet = createEmptySheet();
  const rows = [
    ["Month", "Sales", "Profit"],
    ["Jan", "120", "30"],
    ["Feb", "150", "45"],
    ["Mar", "90", "20"],
  ];
  rows.forEach((r, ri) => r.forEach((v, ci) => (sheet.cells[ri][ci] = v)));
  sheet.charts = kinds.map((kind, i) => ({
    id: `c${i}`,
    kind,
    range: { startRow: 0, startCol: 0, endRow: 3, endCol: kind === "pie" ? 1 : 2 },
    anchor: { col: 4, row: 1 + i * 17, dx: 0, dy: 0, w: 480, h: 300 },
  }));
  return { name, sheet, computed: computeSheet(sheet) };
}

async function exportZip(tabs: ReturnType<typeof sheetWithCharts>[]) {
  const blob = await exportWorkbookToXlsxBlob(tabs);
  return JSZip.loadAsync(await blob.arrayBuffer());
}

/** Resolves a relationship target the way a consumer does, so a dangling one is caught. */
function resolveTarget(relsPath: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const base = relsPath.replace(/_rels\/[^/]+$/, "");
  const parts: string[] = [];
  for (const seg of (base + target).split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

describe("charts in the exported .xlsx", () => {
  it("writes a chart part per chart and declares each content type", async () => {
    const zip = await exportZip([sheetWithCharts(["bar", "line", "pie"])]);
    const names = Object.keys(zip.files);
    expect(names.filter((n) => /^xl\/charts\/chart\d+\.xml$/.test(n))).toHaveLength(3);

    const ct = await zip.file("[Content_Types].xml")!.async("string");
    for (const n of names.filter((n) => /^xl\/charts\/chart\d+\.xml$/.test(n))) {
      expect(ct).toContain(`PartName="/${n}"`);
    }
  });

  it("puts the right chart type in each part", async () => {
    const zip = await exportZip([sheetWithCharts(["bar", "line", "pie"])]);
    const parts = await Promise.all(
      ["chart1", "chart2", "chart3"].map((n) => zip.file(`xl/charts/${n}.xml`)!.async("string"))
    );
    expect(parts[0]).toContain("<c:barChart>");
    expect(parts[1]).toContain("<c:lineChart>");
    expect(parts[2]).toContain("<c:pieChart>");
  });

  it("binds each series to its cells rather than baking in a picture", async () => {
    const zip = await exportZip([sheetWithCharts(["bar"])]);
    const xml = await zip.file("xl/charts/chart1.xml")!.async("string");
    expect(xml).toContain("<c:f>Sales!$B$2:$B$4</c:f>");
    expect(xml).toContain("<c:f>Sales!$A$2:$A$4</c:f>");
    // No image parts: the chart replaced the picture, it didn't join it.
    expect(Object.keys(zip.files).some((n) => n.startsWith("xl/media/"))).toBe(false);
  });

  // The failure this guards against is the worst one: a package with a relationship pointing at a
  // part that isn't there opens as "corrupt" with nothing saying which part is missing.
  it("leaves no dangling relationship anywhere in the package", async () => {
    const zip = await exportZip([sheetWithCharts(["bar", "pie"]), sheetWithCharts(["line"], "Two")]);
    const names = new Set(Object.keys(zip.files));
    const dangling: string[] = [];
    for (const path of names) {
      if (!path.endsWith(".rels")) continue;
      const xml = await zip.file(path)!.async("string");
      for (const m of xml.matchAll(/Target="([^"]+)"(?:[^>]*TargetMode="(\w+)")?/g)) {
        if (m[2] === "External" || m[1].startsWith("http")) continue;
        const resolved = resolveTarget(path, m[1]);
        if (!names.has(resolved)) dangling.push(`${path} -> ${m[1]}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it("points the worksheet at a drawing that points at the chart", async () => {
    const zip = await exportZip([sheetWithCharts(["bar"])]);
    const sheetXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    const drawingEl = sheetXml.match(/<drawing r:id="([^"]+)"\/>/);
    expect(drawingEl).not.toBeNull();

    const sheetRels = await zip.file("xl/worksheets/_rels/sheet1.xml.rels")!.async("string");
    expect(sheetRels).toContain(`Id="${drawingEl![1]}"`);

    const drawingPath = Object.keys(zip.files).find((n) => /^xl\/drawings\/.*\.xml$/.test(n))!;
    const drawingXml = await zip.file(drawingPath)!.async("string");
    expect(drawingXml).toContain("<xdr:graphicFrame");
    expect(drawingXml).toContain("<xdr:twoCellAnchor>");
  });

  it("keeps two charts on one sheet in a single drawing part", async () => {
    const zip = await exportZip([sheetWithCharts(["bar", "line"])]);
    const drawings = Object.keys(zip.files).filter((n) => /^xl\/drawings\/[^/]+\.xml$/.test(n));
    expect(drawings).toHaveLength(1);
    const xml = await zip.file(drawings[0])!.async("string");
    expect(xml.match(/<xdr:twoCellAnchor>/g)).toHaveLength(2);
  });

  it("puts each sheet's chart on that sheet", async () => {
    const zip = await exportZip([sheetWithCharts(["bar"], "First"), sheetWithCharts(["pie"], "Second")]);
    const one = await zip.file("xl/charts/chart1.xml")!.async("string");
    const two = await zip.file("xl/charts/chart2.xml")!.async("string");
    expect(one).toContain("First!$B$2:$B$4");
    expect(two).toContain("Second!$B$2:$B$4");
  });

  it("still produces a workbook ExcelJS can read back", async () => {
    const blob = await exportWorkbookToXlsxBlob([sheetWithCharts(["bar", "pie"])]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.getWorksheet("Sales")!;
    expect(ws.getCell("A1").value).toBe("Month");
    expect(ws.getCell("B2").value).toBe(120);
  });

  it("adds nothing when the sheet has no charts", async () => {
    const tab = sheetWithCharts([]);
    const zip = await exportZip([tab]);
    expect(Object.keys(zip.files).some((n) => n.startsWith("xl/charts/"))).toBe(false);
  });
});
