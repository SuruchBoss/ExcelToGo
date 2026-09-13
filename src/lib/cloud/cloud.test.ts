import { describe, expect, it } from "vitest";
import { isCloudConfigured } from "./config";
import { readWorkbook, toSummary, WORKBOOK_FORMAT, workbookPayload, wouldOverwriteNewer } from "./workbook";
import { createEmptySheet } from "@/lib/sheet";
import { SheetTab } from "@/store/sheetStore";

const tab = (name: string): SheetTab => ({ id: `id-${name}`, name, sheet: createEmptySheet(3, 3) });

describe("whether a deployment has a cloud at all", () => {
  it("is off when neither variable is set, which is the default", () => {
    expect(isCloudConfigured("", "")).toBe(false);
  });

  it("is on only when both halves are present", () => {
    expect(isCloudConfigured("https://x.supabase.co", "anon-key")).toBe(true);
  });

  it("stays off for a half-finished deployment rather than showing a sign-in that cannot work", () => {
    expect(isCloudConfigured("https://x.supabase.co", "")).toBe(false);
    expect(isCloudConfigured("", "anon-key")).toBe(false);
  });

  it("treats whitespace as unset, which is what an empty line in an env file produces", () => {
    expect(isCloudConfigured("  ", "  ")).toBe(false);
  });
});

describe("what gets stored", () => {
  it("carries a format number alongside the sheets", () => {
    const payload = workbookPayload([tab("Sheet1")]);
    expect(payload.format).toBe(WORKBOOK_FORMAT);
    expect(payload.sheets).toHaveLength(1);
  });

  it("survives the trip through JSON, which is what the column actually holds", () => {
    const sheet = createEmptySheet(3, 3);
    sheet.cells[0][0] = "กาแฟ";
    sheet.comments = { "0,0": "รอยืนยัน" };
    sheet.charts = [{ id: "c1", kind: "bar", range: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 } }];
    const round = JSON.parse(JSON.stringify(workbookPayload([{ id: "t", name: "งาน", sheet }])));
    const back = readWorkbook(round)!;
    expect(back[0].sheet.cells[0][0]).toBe("กาแฟ");
    expect(back[0].sheet.comments?.["0,0"]).toBe("รอยืนยัน");
    expect(back[0].sheet.charts?.[0].kind).toBe("bar");
  });
});

describe("reading a stored workbook back", () => {
  it("returns the tabs it was given", () => {
    expect(readWorkbook(workbookPayload([tab("A"), tab("B")]))!.map((s) => s.name)).toEqual(["A", "B"]);
  });

  it("refuses one written by a newer version rather than half-reading it", () => {
    // Opening it would silently drop whatever the newer format added, and the user would find out
    // by noticing their work missing.
    expect(readWorkbook({ format: WORKBOOK_FORMAT + 1, sheets: [tab("A")] })).toBeNull();
  });

  it("refuses anything that isn't a workbook", () => {
    for (const junk of [null, undefined, 42, "sheets", {}, { format: 1 }, { format: 1, sheets: [] }]) {
      expect(readWorkbook(junk)).toBeNull();
    }
  });
});

describe("noticing another device got there first", () => {
  const earlier = "2026-01-01T10:00:00.000Z";
  const later = "2026-01-01T11:00:00.000Z";

  it("warns when the row moved on after it was read", () => {
    expect(wouldOverwriteNewer(earlier, later)).toBe(true);
  });

  it("stays quiet when nothing changed since", () => {
    expect(wouldOverwriteNewer(later, later)).toBe(false);
    expect(wouldOverwriteNewer(later, earlier)).toBe(false);
  });

  it("stays quiet for a workbook that has never been saved", () => {
    expect(wouldOverwriteNewer(null, later)).toBe(false);
  });

  it("stays quiet when the row is gone, since there is nothing to overwrite", () => {
    expect(wouldOverwriteNewer(earlier, null)).toBe(false);
  });

  it("stays quiet rather than crying wolf on a timestamp it cannot parse", () => {
    expect(wouldOverwriteNewer("not a date", later)).toBe(false);
    expect(wouldOverwriteNewer(earlier, "not a date")).toBe(false);
  });
});

describe("the listing shape", () => {
  it("renames the column to what the UI reads", () => {
    expect(toSummary({ id: "a", name: "งาน", updated_at: "2026-01-01T00:00:00.000Z" })).toEqual({
      id: "a",
      name: "งาน",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
