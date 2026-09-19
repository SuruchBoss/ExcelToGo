/**
 * CSV in and out, without going through .xlsx.
 *
 * CSV is the format everything else speaks: a bank statement, a POS export, the thing a colleague
 * mails you. Requiring it to be opened in Excel and re-saved as .xlsx first, only to open it here,
 * makes this app the long way round for the most common file there is.
 *
 * Everything here is pure text in, text out. Parsing and quoting are where the bugs live and they
 * are all reachable from a test with a string literal.
 *
 * Three details decide whether this works on real files rather than only on the ones we write:
 *
 * - **The delimiter is not always a comma.** Excel writes the list separator of the machine's
 *   locale, so a file saved in Thailand or most of Europe is semicolon-separated. Assuming a comma
 *   doesn't fail loudly — it loads the whole row into column A, which looks like the app is broken.
 * - **A UTF-8 BOM is what makes Thai readable in Excel.** Without it Excel on Windows guesses the
 *   legacy code page and every Thai file opens as mojibake. We strip it on the way in and write it
 *   on the way out; three bytes are the difference between a usable export and a bug report.
 * - **Quoting is the format.** A field carrying the delimiter, a quote or a newline has to be
 *   quoted, with inner quotes doubled; a parser that splits on the delimiter is wrong the first
 *   time an address or a Thai note contains one.
 */

import { FormulaValue, isError } from "./formulaEngine/types";

/** Delimiters worth sniffing for: comma, the locale semicolon, and tab-separated files. */
const DELIMITERS = [",", ";", "\t"] as const;
export type CsvDelimiter = (typeof DELIMITERS)[number];

/** Strips a UTF-8 BOM. Left in place it becomes part of the first heading, invisibly. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Guesses the delimiter by counting candidates *outside* quotes across the first few lines.
 *
 * Counting inside quotes is what makes naive sniffing pick the wrong character: one quoted address
 * holding "Bangkok, Thailand" outvotes the semicolons that actually separate the columns.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const sample = stripBom(text).slice(0, 64 * 1024);
  const counts = new Map<CsvDelimiter, number>(DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;
  let lines = 0;
  for (let i = 0; i < sample.length; i++) {
    const ch = sample[i];
    if (ch === '"') {
      // A doubled quote inside a quoted field is an escaped quote, not the end of one.
      if (inQuotes && sample[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === "\n") {
      if (++lines >= 20) break;
      continue;
    }
    const d = DELIMITERS.find((cand) => cand === ch);
    if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let best: CsvDelimiter = ",";
  for (const d of DELIMITERS) {
    if ((counts.get(d) ?? 0) > (counts.get(best) ?? 0)) best = d;
  }
  return best;
}

/**
 * Parses CSV into a rectangle of strings, following RFC 4180's quoting.
 *
 * Accepts CRLF, LF and lone CR as line endings, because all three turn up in files people actually
 * have. Rows are padded to the widest one so the caller gets a rectangle rather than a ragged array
 * it has to bounds-check on every access.
 */
export function parseCsv(text: string, delimiter: CsvDelimiter = detectDelimiter(text)): string[][] {
  const src = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAny = false;

  const endField = () => {
    // Reading back what `toCsv` wrote: the apostrophe it adds is ours, so it comes off again and a
    // file exported from here and imported straight back is unchanged. The limit is honest and
    // worth stating: a field that genuinely began with an apostrophe and an `=` in someone else's file is
    // indistinguishable from one we escaped, and loses that apostrophe here. CSV has no way to
    // say "text that happens to look like a formula", so something has to give.
    row.push(unneutraliseCsvField(field));
    field = "";
    sawAny = true;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    sawAny = false;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      sawAny = true;
      continue;
    }
    if (ch === delimiter) {
      endField();
      continue;
    }
    if (ch === "\r") {
      if (src[i + 1] === "\n") i++;
      endRow();
      continue;
    }
    if (ch === "\n") {
      endRow();
      continue;
    }
    field += ch;
    sawAny = true;
  }
  // A file that doesn't end with a newline still has a last row; one that does, doesn't.
  if (field !== "" || row.length > 0 || sawAny) endRow();

  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  return rows.map((r) => (r.length === width ? r : [...r, ...Array(width - r.length).fill("")]));
}

/**
 * CSV injection, and why this file is where it gets stopped.
 *
 * A CSV field is just text until Excel opens it. Anything starting with `=`, `+`, `-` or `@` is
 * then read as a *formula*, and Excel's formula language reaches outside the spreadsheet: the
 * classic payload is `+cmd|'/c calc'!A0`, which asks Excel to start a program over DDE. So a value
 * this app never chose — a string that arrived from someone's API through a live data source, or a
 * field in a file a colleague sent — can be written into an export and run on the machine of
 * whoever opens it next. The person who gets hurt is not the person who typed it.
 *
 * Measured before it was fixed, not assumed. Exporting a sheet holding those payloads produced:
 *
 *     +cmd|'/c calc'!A0
 *     @SUM(1+1)*cmd|'/c calc'!A0
 *
 * verbatim, both live. (`=1+1` did *not* survive: this app's own engine evaluates a cell starting
 * with `=` and exports the result. The dangerous ones are exactly the three prefixes the engine
 * does not treat as a formula, which is why "we compute formulas ourselves" was no protection.)
 *
 * The fix is the standard one — a leading apostrophe, which every spreadsheet reads as "the rest
 * is text" — with the detail that makes it usable: **a number is never touched**. Prefixing every
 * field that starts with `-` would mangle every negative number in every export, which is how this
 * mitigation usually gets reverted a week after it ships.
 */
const RISKY_FIRST_CHAR = /^[=+\-@\t\r\n]/;
/** Plain numbers, including the negative ones `RISKY_FIRST_CHAR` would otherwise catch. */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

export function neutraliseCsvField(value: string): string {
  if (value === "" || PLAIN_NUMBER.test(value)) return value;
  return RISKY_FIRST_CHAR.test(value) ? `'${value}` : value;
}

/** Undoes exactly what `neutraliseCsvField` adds, so this app's own round trip is lossless. */
export function unneutraliseCsvField(value: string): string {
  return value.startsWith("'") && RISKY_FIRST_CHAR.test(value.slice(1)) ? value.slice(1) : value;
}

/** Quotes a field only when leaving it bare would change what it means. */
export function quoteCsvField(value: string, delimiter: CsvDelimiter): string {
  const needsQuotes =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r") ||
    // Leading or trailing spaces survive only inside quotes; readers are free to trim otherwise.
    value !== value.trim();
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

export interface CsvWriteOptions {
  delimiter?: CsvDelimiter;
  /** Excel on Windows needs the BOM to read UTF-8; anything reading it as data does not care. */
  bom?: boolean;
}

/**
 * Serialises rows to CSV text.
 *
 * CRLF line endings and a BOM by default, which is what Excel wants. Both are options because the
 * other consumer of a CSV is a script, and a script wants neither.
 */
export function toCsv(rows: string[][], { delimiter = ",", bom = true }: CsvWriteOptions = {}): string {
  // Neutralising happens here rather than at each call site, and cannot be switched off: an export
  // path added later would otherwise be unprotected by default, which is the wrong default for
  // something that runs on someone else's computer.
  const body = rows
    .map((row) => row.map((f) => quoteCsvField(neutraliseCsvField(f), delimiter)).join(delimiter))
    .join("\r\n");
  return (bom ? "﻿" : "") + body;
}

/**
 * Drops the empty rows and columns at the bottom and right of a grid.
 *
 * A sheet is 100×26 from the moment it opens, so exporting it verbatim gives a file that is mostly
 * commas — technically correct and useless to whatever opens it next.
 */
export function trimGrid(rows: string[][]): string[][] {
  let lastRow = -1;
  let lastCol = -1;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] !== "") {
        lastRow = Math.max(lastRow, r);
        lastCol = Math.max(lastCol, c);
      }
    }
  }
  if (lastRow < 0) return [];
  return rows.slice(0, lastRow + 1).map((r) => {
    const cut = r.slice(0, lastCol + 1);
    return cut.length === lastCol + 1 ? cut : [...cut, ...Array(lastCol + 1 - cut.length).fill("")];
  });
}

/**
 * Turns computed cell values into the strings a CSV should carry.
 *
 * Computed values, not the formulas behind them: CSV has no formulas, and writing `=C2*D2` into one
 * gives the next reader a text field that means nothing — or, opened in a spreadsheet, a formula
 * pointing at cells that aren't there.
 *
 * Raw numbers, not the formatted display either. The grid shows ฿1,234.00 and that is right on
 * screen; in a CSV the thousands separator is a second delimiter and the currency symbol makes the
 * column unparseable. Whatever reads this next wants 1234.
 */
export function valuesToCsvGrid(values: FormulaValue[][]): string[][] {
  return values.map((row) =>
    row.map((v) => {
      if (v === null) return "";
      if (isError(v)) return v.code;
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      return String(v);
    })
  );
}
