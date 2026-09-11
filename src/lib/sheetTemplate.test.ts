import { describe, expect, it } from "vitest";
import {
  cellKey,
  excelWidthToPx,
  inputCount,
  isTemplateLocked,
  parseValidationList,
  pxToExcelWidth,
  templateChoices,
} from "./sheetTemplate";

const template = {
  inputs: { "2,1": true as const, "3,1": true as const },
  choices: { "3,1": ["ด่วน", "ปกติ"] },
};

describe("isTemplateLocked", () => {
  it("locks everything a template didn't open up", () => {
    expect(isTemplateLocked(template, 0, 0)).toBe(true);
    expect(isTemplateLocked(template, 2, 0)).toBe(true);
  });

  it("leaves the template's input cells open", () => {
    expect(isTemplateLocked(template, 2, 1)).toBe(false);
    expect(isTemplateLocked(template, 3, 1)).toBe(false);
  });

  it("locks nothing at all when there's no template", () => {
    expect(isTemplateLocked(undefined, 0, 0)).toBe(false);
    expect(isTemplateLocked(undefined, 99, 99)).toBe(false);
  });
});

describe("templateChoices / inputCount", () => {
  it("returns a cell's dropdown options, and nothing for cells without one", () => {
    expect(templateChoices(template, 3, 1)).toEqual(["ด่วน", "ปกติ"]);
    expect(templateChoices(template, 2, 1)).toBeUndefined();
    expect(templateChoices(undefined, 3, 1)).toBeUndefined();
  });

  it("counts the fields a person is meant to fill in", () => {
    expect(inputCount(template)).toBe(2);
    expect(inputCount(undefined)).toBe(0);
  });
});

describe("parseValidationList", () => {
  it("reads an inline quoted list", () => {
    expect(parseValidationList(['"ด่วน,ปกติ,ประหยัด"'])).toEqual(["ด่วน", "ปกติ", "ประหยัด"]);
  });

  it("trims the options and drops empty ones", () => {
    expect(parseValidationList(['" a , b ,, c "'])).toEqual(["a", "b", "c"]);
  });

  it("resolves a range reference through the reader it's given", () => {
    const read = (ref: string) => (ref === "$E$1:$E$3" ? ["x", "", "y"] : []);
    expect(parseValidationList(["$E$1:$E$3"], read)).toEqual(["x", "y"]);
  });

  it("gives up rather than inventing options when a range can't be read", () => {
    expect(parseValidationList(["$E$1:$E$3"])).toBeUndefined();
    expect(parseValidationList(["$E$1:$E$3"], () => [])).toBeUndefined();
  });

  it("ignores missing, empty, and non-string formulae", () => {
    expect(parseValidationList(undefined)).toBeUndefined();
    expect(parseValidationList([])).toBeUndefined();
    expect(parseValidationList(['""'])).toBeUndefined();
    expect(parseValidationList([42])).toBeUndefined();
  });
});

describe("column width conversion", () => {
  it("round-trips a width through pixels and back", () => {
    expect(pxToExcelWidth(excelWidthToPx(24))).toBeCloseTo(24, 1);
    expect(pxToExcelWidth(excelWidthToPx(8.43))).toBeCloseTo(8.43, 0);
  });

  it("clamps absurd widths instead of producing an unusable column", () => {
    expect(excelWidthToPx(1000)).toBe(400);
    expect(excelWidthToPx(0.1)).toBe(40);
  });

  it("passes through nothing for a column with no width set", () => {
    expect(excelWidthToPx(undefined)).toBeUndefined();
    expect(excelWidthToPx(0)).toBeUndefined();
    expect(pxToExcelWidth(undefined)).toBeUndefined();
  });
});

describe("cellKey", () => {
  it("is stable and distinguishes row from column", () => {
    expect(cellKey(2, 1)).toBe("2,1");
    expect(cellKey(1, 2)).not.toBe(cellKey(2, 1));
  });
});
