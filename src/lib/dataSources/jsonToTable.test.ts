import { describe, expect, it } from "vitest";
import { csvToTable, getByPath, jsonToTable, parseCsv } from "./jsonToTable";

describe("jsonToTable", () => {
  it("turns an array of objects into rows with a union of columns", () => {
    const t = jsonToTable([
      { name: "กาแฟ", price: 45 },
      { name: "นม", price: 25, qty: 3 },
    ]);
    expect(t.columns.map((c) => c.key)).toEqual(["name", "price", "qty"]);
    expect(t.rows).toEqual([
      ["กาแฟ", 45, null],
      ["นม", 25, 3],
    ]);
  });

  it("digs the largest array of records out of a wrapped payload", () => {
    const t = jsonToTable({ ok: true, meta: { page: 1 }, data: { items: [{ id: 1 }, { id: 2 }] } });
    expect(t.columns.map((c) => c.key)).toEqual(["id"]);
    expect(t.rows).toEqual([[1], [2]]);
  });

  it("flattens nested objects into dotted keys with readable labels", () => {
    const t = jsonToTable([{ customer: { name: "A", address: { city: "BKK" } }, total: 10 }]);
    expect(t.columns.map((c) => c.key)).toEqual(["customer.name", "customer.address.city", "total"]);
    expect(t.columns[1].label).toBe("customer › address › city");
  });

  it("treats a single object as a one-row table", () => {
    const t = jsonToTable({ today_total: 1234, orders: 7 });
    expect(t.rows).toEqual([[1234, 7]]);
  });

  it("marks a column numeric only when every value is a number or blank", () => {
    const t = jsonToTable([{ a: 1, b: "x" }, { a: null, b: 2 }]);
    expect(t.columns.map((c) => c.numeric)).toEqual([true, false]);
  });

  it("joins arrays of primitives and summarizes arrays of objects", () => {
    const t = jsonToTable([{ tags: ["a", "b"], lines: [{ x: 1 }, { x: 2 }] }]);
    expect(t.rows[0]).toEqual(["a, b", "2 items"]);
  });

  it("handles an array of primitives as a value column", () => {
    expect(jsonToTable([1, 2, 3]).rows).toEqual([[1], [2], [3]]);
  });
});

describe("getByPath", () => {
  it("walks dotted paths including array indices", () => {
    expect(getByPath({ data: { rows: [{ v: 1 }, { v: 2 }] } }, "data.rows.1.v")).toBe(2);
    expect(getByPath({ a: 1 }, "")).toEqual({ a: 1 });
    expect(getByPath({ a: 1 }, "missing.path")).toBeUndefined();
  });
});

describe("CSV", () => {
  it("parses quoted fields, escaped quotes, and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });

  it("uses the first line as the header and coerces numbers", () => {
    const t = csvToTable("name,price\nกาแฟ,45\nนม,25");
    expect(t.columns.map((c) => c.label)).toEqual(["name", "price"]);
    expect(t.rows).toEqual([
      ["กาแฟ", 45],
      ["นม", 25],
    ]);
    expect(t.columns[1].numeric).toBe(true);
  });
});
