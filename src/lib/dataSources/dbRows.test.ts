import { describe, expect, it } from "vitest";
import { tableFromDbRows, toCellValue } from "./dbRows";

describe("one value, as a cell", () => {
  it("keeps numbers, booleans and text as they are", () => {
    expect(toCellValue(42)).toBe(42);
    expect(toCellValue(false)).toBe(false);
    expect(toCellValue("กาแฟ")).toBe("กาแฟ");
    expect(toCellValue(null)).toBeNull();
    expect(toCellValue(undefined)).toBeNull();
  });

  it("leaves a big integer as text rather than rounding it into a number", () => {
    // Both drivers hand these back as strings on purpose, because they do not fit a double.
    // Turning them back into numbers here would undo that and lose the last digits silently.
    expect(toCellValue(BigInt("9007199254740993"))).toBe("9007199254740993");
    expect(toCellValue("12345678901234567890")).toBe("12345678901234567890");
  });

  it("writes a date as ISO, so sorting in the sheet is still chronological", () => {
    expect(toCellValue(new Date("2026-03-04T05:06:07.000Z"))).toBe("2026-03-04T05:06:07.000Z");
    expect(toCellValue(new Date("nonsense"))).toBeNull();
  });

  it("does not put a megabyte of base64 in a cell", () => {
    expect(toCellValue(new Uint8Array(2048))).toBe("⟨2048 bytes⟩");
  });

  it("writes JSON and arrays compactly rather than as [object Object]", () => {
    expect(toCellValue({ a: 1 })).toBe('{"a":1}');
    expect(toCellValue([1, "ก"])).toBe('[1,"ก"]');
  });

  it("does not put NaN or Infinity in a numeric cell", () => {
    expect(toCellValue(NaN)).toBe("NaN");
    expect(toCellValue(Infinity)).toBe("Infinity");
  });
});

describe("rows and their column names", () => {
  it("takes the names from the query, not from the first row", () => {
    // A column that is null in every row still has to be a column, and this is the case where
    // inferring from an object would drop it.
    const t = tableFromDbRows(["id", "note"], [[1, null], [2, null]]);
    expect(t.columns.map((c) => c.key)).toEqual(["id", "note"]);
    expect(t.rows).toEqual([[1, null], [2, null]]);
  });

  it("keeps both of two columns with the same name, suffixed", () => {
    const t = tableFromDbRows(["id", "id"], [[1, 2]]);
    expect(t.columns.map((c) => c.key)).toEqual(["id", "id (2)"]);
    expect(t.rows[0]).toEqual([1, 2]);
  });

  it("marks a column numeric only when something in it is a number", () => {
    const t = tableFromDbRows(["n", "s", "empty"], [[1, "a", null], [2, "b", null]]);
    expect(t.columns.map((c) => c.numeric)).toEqual([true, false, false]);
  });

  it("names an unnamed expression rather than leaving a blank heading", () => {
    expect(tableFromDbRows([""], [[1]]).columns[0].key).toBe("?column?");
  });

  it("carries the truncated flag, so a partial table is never a silent one", () => {
    expect(tableFromDbRows(["a"], [[1]], "now", { truncated: true }).truncated).toBe(true);
  });
});
