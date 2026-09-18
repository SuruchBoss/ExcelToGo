import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PERSIST_KEY, rescueSheets, safeFilename } from "./crashRescue";

/** The shape zustand's persist actually writes, so the tests exercise the real thing. */
function persisted(sheets: unknown[]): string {
  return JSON.stringify({ state: { sheets, activeSheetId: "a" }, version: 0 });
}

function tab(name: string, cells: string[][]) {
  return { id: name, name, sheet: { rows: cells.length, cols: cells[0]?.length ?? 0, cells } };
}

describe("rescuing a sheet out of storage", () => {
  it("turns each tab into its own CSV", () => {
    const out = rescueSheets(persisted([tab("ยอดขาย", [["สินค้า", "ราคา"], ["กาแฟ", "45"]])]));

    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("ยอดขาย");
    expect(out[0].csv).toContain("สินค้า,ราคา");
    expect(out[0].csv).toContain("กาแฟ,45");
  });

  it("writes the BOM, because the rescue file is opened in Excel and it is Thai", () => {
    const [only] = rescueSheets(persisted([tab("ก", [["ชื่อ"]])]));
    expect(only.csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("hands back the formula the person typed, not a value it made up", () => {
    // Nothing in this path evaluates anything — the engine is one of the things that might have
    // just thrown. `=SUM(A1:A2)` is both the honest answer and the more useful one.
    const [only] = rescueSheets(persisted([tab("s", [["10"], ["20"], ["=SUM(A1:A2)"]])]));
    expect(only.csv).toContain("=SUM(A1:A2)");
  });

  it("quotes a field holding the delimiter rather than splitting the row", () => {
    const [only] = rescueSheets(persisted([tab("s", [["กรุงเทพ, ประเทศไทย", "x"]])]));
    expect(only.csv).toContain('"กรุงเทพ, ประเทศไทย",x');
  });
});

describe("what it does with input that is not what it expected", () => {
  // Each of these is a real state storage can be in: a first visit, a half-written value, a key
  // left over from a future version. The boundary has one branch — "is there anything to offer" —
  // so every one of them has to come back as an empty list rather than as a throw.
  it.each([
    ["nothing stored at all", null],
    ["an empty string", ""],
    ["JSON that does not parse", "{oh no"],
    ["valid JSON that is not an object", "42"],
    ["an object with no sheets", JSON.stringify({ state: {} })],
    ["sheets that is not an array", JSON.stringify({ state: { sheets: { a: 1 } } })],
  ])("returns nothing for %s", (_label, raw) => {
    expect(rescueSheets(raw as string | null)).toEqual([]);
  });

  it("skips a tab whose cells are missing and still rescues its neighbour", () => {
    const out = rescueSheets(persisted([{ name: "พัง" }, tab("ดี", [["ยังอยู่"]])]));
    expect(out.map((s) => s.name)).toEqual(["ดี"]);
  });

  it("skips a tab that is entirely empty — an empty CSV is not worth a download", () => {
    expect(rescueSheets(persisted([tab("ว่าง", [["", ""], ["", ""]])]))).toEqual([]);
  });

  it("coerces a cell that is not a string, rather than writing [object Object]", () => {
    const out = rescueSheets(persisted([tab("s", [[1 as unknown as string, null as unknown as string, "ok"]])]));
    expect(out[0].csv).toContain("1,,ok");
  });

  it("reads a bare state object too, the way a hand-edited backup would look", () => {
    const out = rescueSheets(JSON.stringify({ sheets: [tab("s", [["ok"]])] }));
    expect(out).toHaveLength(1);
  });
});

describe("filenames", () => {
  it("strips the characters Windows refuses", () => {
    expect(safeFilename('a/b\\c:d*e?f"g<h>i|j', "x")).toBe("a b c d e f g h i j.csv");
  });

  it("falls back when the name is nothing but forbidden characters", () => {
    expect(safeFilename("///", "Sheet1")).toBe("Sheet1.csv");
  });

  it("drops a trailing dot, which Windows also refuses", () => {
    expect(safeFilename("รายงาน.", "x")).toBe("รายงาน.csv");
  });

  it("gives two tabs of the same name two different files", () => {
    const out = rescueSheets(persisted([tab("ชีต", [["a"]]), tab("ชีต", [["b"]])]));
    expect(out.map((s) => s.filename)).toEqual(["ชีต.csv", "ชีต (2).csv"]);
  });
});

describe("the storage key", () => {
  it("is the same key the store persists under", () => {
    // This module deliberately does not import the store — pulling it in would drag the model and
    // the engine into the one path that has to survive them failing. That leaves the key copied,
    // and a copied constant drifts silently: the rescue would read a key nothing writes and report
    // "nothing to rescue" on a sheet that is sitting right there. So the copy is checked against
    // the source instead of trusted.
    const source = readFileSync(new URL("../store/sheetStore.ts", import.meta.url), "utf8");
    const declared = /name:\s*"(exceltogo-sheet[^"]*)"/.exec(source)?.[1];

    expect(declared, "no persist name found in sheetStore.ts — did the store change shape?").toBeDefined();
    expect(PERSIST_KEY).toBe(declared);
  });
});
