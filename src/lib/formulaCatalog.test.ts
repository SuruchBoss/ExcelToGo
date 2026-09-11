import { describe, expect, it } from "vitest";
import { getFormulaCatalog } from "./formulaCatalog";
import { th } from "@/i18n/th";
import { en } from "@/i18n/en";
import { calc } from "./formulaEngine/testUtils";

const catalog = getFormulaCatalog(th);
const defOf = (id: string) => {
  const def = catalog.find((f) => f.id === id);
  if (!def) throw new Error(`no catalog entry for ${id}`);
  return def;
};

const sales = [
  ["สาขา", "ไตรมาส", "ยอดขาย"],
  ["กรุงเทพ", "Q1", 120],
  ["เชียงใหม่", "Q1", 45],
  ["กรุงเทพ", "Q2", 260],
  ["เชียงใหม่", "Q2", 80],
  ["ภูเก็ต", "Q2", 150],
];

describe("what the formula palette builds", () => {
  it("quotes a criteria that happens to look like a cell reference", () => {
    // "Q2" is a quarter, not cell Q2. Reading it as a reference made the formula match an empty
    // cell and quietly total zero — the failure this test exists to stop coming back.
    const built = defOf("SUMIFS").build({ sumRange: "C2:C6", critRange1: "B2:B6", criteria1: "Q2" });
    expect(built).toBe('SUMIFS(C2:C6,B2:B6,"Q2")');
    expect(calc(built, sales)).toBe(490);
  });

  it("does the same for the older single-condition functions", () => {
    expect(defOf("SUMIF").build({ range: "B2:B6", criteria: "Q2", sumRange: "C2:C6" })).toBe('SUMIF(B2:B6,"Q2",C2:C6)');
    expect(defOf("COUNTIF").build({ range: "B2:B6", criteria: "Q1" })).toBe('COUNTIF(B2:B6,"Q1")');
  });

  it("quotes a comparison criteria, which is the only form that parses", () => {
    // `SUMIF(A1:A9,>100,B1:B9)` is a syntax error here and in Excel alike; the criteria has to be
    // a string. The palette used to emit the unquoted form.
    const built = defOf("SUMIFS").build({ sumRange: "C2:C6", critRange1: "C2:C6", criteria1: ">100" });
    expect(built).toBe('SUMIFS(C2:C6,C2:C6,">100")');
    expect(calc(built, sales)).toBe(530);
  });

  it("the older single-condition functions get the same comparison fix", () => {
    const built = defOf("SUMIF").build({ range: "C2:C6", criteria: ">=150", sumRange: "C2:C6" });
    expect(built).toBe('SUMIF(C2:C6,">=150",C2:C6)');
    expect(calc(built, sales)).toBe(410);
  });

  it("leaves a concatenated criteria alone, which is how a cell is referenced here", () => {
    expect(defOf("COUNTIF").build({ range: "B2:B6", criteria: '""&F1' })).toBe('COUNTIF(B2:B6,""&F1)');
  });

  it("still treats a bare reference as a reference where it is a value, not a criteria", () => {
    // IF's branches are values: someone typing A1 there means the cell.
    expect(defOf("IF").build({ cond: "A1>10", ifTrue: "B1", ifFalse: "ผ่าน" })).toBe('IF(A1>10,B1,"ผ่าน")');
  });

  it("drops SUMIFS' second condition when only half of it was filled in", () => {
    // A criteria range with no criteria after it is a #VALUE!, so the palette must not emit one.
    const built = defOf("SUMIFS").build({ sumRange: "C2:C6", critRange1: "A2:A6", criteria1: "กรุงเทพ", critRange2: "B2:B6", criteria2: "  " });
    expect(built).toBe('SUMIFS(C2:C6,A2:A6,"กรุงเทพ")');
    expect(calc(built, sales)).toBe(380);
  });

  it("includes both conditions when both are filled in", () => {
    const built = defOf("SUMIFS").build({ sumRange: "C2:C6", critRange1: "A2:A6", criteria1: "กรุงเทพ", critRange2: "B2:B6", criteria2: "Q2" });
    expect(calc(built, sales)).toBe(260);
  });

  it("builds INDEX with and without the optional column", () => {
    expect(defOf("INDEX").build({ range: "A1:C6", rowNum: "4", colNum: "3" })).toBe("INDEX(A1:C6,4,3)");
    expect(defOf("INDEX").build({ range: "C2:C6", rowNum: "3", colNum: "" })).toBe("INDEX(C2:C6,3)");
  });

  it("builds MATCH defaulting to an exact match", () => {
    expect(defOf("MATCH").build({ lookup: "A2", range: "A2:A6", matchType: "" })).toBe("MATCH(A2,A2:A6,0)");
  });

  it("every catalog entry has text in both languages", () => {
    // A formula with no entry in one dictionary renders as "undefined" in that language only,
    // which the build's type-checking cannot catch because the messages are a Record.
    for (const def of catalog) {
      expect(th.formulas[def.id], `th is missing ${def.id}`).toBeTruthy();
      expect(en.formulas[def.id], `en is missing ${def.id}`).toBeTruthy();
      expect(en.formulas[def.id].name).toBeTruthy();
    }
  });

  it("every catalog entry names each of its params in both languages", () => {
    for (const def of catalog) {
      for (const param of def.params) {
        expect(th.formulas[def.id].params[param.key], `th ${def.id}.${param.key}`).toBeTruthy();
        expect(en.formulas[def.id].params[param.key], `en ${def.id}.${param.key}`).toBeTruthy();
      }
    }
  });
});
