import { describe, expect, it } from "vitest";
import { createEmptySheet } from "./sheet";
import {
  checkValue,
  choicesAt,
  fromExcelValidation,
  parseList,
  ruleAt,
  shiftValidation,
  toExcelValidation,
  ValidationRule,
  withValidation,
} from "./dataValidation";

const range = (startRow: number, startCol: number, endRow: number, endCol: number) => ({ startRow, startCol, endRow, endCol });
const sheet = () => createEmptySheet(20, 8);

describe("what a rule lets through", () => {
  it("accepts one of the listed values and refuses anything else", () => {
    // The reason this feature exists: "เหนือ", "ภาคเหนือ", "north" and " เหนือ" in one column, and
    // a SUMIF quietly counting one of them.
    const rule: ValidationRule = { kind: "list", values: ["เหนือ", "กลาง", "ใต้"] };
    expect(checkValue(rule, "เหนือ")).toBeNull();
    expect(checkValue(rule, "ภาคเหนือ")).toBe("notInList");
  });

  it("ignores the spaces somebody pasted along with it", () => {
    expect(checkValue({ kind: "list", values: ["เหนือ"] }, "  เหนือ ")).toBeNull();
  });

  it("checks a number against its bounds and says which one it broke", () => {
    const rule: ValidationRule = { kind: "number", min: 0, max: 100 };
    expect(checkValue(rule, "45")).toBeNull();
    expect(checkValue(rule, "-1")).toBe("tooSmall");
    expect(checkValue(rule, "101")).toBe("tooLarge");
    expect(checkValue(rule, "กาแฟ")).toBe("notANumber");
  });

  it("allows a bound on one side only", () => {
    expect(checkValue({ kind: "number", min: 0 }, "999999")).toBeNull();
    expect(checkValue({ kind: "number", max: 10 }, "-40")).toBeNull();
  });

  it("checks a length", () => {
    expect(checkValue({ kind: "length", max: 5 }, "กาแฟ")).toBeNull();
    expect(checkValue({ kind: "length", max: 3 }, "กาแฟลาเต้")).toBe("tooLong");
  });

  it("always lets a cell be cleared", () => {
    // A rule that refuses deletion turns a typo into something nobody can undo by hand.
    expect(checkValue({ kind: "list", values: ["ก"] }, "")).toBeNull();
    expect(checkValue({ kind: "number", min: 5 }, "   ")).toBeNull();
  });

  it("lets a formula through, because the rule is about the answer and this is not it", () => {
    // Refusing formulas would mean a validated column could hold none at all, which costs more
    // than the rule is worth.
    expect(checkValue({ kind: "number", max: 10 }, "=SUM(A1:A9)")).toBeNull();
  });

  it("lets everything through where there is no rule", () => {
    expect(checkValue(undefined, "anything at all")).toBeNull();
  });
});

describe("attaching rules to cells", () => {
  it("covers every cell of the range", () => {
    const withRule = withValidation(sheet(), range(1, 1, 3, 2), { kind: "length", max: 4 });
    expect(ruleAt(withRule, 1, 1)).toBeDefined();
    expect(ruleAt(withRule, 3, 2)).toBeDefined();
    expect(ruleAt(withRule, 4, 2)).toBeUndefined();
  });

  it("clears them, and drops the field once none are left", () => {
    const withRule = withValidation(sheet(), range(0, 0, 2, 2), { kind: "length", max: 4 });
    expect(withValidation(withRule, range(0, 0, 2, 2), undefined)).not.toHaveProperty("validation");
  });

  it("hands back the same sheet when clearing one that was never there", () => {
    const plain = sheet();
    expect(withValidation(plain, range(0, 0, 1, 1), undefined)).toBe(plain);
  });

  it("offers a dropdown's options to the editor, and nothing for the other kinds", () => {
    const list = withValidation(sheet(), range(0, 0, 0, 0), { kind: "list", values: ["ก", "ข"] });
    expect(choicesAt(list, 0, 0)).toEqual(["ก", "ข"]);
    const number = withValidation(sheet(), range(0, 0, 0, 0), { kind: "number", min: 1 });
    expect(choicesAt(number, 0, 0)).toBeUndefined();
  });

  it("treats an empty list as no dropdown rather than an empty one", () => {
    const empty = withValidation(sheet(), range(0, 0, 0, 0), { kind: "list", values: [] });
    expect(choicesAt(empty, 0, 0)).toBeUndefined();
  });
});

describe("rules follow their cells", () => {
  const ruled = withValidation(sheet(), range(4, 1, 4, 1), { kind: "list", values: ["ก"] });

  it("move down when a row is inserted above", () => {
    // A rule left on its old index is worse than none: the column looks validated and the
    // validated cell is one row off.
    const moved = shiftValidation(ruled.validation, "row", 0, 1);
    expect(moved?.["5,1"]).toBeDefined();
    expect(moved?.["4,1"]).toBeUndefined();
  });

  it("go away with the row they were on", () => {
    expect(shiftValidation(ruled.validation, "row", 4, -1)).toBeUndefined();
  });

  it("stay put for a change below them", () => {
    expect(shiftValidation(ruled.validation, "row", 9, 1)?.["4,1"]).toBeDefined();
  });

  it("do the same across columns", () => {
    expect(shiftValidation(ruled.validation, "col", 0, 1)?.["4,2"]).toBeDefined();
  });
});

describe("reading a list somebody typed", () => {
  it("takes commas and newlines alike, because people paste columns", () => {
    expect(parseList("เหนือ, กลาง\nใต้")).toEqual(["เหนือ", "กลาง", "ใต้"]);
  });

  it("drops blanks and repeats", () => {
    // A dropdown offering the same thing twice is a dropdown somebody files a bug about.
    expect(parseList("ก,,ข,ก,  ,ข")).toEqual(["ก", "ข"]);
  });

  it("gives nothing back for nothing typed", () => {
    expect(parseList("   \n , ")).toEqual([]);
  });
});

describe("carrying a rule into and out of a .xlsx", () => {
  const list = (formulae: unknown[]) => {
    const raw = formulae[0];
    return typeof raw === "string" && raw.startsWith('"') ? raw.slice(1, -1).split(",") : undefined;
  };

  it("writes a list as the inline quoted form Excel reads", () => {
    expect(toExcelValidation({ kind: "list", values: ["เหนือ", "กลาง"] })).toEqual({
      type: "list",
      allowBlank: true,
      formulae: ['"เหนือ,กลาง"'],
    });
  });

  it("refuses to write a list whose options contain a comma", () => {
    // The inline form has no escape for one. Dropping the dropdown loses a feature; writing it
    // anyway would split one option into two in somebody else's file.
    expect(toExcelValidation({ kind: "list", values: ["ก, ข", "ค"] })).toBeUndefined();
  });

  it("refuses a list too long for the format's 255 characters", () => {
    const values = Array.from({ length: 40 }, (_, i) => `option${i}`);
    expect(toExcelValidation({ kind: "list", values })).toBeUndefined();
  });

  it("picks the operator that matches which ends the range has", () => {
    expect(toExcelValidation({ kind: "number", min: 0, max: 10 })?.operator).toBe("between");
    expect(toExcelValidation({ kind: "number", min: 0 })?.operator).toBe("greaterThanOrEqual");
    expect(toExcelValidation({ kind: "number", max: 10 })?.operator).toBe("lessThanOrEqual");
    expect(toExcelValidation({ kind: "number" })).toBeUndefined();
  });

  it("reads each of those three back as the rule that wrote it", () => {
    for (const rule of [
      { kind: "number", min: 0, max: 10 },
      { kind: "number", min: 0 },
      { kind: "number", max: 10 },
      { kind: "length", max: 12 },
      { kind: "list", values: ["a", "b"] },
    ] as ValidationRule[]) {
      expect(fromExcelValidation(toExcelValidation(rule), list)).toEqual(rule);
    }
  });

  it("reads a bound the file wrote as text rather than a number", () => {
    // Files in the wild carry `formulae: ["10"]` as often as `[10]`; a strict read would silently
    // drop half of them.
    expect(fromExcelValidation({ type: "decimal", operator: "lessThanOrEqual", formulae: ["10"] }, list)).toEqual({
      kind: "number",
      max: 10,
    });
  });

  it("ignores a validation type this app has no equivalent for", () => {
    // Approximating "date after 2024" as "any number" would refuse values the original allowed.
    expect(fromExcelValidation({ type: "date", operator: "greaterThan", formulae: [1] }, list)).toBeUndefined();
    expect(fromExcelValidation({ type: "custom", formulae: ["=ISNUMBER(A1)"] }, list)).toBeUndefined();
    expect(fromExcelValidation(undefined, list)).toBeUndefined();
  });

  it("treats a whole-number rule as a number rule", () => {
    expect(fromExcelValidation({ type: "whole", operator: "between", formulae: [1, 5] }, list)).toEqual({
      kind: "number",
      min: 1,
      max: 5,
    });
  });
});
