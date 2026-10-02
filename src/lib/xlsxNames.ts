// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import JSZip from "jszip";

/**
 * A file's defined names as the file writes them, scope included (#60).
 *
 * ExcelJS reads defined names into a per-cell matrix and writes them back from it, and on that trip
 * two things go: `localSheetId`, which is the whole difference between a workbook-level name and a
 * sheet-level one, and every name that is not a plain range. The first made a sheet-level name
 * arrive as a workbook one; the second made a formula name vanish without a word, leaving `#NAME?`
 * in every cell that used it. So names are read from `xl/workbook.xml` directly, and the sheet-level
 * ones are written back into it after ExcelJS has finished.
 */
export interface RawDefinedName {
  name: string;
  /** Index into the workbook's `<sheets>`, for a sheet-level name. */
  localSheetId?: number;
  /** What the name refers to, as the file wrote it: `Lists!$B$2:$B$4`, or a whole formula. */
  text: string;
  hidden: boolean;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

const encode = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function attr(attrs: string, key: string): string | undefined {
  const m = new RegExp(`\\b${key}="([^"]*)"`).exec(attrs);
  return m ? decode(m[1]) : undefined;
}

/** The sheets in the order `localSheetId` counts them, and every defined name in the file. */
export async function readRawDefinedNames(xlsx: ArrayBuffer): Promise<{ sheets: string[]; names: RawDefinedName[] }> {
  const zip = await JSZip.loadAsync(xlsx);
  const xml = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const sheets = [...xml.matchAll(/<(?:\w+:)?sheet\b([^>]*?)\/?>/g)].map((m) => attr(m[1], "name") ?? "");
  const names: RawDefinedName[] = [];
  for (const m of xml.matchAll(/<(?:\w+:)?definedName\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?definedName>/g)) {
    const name = attr(m[1], "name");
    if (!name) continue;
    const local = attr(m[1], "localSheetId");
    const entry: RawDefinedName = { name, text: decode(m[2]).trim(), hidden: attr(m[1], "hidden") === "1" };
    if (local !== undefined && /^\d+$/.test(local)) entry.localSheetId = Number(local);
    names.push(entry);
  }
  return { sheets, names };
}

/**
 * Adds sheet-level names to a finished workbook, which ExcelJS cannot write.
 *
 * Inside the existing `<definedNames>`, or a new one straight after `<sheets>` — the place the
 * schema puts it when there are no external references, which ExcelJS never writes.
 */
export async function addSheetLevelNames(
  xlsx: ArrayBuffer,
  names: { name: string; localSheetId: number; text: string }[]
): Promise<ArrayBuffer> {
  if (names.length === 0) return xlsx;
  const zip = await JSZip.loadAsync(xlsx);
  const path = "xl/workbook.xml";
  const xml = await zip.file(path)?.async("string");
  if (!xml) throw new Error("xl/workbook.xml missing");
  const elements = names
    .map((n) => `<definedName name="${encode(n.name)}" localSheetId="${n.localSheetId}">${encode(n.text)}</definedName>`)
    .join("");
  const next = xml.includes("</definedNames>")
    ? xml.replace("</definedNames>", `${elements}</definedNames>`)
    : xml.replace("</sheets>", `</sheets><definedNames>${elements}</definedNames>`);
  zip.file(path, next);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}
