import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { colToLetters, rangeRefString } from "./formulaEngine/address";
import { chartDataFrom } from "./charts";
import { chartToSvg, svgToPngDataUrl } from "./chartImage";
import { chartAnchorOf } from "./gridGeometry";
import { ComputedSheet, SheetModel } from "./sheet";
import { downloadBlob } from "./excelIO";

/** Trims fully-empty trailing rows/columns so the PDF isn't mostly blank space. */
function trimBounds(display: string[][], rows: number, cols: number) {
  let lastRow = -1;
  let lastCol = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((display[r]?.[c] ?? "") !== "") {
        lastRow = Math.max(lastRow, r);
        lastCol = Math.max(lastCol, c);
      }
    }
  }
  return { lastRow: Math.max(lastRow, 0), lastCol: Math.max(lastCol, 0) };
}

/**
 * Lays the sheet's charts out under the table, one per row, each with its range as a caption.
 *
 * Under rather than where they sit on the grid: a chart floats over cells that a paginated table
 * has already moved somewhere else, so "the same place" has no meaning on a page. Printing them in
 * order after the numbers is the arrangement a reader can actually follow.
 *
 * Like the .xlsx path these are pictures, since jsPDF has no chart of its own either.
 */
async function addCharts(doc: jsPDF, sheet: SheetModel, computed: ComputedSheet, startY: number) {
  const charts = sheet.charts ?? [];
  if (charts.length === 0) return;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = startY + 8;

  for (const chart of charts) {
    const anchor = chartAnchorOf(sheet, chart);
    const picture = chartToSvg(chart.kind, chartDataFrom(computed.values, chart.range), anchor.w, anchor.h, chart.seriesIndex);
    if (!picture) continue;

    // Points, not pixels: a 300px chart at 96dpi is 225pt, and placing it at 300 would run it off
    // the page at anything but the smallest size.
    const w = Math.min((picture.width * 72) / 96, pageW - margin * 2);
    const h = (picture.height / picture.width) * w;

    if (y + h + 10 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(9);
    doc.text(rangeRefString(chart.range.startRow, chart.range.startCol, chart.range.endRow, chart.range.endCol), margin, y);
    y += 4;
    try {
      doc.addImage(await svgToPngDataUrl(picture), "PNG", margin, y, w, h);
    } catch {
      // Canvas is unavailable outside a browser; a missing picture beats a missing document.
    }
    y += h + 10;
  }
}

export async function exportSheetToPdf(sheet: SheetModel, computed: ComputedSheet, title = "ExcelToGo") {
  const { lastRow, lastCol } = trimBounds(computed.display, sheet.rows, sheet.cols);
  const head = [["", ...Array.from({ length: lastCol + 1 }, (_, c) => colToLetters(c))]];
  const body = Array.from({ length: lastRow + 1 }, (_, r) => [
    String(r + 1),
    ...Array.from({ length: lastCol + 1 }, (_, c) => computed.display[r]?.[c] ?? ""),
  ]);

  const doc = new jsPDF({ orientation: lastCol > 8 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(title, 14, 14);

  autoTable(doc, {
    head,
    body,
    startY: 20,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 0: { fontStyle: "bold", fillColor: [243, 244, 246] } },
  });

  // autoTable records where it stopped on the document; charts go below that rather than on top.
  const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20;
  await addCharts(doc, sheet, computed, afterTable);

  const blob = doc.output("blob");
  downloadBlob(blob, `${title}.pdf`);
}
