import { commentKey } from "./cellComments";
import { chartDataFrom } from "./charts";
import { chartToSvg, svgToPngDataUrl } from "./chartImage";
import { chartAnchorOf, columnWidth, rowHeight } from "./gridGeometry";
import ExcelJS from "exceljs";
import { ComputedSheet, SheetModel, createEmptySheet } from "./sheet";
import { isError } from "./formulaEngine/types";
import {
  CellAlign,
  CellBorders,
  CellVAlign,
  DEFAULT_FONT_SIZE,
  EXCEL_NUM_FMT,
  numberFormatFromExcelNumFmt,
  ptToPx,
  pxToPt,
} from "./cellFormat";
import { cellKey, excelWidthToPx, parseValidationList, pxToExcelWidth, SheetTemplate } from "./sheetTemplate";
import { parseRangeRef, parseCellRef, rangeRefString } from "./formulaEngine/address";
import { MergeRange, parseMergeRef } from "./sheetMerges";
import { CfRule, CfComparison, CfTest } from "./conditionalFormat";

function hexToArgb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

function argbToHex(argb: string | undefined): string | undefined {
  if (!argb || argb.length < 6) return undefined;
  return `#${argb.slice(-6).toLowerCase()}`;
}

/** Excel worksheet names can't contain \ / * ? : [ ] and are capped at 31 characters. */
function sanitizeSheetName(name: string, usedNames: Set<string>): string {
  const clean = name.replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 31) || "Sheet";
  let unique = clean;
  let i = 2;
  while (usedNames.has(unique)) {
    const suffix = ` (${i})`;
    unique = clean.slice(0, 31 - suffix.length) + suffix;
    i += 1;
  }
  usedNames.add(unique);
  return unique;
}

/** A solid pattern fill is what a coloured band actually is in Excel. Gradient and pattern fills
 *  have no single colour to show, so they're left alone rather than guessed at. */
function fillColorOf(cell: ExcelJS.Cell): string | undefined {
  const fill = cell.fill;
  if (!fill || fill.type !== "pattern" || fill.pattern !== "solid") return undefined;
  return argbToHex(fill.fgColor?.argb);
}

const BORDER_DEFAULT = "#94a3b8";

function bordersOf(cell: ExcelJS.Cell): CellBorders | undefined {
  const b = cell.border;
  if (!b) return undefined;
  const out: CellBorders = {};
  for (const edge of ["top", "right", "bottom", "left"] as const) {
    const side = b[edge];
    if (side?.style) out[edge] = argbToHex(side.color?.argb) ?? BORDER_DEFAULT;
  }
  return Object.keys(out).length > 0 ? out : undefined;
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

/** Reads the values a dropdown points at, for a validation list given as a range instead of an
 *  inline list. Runs after the cells are in, so it reads the sheet we just built. */

/**
 * Conditional formatting, translated to and from the shapes ExcelJS writes.
 *
 * Worth carrying across: a sheet whose colours came from rules loses its whole point when it
 * opens as a flat grid in Excel, and a file that arrives with rules should behave here the way it
 * does there rather than looking subtly wrong.
 */

/** OOXML's `cellIs` operators. ExcelJS's own type lists only four of them while its serializer
 *  writes whatever it is given, so the wider real set is declared here and cast at the boundary. */
const CF_OPERATOR_TO_EXCEL: Record<CfComparison, string> = {
  gt: "greaterThan",
  lt: "lessThan",
  gte: "greaterThanOrEqual",
  lte: "lessThanOrEqual",
  eq: "equal",
  ne: "notEqual",
  between: "between",
};

const CF_OPERATOR_FROM_EXCEL: Record<string, CfComparison> = Object.fromEntries(
  Object.entries(CF_OPERATOR_TO_EXCEL).map(([ours, theirs]) => [theirs, ours as CfComparison])
);

function cfStyleToExcel(rule: CfRule): Partial<ExcelJS.Style> | undefined {
  if (!rule.style) return undefined;
  const style: Partial<ExcelJS.Style> = {};
  if (rule.style.bold || rule.style.color) {
    style.font = {
      bold: rule.style.bold || undefined,
      color: rule.style.color ? { argb: hexToArgb(rule.style.color) } : undefined,
    } as ExcelJS.Font;
  }
  if (rule.style.fill) {
    // A conditional format's fill lives in a dxf record, where Excel reads the *background*
    // colour of the pattern — setting only fgColor gives a rule that highlights nothing.
    style.fill = {
      type: "pattern",
      pattern: "solid",
      bgColor: { argb: hexToArgb(rule.style.fill) },
      fgColor: { argb: hexToArgb(rule.style.fill) },
    };
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function writeConditionalFormats(worksheet: ExcelJS.Worksheet, sheet: SheetModel) {
  const rules = sheet.conditionalRules ?? [];
  rules.forEach((rule, i) => {
    const ref = rangeRefString(rule.range.startRow, rule.range.startCol, rule.range.endRow, rule.range.endCol);
    const style = cfStyleToExcel(rule);
    // Excel treats priority 1 as the top of the list and applies it last-word-wins in reverse,
    // so a rule later in our list — which overrides the ones above it here — gets a lower number.
    const priority = rules.length - i;
    const test = rule.test;
    switch (test.kind) {
      case "compare":
        worksheet.addConditionalFormatting({
          ref,
          rules: [
            {
              type: "cellIs",
              priority,
              operator: CF_OPERATOR_TO_EXCEL[test.op] as ExcelJS.CellIsRuleType["operator"],
              formulae: test.op === "between" ? [String(test.value), String(test.value2 ?? test.value)] : [String(test.value)],
              style,
            },
          ],
        });
        break;
      case "textContains":
        worksheet.addConditionalFormatting({
          ref,
          rules: [{ type: "containsText", priority, operator: "containsText", text: test.text, style }],
        });
        break;
      case "rank":
        worksheet.addConditionalFormatting({
          ref,
          rules: [{ type: "top10", priority, rank: test.count, percent: false, bottom: test.bottom, style }],
        });
        break;
      case "colorScale":
        worksheet.addConditionalFormatting({
          ref,
          rules: [
            {
              type: "colorScale",
              priority,
              cfvo: test.mid
                ? [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }]
                : [{ type: "min" }, { type: "max" }],
              color: (test.mid ? [test.min, test.mid, test.max] : [test.min, test.max]).map((c) => ({ argb: hexToArgb(c) })),
            },
          ],
        });
        break;
      case "dataBar":
        worksheet.addConditionalFormatting({
          ref,
          rules: [
            {
              type: "dataBar",
              priority,
              cfvo: [{ type: "min" }, { type: "max" }],
              color: { argb: hexToArgb(test.color) },
            } as ExcelJS.DataBarRuleType,
          ],
        });
        break;
    }
  });
}

/** ExcelJS exposes rules read back from a file on the worksheet, but doesn't declare them. */
interface ReadableConditionalFormatting {
  ref?: string;
  rules?: Record<string, unknown>[];
}

function readConditionalFormats(worksheet: ExcelJS.Worksheet): CfRule[] | undefined {
  const formattings = (worksheet as unknown as { conditionalFormattings?: ReadableConditionalFormatting[] }).conditionalFormattings;
  if (!Array.isArray(formattings)) return undefined;

  const out: CfRule[] = [];
  formattings.forEach((formatting, fi) => {
    // A single ref can list several areas ("A1:A5 C1:C5"); each becomes its own rule here.
    const refs = String(formatting.ref ?? "").split(/\s+/).filter(Boolean);
    for (const refPart of refs) {
      const range = parseRangeRef(refPart.replace(/\$/g, ""));
      if (!range) continue;
      (formatting.rules ?? []).forEach((raw, ri) => {
        const test = excelRuleToTest(raw);
        if (!test) return;
        out.push({
          id: `cf-import-${fi}-${ri}-${refPart}`,
          range,
          test,
          style: excelRuleToStyle(raw),
        });
      });
    }
  });
  return out.length > 0 ? out : undefined;
}

function firstNumber(formulae: unknown): number | null {
  if (!Array.isArray(formulae) || formulae.length === 0) return null;
  const n = Number(formulae[0]);
  return Number.isFinite(n) ? n : null;
}

function excelRuleToTest(raw: Record<string, unknown>): CfTest | null {
  switch (raw.type) {
    case "cellIs": {
      const op = CF_OPERATOR_FROM_EXCEL[String(raw.operator)];
      const value = firstNumber(raw.formulae);
      if (!op || value === null) return null;
      const second = Array.isArray(raw.formulae) ? Number(raw.formulae[1]) : NaN;
      return { kind: "compare", op, value, value2: Number.isFinite(second) ? second : undefined };
    }
    case "containsText": {
      // OOXML stores the search term twice: as a `text` attribute and inside the formula Excel
      // actually evaluates. ExcelJS hands back only the formula, so the term is read out of
      // `SEARCH("…",B1)` — without this the rule imports with nothing to search for and silently
      // matches no cell.
      const fromAttribute = typeof raw.text === "string" ? raw.text : "";
      const formula = Array.isArray(raw.formulae) ? String(raw.formulae[0] ?? "") : "";
      const fromFormula = /SEARCH\(\s*"((?:[^"]|"")*)"/i.exec(formula)?.[1]?.replace(/""/g, '"') ?? "";
      const text = fromAttribute || fromFormula;
      return text === "" ? null : { kind: "textContains", text };
    }
    case "top10": {
      const rank = Number(raw.rank);
      // A percent-based top 10 asks a different question than a count and would import as a lie.
      if (!Number.isFinite(rank) || raw.percent === true) return null;
      return { kind: "rank", bottom: raw.bottom === true, count: rank };
    }
    case "colorScale": {
      const colors = Array.isArray(raw.color) ? raw.color.map((c) => argbToHex((c as ExcelJS.Color)?.argb)) : [];
      const usable = colors.filter((c): c is string => Boolean(c));
      if (usable.length < 2) return null;
      return usable.length >= 3
        ? { kind: "colorScale", min: usable[0], mid: usable[1], max: usable[usable.length - 1] }
        : { kind: "colorScale", min: usable[0], max: usable[1] };
    }
    case "dataBar": {
      const color = argbToHex((raw.color as ExcelJS.Color)?.argb);
      return { kind: "dataBar", color: color ?? "#6ee7b7" };
    }
    default:
      // Icon sets, above-average and time-period rules have no equivalent here. Dropping one is
      // better than importing it as something it isn't.
      return null;
  }
}

function excelRuleToStyle(raw: Record<string, unknown>): CfRule["style"] {
  const style = raw.style as Partial<ExcelJS.Style> | undefined;
  if (!style) return undefined;
  const fillColor = style.fill && style.fill.type === "pattern" ? style.fill.bgColor?.argb ?? style.fill.fgColor?.argb : undefined;
  const out = {
    fill: argbToHex(fillColor),
    color: argbToHex(style.font?.color?.argb),
    bold: style.font?.bold || undefined,
  };
  return out.fill || out.color || out.bold ? out : undefined;
}

function rangeReader(sheet: SheetModel) {
  return (ref: string): string[] => {
    const range = parseRangeRef(ref.replace(/^.*!/, ""));
    if (!range) return [];
    const out: string[] = [];
    for (let r = range.startRow; r <= Math.min(range.endRow, sheet.rows - 1); r++) {
      for (let c = range.startCol; c <= Math.min(range.endCol, sheet.cols - 1); c++) {
        const v = sheet.cells[r]?.[c];
        if (v) out.push(v);
      }
    }
    return out;
  };
}

function importWorksheet(worksheet: ExcelJS.Worksheet): SheetModel {
  const rowCount = Math.max(worksheet.actualRowCount || 0, 1);
  const colCount = Math.max(worksheet.actualColumnCount || 0, 1);
  const rows = Math.max(rowCount, 20);
  const cols = Math.max(colCount, 10);

  const sheet = createEmptySheet(rows, cols);
  // Only a protected sheet makes "locked" mean anything: that's the file telling us it was built
  // as a form, with the unlocked cells as the fields. An unprotected file is just a spreadsheet.
  const isTemplate = (worksheet as unknown as { sheetProtection?: { sheet?: boolean } }).sheetProtection?.sheet === true;
  const inputs: Record<string, true> = {};
  const comments: Record<string, string> = {};
  const validations: { key: string; formulae: unknown[] }[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const r = rowNumber - 1;
      const c = colNumber - 1;
      if (r < sheet.rows && c < sheet.cols) {
        sheet.cells[r][c] = cellValueToRaw(cell);
        const align = cell.alignment?.horizontal;
        const valign = cell.alignment?.vertical;
        const format = {
          bold: cell.font?.bold || undefined,
          color: argbToHex(cell.font?.color?.argb),
          align: align === "left" || align === "center" || align === "right" ? (align as CellAlign) : undefined,
          numberFormat:
            cell.numFmt && cell.numFmt !== "General" ? numberFormatFromExcelNumFmt(cell.numFmt) : undefined,
          fill: fillColorOf(cell),
          // Only carry a size that differs from Excel's default, so a plain file doesn't end up
          // with an explicit font size on every single cell.
          fontSize: cell.font?.size && cell.font.size !== DEFAULT_FONT_SIZE ? cell.font.size : undefined,
          italic: cell.font?.italic || undefined,
          underline: cell.font?.underline ? true : undefined,
          valign: valign === "top" || valign === "middle" || valign === "bottom" ? (valign as CellVAlign) : undefined,
          borders: bordersOf(cell),
        };
        if (Object.values(format).some((v) => v !== undefined)) {
          sheet.formats[r][c] = format;
        }
        const note = noteText(cell.note);
        if (note) comments[commentKey(r, c)] = note;
      }
    });
  });

  // A template's input cells are precisely the ones still empty, waiting to be filled — and
  // `eachCell` skips empty cells. So protection and validation get their own pass over the used
  // range; scanning only the cells that already hold a value would find almost no fields at all.
  if (isTemplate) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = worksheet.getCell(r + 1, c + 1);
        // Excel omits `protection` entirely for the default (locked), so only an explicit
        // `locked: false` marks an input field.
        if (cell.protection?.locked === false) inputs[cellKey(r, c)] = true;
        const dv = cell.dataValidation;
        if (dv?.type === "list" && Array.isArray(dv.formulae)) validations.push({ key: cellKey(r, c), formulae: dv.formulae });
      }
    }
  }

  if (Object.keys(comments).length > 0) sheet.comments = comments;

  const widths: (number | undefined)[] = [];
  let anyWidth = false;
  for (let c = 0; c < cols; c++) {
    const px = excelWidthToPx(worksheet.getColumn(c + 1)?.width);
    widths[c] = px;
    if (px !== undefined) anyWidth = true;
  }
  if (anyWidth) sheet.colWidths = widths;

  const heights: (number | undefined)[] = [];
  let anyHeight = false;
  for (let r = 0; r < rows; r++) {
    const px = ptToPx(worksheet.getRow(r + 1)?.height);
    heights[r] = px;
    if (px !== undefined) anyHeight = true;
  }
  if (anyHeight) sheet.rowHeights = heights;

  // A form's title band is usually one cell merged across several columns; without this the
  // title lands in column A and the band breaks up behind it.
  const merges = (worksheet.model?.merges ?? [])
    .map((ref) => parseMergeRef(ref, parseCellRef))
    .filter((m): m is MergeRange => m !== null && m.endRow < rows && m.endCol < cols);
  if (merges.length > 0) sheet.merges = merges;

  if (isTemplate) {
    const readRange = rangeReader(sheet);
    const choices: Record<string, string[]> = {};
    for (const v of validations) {
      const options = parseValidationList(v.formulae, readRange);
      if (options) choices[v.key] = options;
    }
    const template: SheetTemplate = { inputs, choices };
    // A protected sheet with nothing unlocked is a locked-down report, not a form to fill in —
    // treating it as a template would leave the user staring at a sheet they cannot touch.
    if (Object.keys(inputs).length > 0) sheet.template = template;
  }

  sheet.conditionalRules = readConditionalFormats(worksheet);
  return sheet;
}

/**
 * The text of a cell's note.
 *
 * ExcelJS hands back a plain string for a note it wrote itself, but a rich-text object for one
 * Excel wrote, and the two are indistinguishable at the call site. Reading only the string form
 * would silently drop every comment in a file that came from Excel — which is every file that
 * matters here.
 */
function noteText(note: unknown): string {
  if (typeof note === "string") return note.trim();
  if (note && typeof note === "object" && "texts" in note) {
    const texts = (note as { texts?: { text?: string }[] }).texts ?? [];
    return texts.map((t) => t.text ?? "").join("").trim();
  }
  return "";
}

export interface ImportedSheet {
  name: string;
  sheet: SheetModel;
}

/** Imports every worksheet in the workbook (not just the first) as a separate tab. */
export async function importWorkbookFromFile(file: File): Promise<ImportedSheet[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (workbook.worksheets.length === 0) {
    return [{ name: "Sheet1", sheet: createEmptySheet() }];
  }
  return workbook.worksheets.map((worksheet) => ({
    name: worksheet.name || "Sheet1",
    sheet: importWorksheet(worksheet),
  }));
}

async function writeSheetToWorksheet(worksheet: ExcelJS.Worksheet, sheet: SheetModel, computed: ComputedSheet) {
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
      if (format?.bold || format?.color || format?.fontSize || format?.italic || format?.underline) {
        cell.font = {
          bold: format.bold || undefined,
          italic: format.italic || undefined,
          underline: format.underline || undefined,
          size: format.fontSize,
          color: format.color ? { argb: hexToArgb(format.color) } : undefined,
        };
      }
      if (format?.align || format?.valign) {
        cell.alignment = { horizontal: format.align, vertical: format.valign };
      }
      if (format?.numberFormat && EXCEL_NUM_FMT[format.numberFormat]) {
        cell.numFmt = EXCEL_NUM_FMT[format.numberFormat]!;
      }
      if (format?.fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb(format.fill) } };
      }
      if (format?.borders) {
        const side = (color: string | undefined) => (color ? { style: "thin" as const, color: { argb: hexToArgb(color) } } : undefined);
        cell.border = {
          top: side(format.borders.top),
          right: side(format.borders.right),
          bottom: side(format.borders.bottom),
          left: side(format.borders.left),
        };
      }
    }
  }
  // Carry a template's structure back out, so a file that came in as a form goes out as one.
  const template = sheet.template;
  if (template) {
    for (let r = 0; r < sheet.rows; r++) {
      for (let c = 0; c < sheet.cols; c++) {
        if (template.inputs[cellKey(r, c)]) {
          const cell = worksheet.getCell(r + 1, c + 1);
          cell.protection = { locked: false };
          const options = template.choices[cellKey(r, c)];
          if (options) {
            cell.dataValidation = {
              type: "list",
              allowBlank: true,
              formulae: [`"${options.join(",")}"`],
            };
          }
        }
      }
    }
    // Without protecting the sheet the unlocked flags are inert — Excel would let anyone type
    // anywhere, which is the one thing the template exists to prevent.
    await worksheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });
  }

  for (const [key, text] of Object.entries(sheet.comments ?? {})) {
    const [r, c] = key.split(",").map(Number);
    worksheet.getCell(r + 1, c + 1).note = text;
  }

  for (const m of sheet.merges ?? []) {
    worksheet.mergeCells(m.startRow + 1, m.startCol + 1, m.endRow + 1, m.endCol + 1);
  }

  writeConditionalFormats(worksheet, sheet);

  worksheet.columns.forEach((col, i) => {
    col.width = pxToExcelWidth(sheet.colWidths?.[i]) ?? 16;
  });
  sheet.rowHeights?.forEach((px, i) => {
    const pt = pxToPt(px);
    if (pt !== undefined) worksheet.getRow(i + 1).height = pt;
  });
}

export interface ExportableSheet {
  name: string;
  sheet: SheetModel;
  computed: ComputedSheet;
}

/**
 * Puts each of a sheet's charts into the worksheet as a picture, anchored to the cell it sits on.
 *
 * A picture, not a chart: ExcelJS writes no chart XML — `addImage` is the entire drawing API — so
 * there is no way to hand Excel something it would keep redrawing. The image stops updating when
 * the numbers change, which the README says out loud rather than leaving to be discovered.
 *
 * A chart that fails to draw is skipped rather than aborting the export: losing a picture is a far
 * smaller loss than losing the file.
 */
async function writeCharts(workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet, sheet: SheetModel, computed: ComputedSheet) {
  for (const chart of sheet.charts ?? []) {
    const anchor = chartAnchorOf(sheet, chart);
    const data = chartDataFrom(computed.values, chart.range);
    const picture = chartToSvg(chart.kind, data, anchor.w, anchor.h, chart.seriesIndex);
    if (!picture) continue;
    try {
      const imageId = workbook.addImage({ base64: await svgToPngDataUrl(picture), extension: "png" });
      worksheet.addImage(imageId, {
        // ExcelJS counts from zero here, unlike getCell, and takes the offset as a fraction of the
        // cell — hence the division rather than a pixel value.
        tl: {
          col: anchor.col + Math.max(0, anchor.dx) / columnWidth(sheet, anchor.col),
          row: anchor.row + Math.max(0, anchor.dy) / rowHeight(sheet, anchor.row),
        },
        ext: { width: picture.width, height: picture.height },
        editAs: "oneCell",
      });
    } catch {
      // Canvas is unavailable outside a browser, and a chart is not worth failing an export over.
    }
  }
}

/** Exports every tab as its own worksheet in a single .xlsx file, in order. */
export async function exportWorkbookToXlsxBlob(sheets: ExportableSheet[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();
  for (const { name, sheet, computed } of sheets) {
    const worksheet = workbook.addWorksheet(sanitizeSheetName(name, usedNames));
    await writeSheetToWorksheet(worksheet, sheet, computed);
    await writeCharts(workbook, worksheet, sheet, computed);
  }
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
