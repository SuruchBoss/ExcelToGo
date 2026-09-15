import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { colToLetters, rangeRefString } from "./formulaEngine/address";
import { chartDataFrom } from "./charts";
import { chartToSvg, svgToPngDataUrl } from "./chartImage";
import { chartAnchorOf } from "./gridGeometry";
import { THAI_FONT_NAME, registerThaiFont } from "./pdfFont";
import { planThaiMarks } from "./thaiMarks";
import { ComputedSheet, SheetModel } from "./sheet";
import { downloadBlob } from "./excelIO";

/**
 * How far above its normal spot a stacked tone mark is drawn, as a fraction of the font size.
 *
 * Calibrated against a real shaper rather than guessed. The same words were rendered in a browser,
 * which applies the font's GPOS rules properly, and the gap between the bottom of the tone mark and
 * the top of the vowel underneath it measured 0.047em. Rendering the PDF at a range of rises and
 * measuring the same gap gave 0.18em -> 0.035 and 0.22em -> 0.076, so 0.19em lands on the target.
 *
 * Too small and the two marks touch; too large and the tone drifts off its syllable and starts
 * crowding the line above.
 */
const MARK_RISE_EM = 0.19;

/**
 * Teaches one jsPDF document to draw stacked Thai marks in the right place.
 *
 * It patches `text` on the instance because that is the single funnel every string goes through —
 * autoTable renders each cell with `doc.text(text, x, y)` (it works out alignment itself and passes
 * no align option), so patching here fixes the table, the title and anything added later, without
 * autoTable needing to know Thai exists.
 *
 * The string is drawn once with the colliding marks removed, then each of those marks is drawn
 * again on its own, at the width of everything before it and one rise higher. Thai marks have a
 * zero advance, so taking them out moves nothing and every other glyph lands exactly where it did.
 */
export function fixThaiMarks(doc: jsPDF): void {
  const original = doc.text.bind(doc);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jsPDF's text() has eight overloads
  (doc as any).text = function patched(text: any, x: number, y: number, ...rest: any[]) {
    // autoTable hands every cell over as a *string array*, one entry per wrapped line — not as a
    // string. Checking only for a string is what made the first version of this a silent no-op for
    // every cell in the table.
    const lines: string[] = typeof text === "string" ? [text] : Array.isArray(text) ? text : [];
    if (lines.length === 0 || !lines.every((l) => typeof l === "string")) {
      return original(text, x, y, ...rest);
    }

    const plans = lines.map(planThaiMarks);
    if (plans.every((p) => p.raised.length === 0)) return original(text, x, y, ...rest);

    // The whole scheme rests on Thai marks having a zero advance, which is what lets a mark be
    // taken out of a line without moving anything after it. Rather than assume it, check it: a font
    // that gave its marks width would silently shift every glyph past the first mark, so in that
    // case draw the text untouched and accept the collision instead of mangling the line.
    const zeroAdvance = plans.every((p, i) => doc.getTextWidth(p.base) === doc.getTextWidth(lines[i]));
    if (!zeroAdvance) return original(text, x, y, ...rest);

    const drawn = plans.map((p) => p.base);
    const result = original(typeof text === "string" ? drawn[0] : drawn, x, y, ...rest);

    // Both in document units: the font size is in points, and a line's advance comes back in points
    // too, so each is divided by the points-per-unit factor before being used as a distance.
    const rise = (doc.getFontSize() * MARK_RISE_EM) / doc.internal.scaleFactor;
    const lineStep = doc.getLineHeight() / doc.internal.scaleFactor;
    plans.forEach((plan, line) => {
      for (const mark of plan.raised) {
        original(mark.char, x + doc.getTextWidth(mark.prefix), y + line * lineStep - rise, ...rest);
      }
    });
    return result;
  };
}

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
  // Without this every Thai character in the table comes out as an unrelated Latin glyph, because
  // the standard PDF fonts contain no Thai at all. Falls back silently if the font can't be
  // fetched — a PDF with wrong glyphs beats no PDF.
  const thai = await registerThaiFont(doc);
  const font = thai ? THAI_FONT_NAME : undefined;
  // Only worth doing with the Thai font in place: the fallback has no Thai glyphs to stack, and
  // the rise is measured against this font's vowel heights.
  if (thai) fixThaiMarks(doc);
  doc.setFontSize(14);
  doc.text(title, 14, 14);

  autoTable(doc, {
    head,
    body,
    startY: 20,
    styles: { fontSize: 8, cellPadding: 2, font },
    headStyles: { fillColor: [37, 99, 235], font },
    columnStyles: { 0: { fontStyle: "bold", fillColor: [243, 244, 246], font } },
  });

  // autoTable records where it stopped on the document; charts go below that rather than on top.
  const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20;
  await addCharts(doc, sheet, computed, afterTable);

  const blob = doc.output("blob");
  downloadBlob(blob, `${title}.pdf`);
}
