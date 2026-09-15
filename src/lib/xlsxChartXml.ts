/**
 * Builds the OOXML a spreadsheet needs to show a *real* chart — one Excel keeps redrawing — rather
 * than a picture of one.
 *
 * ExcelJS's entire drawing API is `addImage`; it writes no chart XML at all. So charts left this
 * app as PNGs: they looked right on the day and then stopped tracking the numbers, which is the one
 * thing a chart is for. The XML here is written by hand and spliced into the workbook ExcelJS
 * produces (see xlsxCharts.ts), so the exported file contains a chart bound to its cells.
 *
 * Everything in this file is a pure string builder. That keeps the fiddly part — namespaces,
 * axis-id pairing, cached values — testable without a zip anywhere in sight.
 *
 * Shapes are deliberately minimal: a chart with no styling part, no theme override and no colour
 * mapping still opens, and every reader supplies its own defaults. Chasing Excel's full output
 * would add hundreds of lines that no reader needs.
 */
import { ChartData, ChartKind } from "./charts";

const C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** XML text escaping. Sheet names and series names are user text and reach the file verbatim. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * A sheet name as it appears inside a formula reference.
 *
 * Excel wraps a name in single quotes unless it is a bare word, and doubles any quote inside it.
 * Getting this wrong doesn't warn — it produces a chart whose series silently resolve to nothing.
 */
export function quoteSheetName(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`;
}

/** An absolute A1 reference to one column of a range, as a chart formula needs it. */
export function colRef(sheetName: string, colLetter: string, firstRow: number, lastRow: number): string {
  return `${quoteSheetName(sheetName)}!$${colLetter}$${firstRow}:$${colLetter}$${lastRow}`;
}

function strCache(values: string[]): string {
  const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join("");
  return `<c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache>`;
}

function numCache(values: number[]): string {
  const pts = values
    .map((v, i) => (Number.isFinite(v) ? `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>` : ""))
    .join("");
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache>`;
}

export interface SeriesRef {
  /** Series name, and where it came from if it came from a cell. */
  name: string;
  nameRef?: string;
  /** Category labels, and the range they were read from. */
  categories: string[];
  categoriesRef?: string;
  values: number[];
  valuesRef: string;
}

/**
 * One `<c:ser>`.
 *
 * The cached values matter more than they look. A reader that recalculates uses the references; a
 * reader that doesn't — and every previewer and converter falls in that group — draws the cache.
 * Writing references alone gives a chart that is correct and blank.
 */
function series(s: SeriesRef, index: number): string {
  const tx = s.nameRef
    ? `<c:tx><c:strRef><c:f>${esc(s.nameRef)}</c:f>${strCache([s.name])}</c:strRef></c:tx>`
    : `<c:tx><c:v>${esc(s.name)}</c:v></c:tx>`;
  const cat = s.categoriesRef
    ? `<c:cat><c:strRef><c:f>${esc(s.categoriesRef)}</c:f>${strCache(s.categories)}</c:strRef></c:cat>`
    : `<c:cat><c:strLit><c:ptCount val="${s.categories.length}"/>${s.categories
        .map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`)
        .join("")}</c:strLit></c:cat>`;
  return (
    `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>${tx}${cat}` +
    `<c:val><c:numRef><c:f>${esc(s.valuesRef)}</c:f>${numCache(s.values)}</c:numRef></c:val></c:ser>`
  );
}

// Axis ids only have to be unique within the chart and referenced consistently from both sides.
const CAT_AX = 111111111;
const VAL_AX = 222222222;

function axes(): string {
  return (
    `<c:catAx><c:axId val="${CAT_AX}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${VAL_AX}"/></c:catAx>` +
    `<c:valAx><c:axId val="${VAL_AX}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="${CAT_AX}"/></c:valAx>`
  );
}

function plot(kind: ChartKind, sers: string): string {
  if (kind === "pie") {
    // No axes on a pie, and varyColors so the slices aren't all one colour.
    return `<c:pieChart><c:varyColors val="1"/>${sers}<c:firstSliceAng val="0"/></c:pieChart>`;
  }
  if (kind === "line") {
    return (
      `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}` +
      `<c:marker val="1"/><c:axId val="${CAT_AX}"/><c:axId val="${VAL_AX}"/></c:lineChart>${axes()}`
    );
  }
  return (
    `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}` +
    `<c:gapWidth val="150"/><c:axId val="${CAT_AX}"/><c:axId val="${VAL_AX}"/></c:barChart>${axes()}`
  );
}

/** The complete `xl/charts/chartN.xml` part. */
export function chartXml(kind: ChartKind, sers: SeriesRef[], title?: string): string {
  const titlePart = title
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${esc(title)}</a:t></a:r></a:p></c:rich></c:tx>` +
      `<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    : `<c:autoTitleDeleted val="1"/>`;
  // A pie has one series, so its legend names the slices; otherwise it names the series.
  const legend = `<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<c:chartSpace xmlns:c="${C}" xmlns:a="${A}" xmlns:r="${R}">` +
    `<c:chart>${titlePart}<c:plotArea><c:layout/>` +
    plot(kind, sers.map(series).join("")) +
    `</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`
  );
}

export interface ChartPlacement {
  /** Zero-based cell the chart's top-left corner is pinned to. */
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
}

/** One `<xdr:twoCellAnchor>` holding a chart, for the worksheet's drawing part. */
export function drawingAnchorXml(place: ChartPlacement, relId: string, id: number, name: string): string {
  return (
    `<xdr:twoCellAnchor>` +
    `<xdr:from><xdr:col>${place.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff>` +
    `<xdr:row>${place.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>${place.toCol}</xdr:col><xdr:colOff>0</xdr:colOff>` +
    `<xdr:row>${place.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    `<xdr:graphicFrame macro="">` +
    `<xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="${esc(name)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic><a:graphicData uri="${C}"><c:chart xmlns:c="${C}" xmlns:r="${R}" r:id="${relId}"/></a:graphicData></a:graphic>` +
    `</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  );
}

/** An empty `xl/drawings/drawingN.xml`, for a sheet that has no drawing yet. */
export function emptyDrawingXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${A}"/>`
  );
}

/** Inserts anchors into a drawing part, whether or not it already holds any. */
export function addAnchorsToDrawing(drawingXml: string, anchors: string[]): string {
  if (anchors.length === 0) return drawingXml;
  const body = anchors.join("");
  // A drawing with nothing in it is written as a self-closing <xdr:wsDr/>, which has no end tag
  // to insert before — it has to be reopened first.
  const selfClosing = drawingXml.match(/<xdr:wsDr([^>]*?)\/>/);
  if (selfClosing) {
    return drawingXml.replace(selfClosing[0], `<xdr:wsDr${selfClosing[1]}>${body}</xdr:wsDr>`);
  }
  return drawingXml.replace(/<\/xdr:wsDr>\s*$/, `${body}</xdr:wsDr>`);
}

/** Converts a computed ChartData into the series references a chart part needs. */
export function seriesRefsFrom(
  data: ChartData,
  sheetName: string,
  range: { startRow: number; startCol: number; endRow: number; endCol: number },
  columnLetter: (col: number) => string,
  seriesIndex = 0,
  pie = false
): SeriesRef[] {
  // Rows and columns are zero-based in the model and one-based in a formula.
  const firstDataRow = range.startRow + (data.usedHeaderRow ? 1 : 0) + 1;
  const lastDataRow = range.endRow + 1;
  const labelCol = data.usedLabelColumn ? range.startCol : null;
  const categoriesRef =
    labelCol === null ? undefined : colRef(sheetName, columnLetter(labelCol), firstDataRow, lastDataRow);

  const chosen = pie ? data.series.slice(seriesIndex, seriesIndex + 1) : data.series;
  return chosen.map((s, i) => {
    const sourceIndex = pie ? seriesIndex : i;
    // Series sit in the range's columns, after the label column when there is one.
    const col = range.startCol + (data.usedLabelColumn ? 1 : 0) + sourceIndex;
    const letter = columnLetter(col);
    return {
      name: s.name,
      nameRef: data.usedHeaderRow
        ? `${quoteSheetName(sheetName)}!$${letter}$${range.startRow + 1}`
        : undefined,
      categories: data.labels,
      categoriesRef,
      // A gap in the data is a point the cache simply omits, which is what dispBlanksAs="gap" means.
      values: s.points.map((v) => (v === null ? NaN : v)),
      valuesRef: colRef(sheetName, letter, firstDataRow, lastDataRow),
    };
  });
}
