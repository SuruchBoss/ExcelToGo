// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Splices real chart parts into the .xlsx ExcelJS has already written.
 *
 * ExcelJS cannot write chart XML, so the only way to ship a chart Excel keeps redrawing is to open
 * the finished package and add the parts by hand. A .xlsx is a zip of XML, and a chart needs five
 * things wired together:
 *
 *   xl/charts/chartN.xml            the chart itself
 *   xl/drawings/drawingN.xml        where it sits on the sheet
 *   xl/drawings/_rels/…​.rels        drawing -> chart
 *   xl/worksheets/_rels/…​.rels      sheet -> drawing
 *   [Content_Types].xml             declares both part types
 *
 * plus a `<drawing r:id="…"/>` element inside the worksheet. Miss any one and the file either
 * opens with no chart or is reported as corrupt, with nothing saying which.
 *
 * The sheet may already have a drawing — an imported workbook's images go through the same part —
 * so nothing here assumes it is creating one. Anchors are appended to whatever is there.
 */
import JSZip from "jszip";
import { ChartKind } from "./charts";
import {
  ChartPlacement,
  SeriesRef,
  addAnchorsToDrawing,
  chartXml,
  drawingAnchorXml,
  emptyDrawingXml,
} from "./xlsxChartXml";

export interface PendingChart {
  /** Zero-based index of the worksheet in the workbook, in the order they were added. */
  sheetIndex: number;
  kind: ChartKind;
  series: SeriesRef[];
  title?: string;
  placement: ChartPlacement;
}

const CHART_CT = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";
const DRAWING_CT = "application/vnd.openxmlformats-officedocument.drawing+xml";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** Highest rIdN already used in a .rels part, so a new one doesn't collide. */
function nextRelId(relsXml: string): number {
  let max = 0;
  for (const m of relsXml.matchAll(/Id="rId(\d+)"/g)) max = Math.max(max, Number(m[1]));
  return max + 1;
}

function relationshipsShell(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"></Relationships>`;
}

function addRelationship(relsXml: string, id: string, type: string, target: string): string {
  const rel = `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`;
  return relsXml.replace(/<\/Relationships>\s*$/, `${rel}</Relationships>`);
}

/**
 * The worksheet part paths, in workbook order.
 *
 * Read from workbook.xml.rels rather than assumed to be sheet1..sheetN: the order sheets appear in
 * the workbook is not necessarily the order their parts are named, and putting a chart on the wrong
 * sheet is a silent, confusing failure.
 */
async function worksheetPaths(zip: JSZip): Promise<string[]> {
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbookXml || !relsXml) throw new Error("workbook parts missing");

  const targets = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)) {
    targets.set(m[1], m[2]);
  }
  const paths: string[] = [];
  for (const m of workbookXml.matchAll(/<sheet\b[^>]*r:id="([^"]+)"[^>]*\/>/g)) {
    const target = targets.get(m[1]);
    if (!target) throw new Error(`no target for ${m[1]}`);
    paths.push(target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`);
  }
  return paths;
}

/** Declares a part's content type, unless an Override for it is already there. */
function addContentTypeOverride(xml: string, partName: string, contentType: string): string {
  if (xml.includes(`PartName="${partName}"`)) return xml;
  return xml.replace(
    /<\/Types>\s*$/,
    `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`
  );
}

/**
 * Finds the sheet's existing drawing, or makes one.
 *
 * Returns the drawing's part path plus whether it had to be created, because a newly created one
 * also needs a content-type override and a `<drawing>` element in the worksheet, while an existing
 * one already has both.
 */
async function drawingFor(zip: JSZip, sheetPath: string, index: number): Promise<{ path: string; created: boolean }> {
  const sheetRelsPath = sheetPath.replace(/([^/]+)$/, "_rels/$1.rels");
  const relsXml = (await zip.file(sheetRelsPath)?.async("string")) ?? relationshipsShell();

  const existing = relsXml.match(
    /<Relationship\b[^>]*Type="[^"]*\/drawing"[^>]*Target="([^"]+)"[^>]*\/>/
  );
  if (existing) {
    const target = existing[1];
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\.\//, "")}`;
    return { path, created: false };
  }

  const path = `xl/drawings/drawing_chart${index + 1}.xml`;
  zip.file(path, emptyDrawingXml());

  const relId = `rId${nextRelId(relsXml)}`;
  const withRel = addRelationship(
    relsXml,
    relId,
    `${REL_NS}/drawing`,
    `../drawings/${path.split("/").pop()}`
  );
  zip.file(sheetRelsPath, withRel);

  // The worksheet has to point at the drawing, and `<drawing>` has a fixed position in the schema:
  // after sheetData and after any hyperlinks/pageSetup that are present. Appending before
  // </worksheet> is correct only because ExcelJS writes none of the parts that must follow it.
  const sheetXml = await zip.file(sheetPath)?.async("string");
  if (!sheetXml) throw new Error(`worksheet missing: ${sheetPath}`);
  if (!/<drawing\b/.test(sheetXml)) {
    zip.file(sheetPath, sheetXml.replace(/<\/worksheet>\s*$/, `<drawing r:id="${relId}"/></worksheet>`));
  }
  return { path, created: true };
}

/**
 * Adds every chart to a finished .xlsx and returns the repacked file.
 *
 * Throws rather than half-writing: a workbook with a dangling relationship is reported as corrupt,
 * which is worse than one with no charts, so the caller falls back to pictures on any failure.
 */
export async function injectCharts(xlsx: ArrayBuffer, charts: PendingChart[]): Promise<ArrayBuffer> {
  if (charts.length === 0) return xlsx;

  const zip = await JSZip.loadAsync(xlsx);
  const sheets = await worksheetPaths(zip);
  let contentTypes = await zip.file("[Content_Types].xml")?.async("string");
  if (!contentTypes) throw new Error("[Content_Types].xml missing");

  // Anchors are collected per drawing part so a sheet with several charts rewrites its drawing once.
  const anchorsByDrawing = new Map<string, string[]>();

  for (const [i, chart] of charts.entries()) {
    const sheetPath = sheets[chart.sheetIndex];
    if (!sheetPath) throw new Error(`no worksheet at index ${chart.sheetIndex}`);

    const chartPath = `xl/charts/chart${i + 1}.xml`;
    zip.file(chartPath, chartXml(chart.kind, chart.series, chart.title));
    contentTypes = addContentTypeOverride(contentTypes, `/${chartPath}`, CHART_CT);

    const drawing = await drawingFor(zip, sheetPath, chart.sheetIndex);
    if (drawing.created) contentTypes = addContentTypeOverride(contentTypes, `/${drawing.path}`, DRAWING_CT);

    const drawingRelsPath = drawing.path.replace(/([^/]+)$/, "_rels/$1.rels");
    const drawingRels = (await zip.file(drawingRelsPath)?.async("string")) ?? relationshipsShell();
    const relId = `rId${nextRelId(drawingRels)}`;
    zip.file(
      drawingRelsPath,
      addRelationship(drawingRels, relId, `${REL_NS}/chart`, `../charts/${chartPath.split("/").pop()}`)
    );

    const anchors = anchorsByDrawing.get(drawing.path) ?? [];
    // The drawing's own ids only have to be unique inside it; offsetting past 1 avoids the id
    // ExcelJS gives the first image on a sheet that already has one.
    anchors.push(drawingAnchorXml(chart.placement, relId, i + 2, `Chart ${i + 1}`));
    anchorsByDrawing.set(drawing.path, anchors);
  }

  for (const [path, anchors] of anchorsByDrawing) {
    const xml = (await zip.file(path)?.async("string")) ?? emptyDrawingXml();
    zip.file(path, addAnchorsToDrawing(xml, anchors));
  }

  zip.file("[Content_Types].xml", contentTypes);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}
