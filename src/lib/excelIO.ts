import ExcelJS from "exceljs";
import { ComputedSheet, SheetModel, createEmptySheet } from "./sheet";
import { isError } from "./formulaEngine/types";
import { CellAlign, EXCEL_NUM_FMT, numberFormatFromExcelNumFmt } from "./cellFormat";

function hexToArgb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

function argbToHex(argb: string | undefined): string | undefined {
  if (!argb || argb.length < 6) return undefined;
  return `#${argb.slice(-6).toLowerCase()}`;
}

function cellValueToRaw(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v !== "object") return String(v);
  if ("formula" in v && typeof v.formula === "string") {
    return `=${v.formula}`;
  }
  if ("richText" in v && Array.isArray(v.richText)) {
    return v.richText.map((r) => r.text).join("");
  }
  if ("text" in v && typeof v.text === "string") {
    return v.text;
  }
  if ("result" in v) {
    const result = v.result;
    return result === undefined || result === null ? "" : String(result);
  }
  return "";
}

export async function importWorkbookFromFile(file: File): Promise<SheetModel> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return createEmptySheet();

  const rowCount = Math.max(worksheet.actualRowCount || 0, 1);
  const colCount = Math.max(worksheet.actualColumnCount || 0, 1);
  const rows = Math.max(rowCount, 20);
  const cols = Math.max(colCount, 10);

  const sheet = createEmptySheet(rows, cols);
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const r = rowNumber - 1;
      const c = colNumber - 1;
      if (r < sheet.rows && c < sheet.cols) {
        sheet.cells[r][c] = cellValueToRaw(cell);
        const align = cell.alignment?.horizontal;
        const format = {
          bold: cell.font?.bold || undefined,
          color: argbToHex(cell.font?.color?.argb),
          align: align === "left" || align === "center" || align === "right" ? (align as CellAlign) : undefined,
          numberFormat:
            cell.numFmt && cell.numFmt !== "General" ? numberFormatFromExcelNumFmt(cell.numFmt) : undefined,
        };
        if (Object.values(format).some((v) => v !== undefined)) {
          sheet.formats[r][c] = format;
        }
      }
    });
  });
  return sheet;
}

export async function exportSheetToXlsxBlob(sheet: SheetModel, computed: ComputedSheet): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");

  for (let r = 0; r < sheet.rows; r++) {
    for (let c = 0; c < sheet.cols; c++) {
      const raw = sheet.cells[r][c];
      const cell = worksheet.getCell(r + 1, c + 1);
      if (raw.startsWith("=") && raw.length > 1) {
        const computedValue = computed.values[r][c];
        cell.value = {
          formula: raw.slice(1),
          result: isError(computedValue) || computedValue === null ? undefined : computedValue,
        };
      } else if (raw === "") {
        // leave blank
      } else {
        const n = Number(raw);
        cell.value = raw.trim() !== "" && !Number.isNaN(n) ? n : raw;
      }

      const format = sheet.formats[r]?.[c];
      if (format?.bold || format?.color) {
        cell.font = { bold: format.bold || undefined, color: format.color ? { argb: hexToArgb(format.color) } : undefined };
      }
      if (format?.align) {
        cell.alignment = { horizontal: format.align };
      }
      if (format?.numberFormat && EXCEL_NUM_FMT[format.numberFormat]) {
        cell.numFmt = EXCEL_NUM_FMT[format.numberFormat]!;
      }
    }
  }
  worksheet.columns.forEach((col) => {
    col.width = 16;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
