import { describe, expect, it } from "vitest";
import { hiddenRowsFor, visibleRowCount } from "./sheetFilter";

const SHEET = [
  ["สินค้า", "หมวดหมู่"],
  ["กาแฟ", "เครื่องดื่ม"],
  ["ชา", "เครื่องดื่ม"],
  ["ครัวซองต์", "เบเกอรี่"],
];

describe("which rows a filter hides", () => {
  it("hides nothing when no column is filtered", () => {
    expect(hiddenRowsFor(SHEET, {}).size).toBe(0);
    expect(visibleRowCount(SHEET, {})).toBe(4);
  });

  it("keeps only the rows whose value is in the list", () => {
    expect([...hiddenRowsFor(SHEET, { 1: ["เครื่องดื่ม"] })]).toEqual([0, 3]);
    expect(visibleRowCount(SHEET, { 1: ["เครื่องดื่ม"] })).toBe(2);
  });

  it("requires every filtered column to match, not just one", () => {
    const filters = { 1: ["เครื่องดื่ม"], 0: ["ชา"] };
    expect(visibleRowCount(SHEET, filters)).toBe(1);
  });

  it("treats a missing cell as the empty string rather than as a match", () => {
    const ragged = [["a"], ["a", "keep"]];
    expect([...hiddenRowsFor(ragged, { 1: ["keep"] })]).toEqual([0]);
  });

  it("hides everything when the kept list is empty", () => {
    expect(visibleRowCount(SHEET, { 0: [] })).toBe(0);
  });
});
