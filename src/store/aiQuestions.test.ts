// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { aiContextOf, computeTab, useSheetStore } from "./sheetStore";
import { useLocaleStore } from "./localeStore";
import { heuristicSuggest } from "@/lib/aiHeuristic";
import { cellRef, parseCellRef } from "@/lib/formulaEngine/address";
import { MESSAGES } from "@/i18n/messages";
import type { Locale } from "@/i18n/types";

/**
 * The questions testers really asked the assistant without a key (QA round 2 and the blind test,
 * #62–#64), kept as a permanent suite. Each one runs the whole way a person's does: the sample
 * sheet in that language, the cursor where they had it, the context the panel sends, the keyword
 * matcher, where Insert puts the answer, and the number that then shows in the cell.
 *
 * The bar is the README's: a question it cannot answer is a better outcome than an answer it
 * cannot justify. So a row here either lands the right value or declines — pointing at the form
 * that fits — and never lands a wrong one.
 */
const state = () => useSheetStore.getState();
const active = () => state().sheets.find((t) => t.id === state().activeSheetId)!;

function ask(locale: Locale, at: string, question: string) {
  useLocaleStore.setState({ locale });
  state().openSample();
  const { row, col } = parseCellRef(at)!;
  state().setSelection({ startRow: row, startCol: col, endRow: row, endCol: col, anchorRow: row, anchorCol: col });
  const s = state();
  const ctx = aiContextOf(active().sheet, s.sheets, s.selectionBySheetId[s.activeSheetId]);
  const out = heuristicSuggest(
    question,
    { range: ctx.range, rangeIsText: ctx.rangeIsText, row: ctx.row, columns: ctx.columns, mentions: ctx.mentionsIn(question) },
    locale
  );
  if (!out.formula) return { ...out, at: null, value: undefined };
  const placed = state().insertAIFormula(out.formula);
  const values = computeTab(active().sheet, state().sheets).values;
  return { ...out, at: placed && cellRef(placed.row, placed.col), value: placed ? values[placed.row][placed.col] : undefined };
}

beforeEach(() => {
  state().startBlank();
});

describe("the right function (#62)", () => {
  it("'จำนวนเงินรวมทั้งหมด' is a total of money, not a count", () => {
    expect(ask("th", "E11", "จำนวนเงินรวมทั้งหมด")).toMatchObject({ formula: "=SUM(E2:E10)", value: 7495 });
  });

  it("'ยอดรวมจำนวนสินค้าที่ขายได้' adds up the quantities", () => {
    expect(ask("th", "D11", "ยอดรวมจำนวนสินค้าที่ขายได้")).toMatchObject({ formula: "=SUM(D2:D10)", value: 137 });
  });

  it("'count' inside 'account' is not a count", () => {
    expect(ask("en", "E11", "Account for every sale: total revenue")).toMatchObject({ formula: "=SUM(E2:E10)", value: 7495 });
  });

  it("'if' inside 'difference' is not an IF, and days between dates go to DATEDIF's form", () => {
    expect(ask("en", "G2", "Difference in days between two dates")).toMatchObject({ formula: null, form: "DATEDIF" });
  });

  it("'min' inside 'minus' is not MIN, and a subtraction it cannot see is declined", () => {
    expect(ask("en", "F2", "Subtract price minus quantity")).toMatchObject({ formula: null });
  });

  it("the English lookup chip and the Thai one both go to the VLOOKUP form", () => {
    expect(ask("en", "G2", "Look up a product's price from its code")).toMatchObject({ formula: null, form: "VLOOKUP" });
    expect(ask("th", "G2", "ค้นหาราคาสินค้าจากรหัสสินค้า")).toMatchObject({ formula: null, form: "VLOOKUP" });
  });
});

describe("conditions are not dropped, and rows are the cursor's (#63)", () => {
  for (const [locale, question, form] of [
    ["en", "What is the sum of quantity for Bakery", "SUMIF"],
    ["en", "Average of totals for drinks", "AVERAGEIF"],
    ["th", "ยอดรวมของหมวดเครื่องดื่ม", "SUMIF"],
    ["th", "นับจำนวนสินค้าที่ขายได้มากกว่า 15 ชิ้น", "COUNTIF"],
    ["en", "total sales for the northern branch", "SUMIF"],
    ["th", "รวมยอดขายเฉพาะสาขาเหนือ", "SUMIF"],
    ["en", "Count the drinks", "COUNTIF"],
  ] as const) {
    it(`'${question}' points at ${form} instead of the whole column`, () => {
      expect(ask(locale, "E11", question)).toMatchObject({ formula: null, form });
    });
  }

  it("joins the product and category of the cursor's row, not of the header row", () => {
    expect(ask("en", "F2", "Join the product name and category")).toMatchObject({
      formula: '=CONCATENATE(A2," ",B2)',
      value: "Caffè latte Drinks",
    });
  });

  it("upper-cases the cursor's row", () => {
    expect(ask("en", "F2", "Convert product names to uppercase")).toMatchObject({ formula: "=UPPER(A2)", value: "CAFFÈ LATTE" });
  });

  it("builds an IF from the column, comparison and words the question gives", () => {
    expect(ask("en", "F2", "If the price is above 50 show Yes otherwise No")).toMatchObject({
      formula: '=IF(C2>50,"Yes","No")',
      value: "Yes",
    });
  });

  it("the IF chips point at the form on a sheet with no score column", () => {
    expect(ask("en", "F2", 'Show "Pass" if the score is above 50')).toMatchObject({ formula: null, form: "IF" });
    expect(ask("th", "F2", "ถ้าคะแนนมากกว่า 50 ให้ขึ้นว่า ผ่าน")).toMatchObject({ formula: null, form: "IF" });
  });

  it("the Thai croissant lookup goes to the VLOOKUP form rather than into its own range", () => {
    expect(ask("th", "G2", "ค้นหาราคาของครัวซองต์")).toMatchObject({ formula: null, form: "VLOOKUP" });
  });

  it("counts products with COUNTA and without the header: 9, not 0 or 10", () => {
    expect(ask("en", "G2", "count the number of products")).toMatchObject({ formula: "=COUNTA(A2:A10)", value: 9 });
  });
});

describe("an answer never goes into a cell it reads (#64)", () => {
  it("'total this column' from inside the column goes under it, and E5 keeps its own formula", () => {
    expect(ask("en", "E5", "Total all sales in this column")).toMatchObject({ formula: "=SUM(E2:E10)", at: "E11", value: 7495 });
    expect(active().sheet.cells[4][4]).toBe("=C5*D5");
    expect(ask("th", "E5", "อยากรวมยอดขายทั้งหมดในคอลัมน์นี้")).toMatchObject({ at: "E11", value: 7495 });
  });

  it("an empty column gets no range, so no =SUM(F2) in F2: it asks which cells", () => {
    expect(ask("en", "F2", "Total all sales in this column")).toMatchObject({ formula: null, form: "SUM" });
    expect(ask("en", "I2", "sum")).toMatchObject({ formula: null, form: "SUM" });
    expect(ask("en", "C13", "sum")).toMatchObject({ formula: null, form: "SUM" });
  });

  it("under the grand total, 'average price' is the price column's, not the total's", () => {
    const out = ask("en", "E13", "Average price");
    expect(out).toMatchObject({ formula: "=AVERAGE(C2:C10)", at: "E13" });
    expect(out.value).toBeCloseTo(530 / 9, 6);
    expect(ask("en", "E13", "average")).toMatchObject({ formula: null });
  });

  it("refuses an answer that reads the only cell it could go into, and says so", () => {
    useLocaleStore.setState({ locale: "en" });
    state().openSample();
    state().setSelection({ startRow: 1, startCol: 5, endRow: 1, endCol: 5, anchorRow: 1, anchorCol: 5 });
    const before = active().sheet.cells;
    expect(state().insertAIFormula("=VLOOKUP(A2,F2:G21,2,FALSE)")).toBeNull();
    expect(active().sheet.cells).toBe(before);
    expect(state().announcement?.text).toMatch(/F2/);
  });
});

describe("help that points the right way (N5)", () => {
  it("says which button, not a side of the screen that is wrong on half the layouts", () => {
    for (const locale of ["th", "en"] as const) {
      expect(MESSAGES[locale].aiHeuristic.noMatch).not.toMatch(/ด้านซ้าย|ช่องด้านบน|on the left|box above/);
    }
  });
});
