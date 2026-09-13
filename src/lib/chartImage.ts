/**
 * A chart as a picture, for putting into an .xlsx or a PDF.
 *
 * Neither format can take the chart as a chart. ExcelJS writes no chart XML at all — it has
 * `addImage` and nothing else — and jsPDF has no vector chart primitive either. So an exported
 * chart is a picture of the chart: it looks right and it prints right, but it stops updating when
 * the numbers change, and that is worth saying plainly rather than letting someone discover it
 * after sending the file on.
 *
 * The marks come from chartGeometry.ts, the same ones the on-screen chart is built from, so the
 * exported picture cannot drift away from what the user was looking at.
 */
import { ChartData, ChartKind, legendEntries } from "./charts";
import { chartMarks, ChartMark, fitBox } from "./chartGeometry";

/** Rendered at twice the size it is placed at, so the picture isn't soft on a retina screen or in
 *  print. */
const SCALE = 2;
const LEGEND_ROW_H = 14;
const LEGEND_SWATCH = 8;
const LEGEND_GAP = 6;
const LEGEND_FONT = 10;

const escapeXml = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]!);

function markToSvg(mark: ChartMark): string {
  switch (mark.shape) {
    case "line":
      return `<line x1="${mark.x1}" y1="${mark.y1}" x2="${mark.x2}" y2="${mark.y2}" stroke="${mark.stroke}" stroke-width="${mark.width}"/>`;
    case "rect":
      return `<rect x="${mark.x}" y="${mark.y}" width="${mark.w}" height="${mark.h}" fill="${mark.fill}" rx="${mark.rx}"/>`;
    case "text":
      return `<text x="${mark.x}" y="${mark.y}" text-anchor="${mark.anchor}" font-size="${mark.size}" fill="${mark.fill}">${escapeXml(mark.text)}</text>`;
    case "polyline":
      return `<polyline points="${mark.points}" fill="none" stroke="${mark.stroke}" stroke-width="${mark.width}" stroke-linejoin="round"/>`;
    case "circle":
      return `<circle cx="${mark.cx}" cy="${mark.cy}" r="${mark.r}" fill="${mark.fill}"/>`;
    case "path":
      return `<path d="${mark.d}" fill="${mark.fill}"${mark.stroke ? ` stroke="${mark.stroke}" stroke-width="${mark.strokeWidth ?? 1}"` : ""}/>`;
  }
}

export interface ChartPicture {
  svg: string;
  width: number;
  height: number;
}

/**
 * The chart as a standalone SVG document, legend included.
 *
 * The legend is drawn here rather than left to the caller because on screen it is HTML beside the
 * drawing; in a file there is nothing to put HTML in, and a chart whose colours name nothing is
 * the thing this repo already fixed once.
 */
export function chartToSvg(
  kind: ChartKind,
  data: ChartData,
  width: number,
  height: number,
  seriesIndex = 0
): ChartPicture | null {
  const legend = legendEntries(kind, data, seriesIndex);
  const legendRows = legend.length > 0 ? 1 : 0;
  const box = fitBox(width, height - legendRows * LEGEND_ROW_H);
  const marks = chartMarks(kind, data, box, seriesIndex);
  if (marks.length === 0) return null;

  const totalH = box.h + legendRows * LEGEND_ROW_H;
  const body = marks.map(markToSvg).join("");

  let legendSvg = "";
  if (legendRows > 0) {
    const y = box.h + LEGEND_ROW_H / 2;
    let x = 2;
    for (const entry of legend) {
      legendSvg += `<rect x="${x}" y="${y - LEGEND_SWATCH / 2}" width="${LEGEND_SWATCH}" height="${LEGEND_SWATCH}" rx="1.5" fill="${entry.color}"/>`;
      legendSvg += `<text x="${x + LEGEND_SWATCH + 3}" y="${y + LEGEND_FONT / 3}" font-size="${LEGEND_FONT}" fill="#52525b">${escapeXml(entry.label)}</text>`;
      // Laid out by an estimate of the text width rather than by measuring it: measuring needs a
      // DOM, and this has to work the same whether it is called from the browser or from a test.
      x += LEGEND_SWATCH + 3 + entry.label.length * LEGEND_FONT * 0.62 + LEGEND_GAP;
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${totalH}" viewBox="0 0 ${box.w} ${totalH}" ` +
    `font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">` +
    `<rect width="${box.w}" height="${totalH}" fill="#ffffff"/>${body}${legendSvg}</svg>`;

  return { svg, width: box.w, height: totalH };
}

/**
 * Turns that SVG into PNG bytes, which is the only image format both ExcelJS and jsPDF take.
 *
 * Browser-only, like the rest of the export path: it needs a canvas. The SVG goes in as a data URL
 * rather than a blob URL so nothing has to be revoked if the load fails halfway.
 */
export async function svgToPngDataUrl(picture: ChartPicture): Promise<string> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(picture.svg)}`;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("chart image failed to load"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(picture.width * SCALE);
  canvas.height = Math.round(picture.height * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
