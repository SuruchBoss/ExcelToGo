import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { colToLetters } from "./formulaEngine/address";
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

export function exportSheetToPdf(sheet: SheetModel, computed: ComputedSheet, title = "ExcelToGo") {
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

  const blob = doc.output("blob");
  downloadBlob(blob, `${title}.pdf`);
}
