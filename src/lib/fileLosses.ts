// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * What an opened `.xlsx` holds that the app does not keep (#83).
 *
 * The promise the app is used for is "open it, fix it, send it back, and the file is not broken".
 * Where that cannot be kept the person has to hear it before they edit, not from their manager
 * after the file has gone back with its pictures missing. So after a file opens, the package is
 * read again for the parts the importer drops, and anything found is counted and placed.
 *
 * Read from the package itself (the zip), not inferred from what the importer returned: the
 * importer's output is exactly the thing that no longer has them. Each kind here was checked
 * against a real file (see `fileLosses.test.ts`), not only against the spec.
 *
 * **Not a complete list, and it must not say it is.** Hidden or protected sheets, validation and
 * conditional-format kinds the app does not support, threaded comments — those are known gaps that
 * are not detected yet. The notice says "things we know are not kept", never "everything".
 */
import JSZip from "jszip";
import { tokenize } from "./formulaEngine/tokenizer";
import { FUNCTIONS } from "./formulaEngine/functions";
import type { SheetModel } from "./sheet";

export type LossKind =
  | "pictures"
  | "shapes"
  | "charts"
  | "pivots"
  | "macros"
  | "externalLinks"
  | "unknownFunctions"
  | "names"
  | "errorValues";

export interface FileLoss {
  kind: LossKind;
  count: number;
  /** The sheets it is on, in the file's order; empty when it belongs to the workbook (macros, links). */
  sheets: string[];
  /** For `unknownFunctions` the function names, for `names` the range names, so the notice can say which. */
  names?: string[];
}

/**
 * The order the notice lists them in: what a person sees in the file first, then what runs. Range
 * names sit next to unknown functions because both end in `#NAME?` on screen; a person who
 * reads one line about `#NAME?` should find the other cause right under it. Error values follow,
 * the last thing that changes what a formula reads.
 */
const ORDER: LossKind[] = ["pictures", "charts", "shapes", "pivots", "unknownFunctions", "names", "errorValues", "externalLinks", "macros"];

interface Rel {
  type: string;
  target: string;
}

/** `Id → {type, target}` from a `.rels` part, targets resolved against the part's own folder. */
async function relsOf(zip: JSZip, partPath: string): Promise<Map<string, Rel>> {
  const slash = partPath.lastIndexOf("/");
  const dir = partPath.slice(0, slash);
  const name = partPath.slice(slash + 1);
  const xml = await zip.file(`${dir}/_rels/${name}.rels`)?.async("string");
  const out = new Map<string, Rel>();
  if (!xml) return out;
  for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const tag = m[0];
    const id = /\bId="([^"]*)"/.exec(tag)?.[1];
    const type = /\bType="([^"]*)"/.exec(tag)?.[1] ?? "";
    const target = /\bTarget="([^"]*)"/.exec(tag)?.[1];
    const external = /\bTargetMode="External"/.test(tag);
    if (!id || !target) continue;
    out.set(id, { type, target: external ? target : resolve(dir, target) });
  }
  return out;
}

/** A relationship target against the folder of the part that names it (`../drawings/x.xml`). */
function resolve(dir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = dir.split("/").filter(Boolean);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

const endsWith = (type: string, kind: string) => type.endsWith(`/${kind}`);

/**
 * Cells holding a constant error, `<c t="e"><v>#DIV/0!</v></c>` (#227). The app keeps the code as
 * text until #226, so a formula that reads one does not see an error; that is what the notice owes.
 * A cell with a formula is not one of them: its error is a result, and the app calculates it again.
 */
export function countConstantErrors(sheetXml: string): number {
  if (!sheetXml.includes('t="e"')) return 0;
  let n = 0;
  for (const m of sheetXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c>)/g)) {
    if (!/\bt="e"/.test(m[1])) continue;
    const inner = m[2] ?? "";
    if (/<(?:[A-Za-z_][\w.-]*:)?f[\s>/]/.test(inner)) continue;
    if (/<(?:[A-Za-z_][\w.-]*:)?v[\s>]/.test(inner)) n += 1;
  }
  return n;
}

/** Count of elements with this local name, whatever prefix the writer chose (`xdr:pic`, `pic`). */
function countElements(xml: string, local: string): number {
  return (xml.match(new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${local}[\\s>/]`, "g")) ?? []).length;
}

class Tally {
  private byKind = new Map<LossKind, { count: number; sheets: string[] }>();
  add(kind: LossKind, count: number, sheet?: string) {
    if (count <= 0) return;
    const entry = this.byKind.get(kind) ?? { count: 0, sheets: [] };
    entry.count += count;
    if (sheet && !entry.sheets.includes(sheet)) entry.sheets.push(sheet);
    this.byKind.set(kind, entry);
  }
  get(kind: LossKind) {
    return this.byKind.get(kind);
  }
}

/**
 * Functions a formula calls that the engine does not have, as Excel writes them.
 *
 * Excel stores newer functions with a prefix (`_xlfn.XLOOKUP`); the prefix is dropped before the
 * lookup so the name shown is the one a person typed, and a function the engine does have is not
 * reported just because the file spelled it the long way.
 */
export function unknownFunctionsIn(formulaBody: string): string[] {
  let tokens;
  try {
    tokens = tokenize(formulaBody);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const t of tokens) {
    if (t.type !== "FUNC") continue;
    const name = t.value.replace(/^_XLFN\.(_XLWS\.)?/, "").replace(/^_XLWS\./, "");
    if (!(name in FUNCTIONS) && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Everything in an `.xlsx` package the app is known not to keep, counted and placed.
 *
 * `sheets` are the sheets as the importer produced them — the formulas are read from there, since
 * those are the formulas the app will actually run (and show `#NAME?` for). The first one carries
 * the file's range names the importer could not bring in (#60), which are reported here rather than
 * in an alert of their own: one open, one message about what the file lost.
 */
export async function findFileLosses(
  data: ArrayBuffer | Uint8Array,
  sheets: { name: string; sheet: SheetModel; droppedNames?: string[] }[]
): Promise<FileLoss[]> {
  const droppedNames = sheets[0]?.droppedNames ?? [];
  const namesLoss: FileLoss[] = droppedNames.length > 0 ? [{ kind: "names", count: droppedNames.length, sheets: [], names: droppedNames }] : [];
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    // The importer read the package, so this should not happen; the names it dropped are still owed.
    return namesLoss;
  }
  const tally = new Tally();
  tally.add("names", droppedNames.length);

  // Sheet names by part: workbook.xml names them by relationship id.
  const workbook = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const workbookRels = await relsOf(zip, "xl/workbook.xml");
  const sheetParts: { name: string; path: string; chartsheet: boolean }[] = [];
  for (const m of workbook.matchAll(/<(?:[\w]+:)?sheet\b[^>]*>/g)) {
    const name = decodeXml(/\bname="([^"]*)"/.exec(m[0])?.[1] ?? "");
    const rid = /\br:id="([^"]*)"/.exec(m[0])?.[1] ?? /\bid="([^"]*)"/.exec(m[0])?.[1];
    const rel = rid ? workbookRels.get(rid) : undefined;
    if (!rel) continue;
    sheetParts.push({ name, path: rel.target, chartsheet: endsWith(rel.type, "chartsheet") });
  }

  for (const part of sheetParts) {
    // A chart sheet is a whole tab that is nothing but an Excel chart.
    if (part.chartsheet) {
      tally.add("charts", 1, part.name);
      continue;
    }
    const sheetXml = (await zip.file(part.path)?.async("string")) ?? "";
    tally.add("errorValues", countConstantErrors(sheetXml), part.name);
    const rels = await relsOf(zip, part.path);
    for (const rel of rels.values()) {
      if (endsWith(rel.type, "pivotTable")) tally.add("pivots", 1, part.name);
      if (endsWith(rel.type, "drawing")) {
        const drawing = (await zip.file(rel.target)?.async("string")) ?? "";
        tally.add("pictures", countElements(drawing, "pic"), part.name);
        tally.add("shapes", countElements(drawing, "sp") + countElements(drawing, "cxnSp"), part.name);
        const drawingRels = await relsOf(zip, rel.target);
        const charts = [...drawingRels.values()].filter((r) => endsWith(r.type, "chart")).length;
        tally.add("charts", charts, part.name);
      }
    }
  }

  if (zip.file("xl/vbaProject.bin")) tally.add("macros", 1);
  const links = Object.keys(zip.files).filter((p) => /^xl\/externalLinks\/externalLink\d+\.xml$/.test(p)).length;
  tally.add("externalLinks", links);

  const functionNames: string[] = [];
  for (const { name, sheet } of sheets) {
    let found = 0;
    for (const row of sheet.cells) {
      for (const raw of row ?? []) {
        if (!raw || raw[0] !== "=" || raw.length < 2) continue;
        const unknown = unknownFunctionsIn(raw.slice(1));
        if (unknown.length === 0) continue;
        found += 1;
        for (const fn of unknown) if (!functionNames.includes(fn)) functionNames.push(fn);
      }
    }
    tally.add("unknownFunctions", found, name);
  }

  const out: FileLoss[] = [];
  for (const kind of ORDER) {
    const entry = tally.get(kind);
    if (!entry) continue;
    const names = kind === "unknownFunctions" ? functionNames : kind === "names" ? droppedNames : undefined;
    out.push({ kind, count: entry.count, sheets: entry.sheets, ...(names ? { names } : {}) });
  }
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
