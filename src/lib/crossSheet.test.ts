import { beforeEach, describe, expect, it } from "vitest";
import { createEmptySheet, setCellRaw } from "./sheet";
import { computeSheet, computeStats, createWorkbookResolver, resetComputeCache } from "./sheetCompute";
import { clearFormulaCache } from "./formulaEngine/formulaProgram";

/** A sheet with values written into it, as one expression. */
function sheetOf(cells: Record<string, string>) {
  let s = createEmptySheet();
  for (const [ref, raw] of Object.entries(cells)) {
    const col = ref.charCodeAt(0) - 65;
    const row = Number(ref.slice(1)) - 1;
    s = setCellRaw(s, row, col, raw);
  }
  return s;
}
const at = (computed: ReturnType<typeof computeSheet>, ref: string) =>
  computed.display[Number(ref.slice(1)) - 1][ref.charCodeAt(0) - 65];

beforeEach(() => {
  resetComputeCache();
  clearFormulaCache();
});

describe("reading another sheet", () => {
  it("resolves a single cell", () => {
    const data = sheetOf({ A1: "10", A2: "32" });
    const main = sheetOf({ B1: "=ยอดขาย!A1 + ยอดขาย!A2" });
    const resolver = createWorkbookResolver([{ name: "ยอดขาย", sheet: data }, { name: "Main", sheet: main }]);
    expect(at(computeSheet(main, resolver), "B1")).toBe("42");
  });

  it("resolves a range, so SUM across sheets works", () => {
    const data = sheetOf({ A1: "1", A2: "2", A3: "3" });
    const main = sheetOf({ B1: "=SUM(Data!A1:A3)" });
    const resolver = createWorkbookResolver([{ name: "Data", sheet: data }, { name: "Main", sheet: main }]);
    expect(at(computeSheet(main, resolver), "B1")).toBe("6");
  });

  it("matches the sheet name however it was capitalised", () => {
    const data = sheetOf({ A1: "7" });
    const main = sheetOf({ B1: "=dAtA!A1" });
    const resolver = createWorkbookResolver([{ name: "Data", sheet: data }, { name: "Main", sheet: main }]);
    expect(at(computeSheet(main, resolver), "B1")).toBe("7");
  });

  it("handles a quoted name with a space in it", () => {
    const data = sheetOf({ A1: "5" });
    const main = sheetOf({ B1: "='ยอดขาย Q1'!A1*2" });
    const resolver = createWorkbookResolver([{ name: "ยอดขาย Q1", sheet: data }, { name: "Main", sheet: main }]);
    expect(at(computeSheet(main, resolver), "B1")).toBe("10");
  });

  it("reads a formula's value, not its text", () => {
    const data = sheetOf({ A1: "4", A2: "=A1*5" });
    const main = sheetOf({ B1: "=Data!A2" });
    const resolver = createWorkbookResolver([{ name: "Data", sheet: data }, { name: "Main", sheet: main }]);
    expect(at(computeSheet(main, resolver), "B1")).toBe("20");
  });
});

describe("when the other sheet is not there", () => {
  it("is #REF!, not a crash and not a zero", () => {
    const main = sheetOf({ B1: "=Budget!A1" });
    const resolver = createWorkbookResolver([{ name: "Main", sheet: main }]);
    expect(at(computeSheet(main, resolver), "B1")).toBe("#REF!");
  });

  it("is #REF! with no workbook at all, rather than silently zero", () => {
    // Every existing caller passes no resolver — charts, exports, the pivot renderer. A formula
    // reaching outside must not read as an empty cell there.
    const main = sheetOf({ B1: "=Budget!A1" });
    expect(at(computeSheet(main), "B1")).toBe("#REF!");
  });

  it("comes back to life when a sheet by that name appears", () => {
    // The staleness check has to remember the misses, not just the hits.
    const main = sheetOf({ B1: "=Budget!A1" });
    const before = createWorkbookResolver([{ name: "Main", sheet: main }]);
    expect(at(computeSheet(main, before), "B1")).toBe("#REF!");

    const budget = sheetOf({ A1: "99" });
    const after = createWorkbookResolver([{ name: "Main", sheet: main }, { name: "Budget", sheet: budget }]);
    expect(at(computeSheet(main, after), "B1")).toBe("99");
  });

  it("reads past the edge of a smaller sheet as empty, not as an error", () => {
    const data = sheetOf({ A1: "1" });
    const main = sheetOf({ B1: "=Data!Z400" });
    const resolver = createWorkbookResolver([{ name: "Data", sheet: data }, { name: "Main", sheet: main }]);
    expect(at(computeSheet(main, resolver), "B1")).toBe("");
  });
});

describe("staleness across sheets", () => {
  it("re-reads when the sheet it depends on changes, though its own cells did not", () => {
    // The bug this is really about: `main` is the identical object either way, so the identity
    // cache would hand back the old answer and the number on screen would simply be wrong.
    const main = sheetOf({ B1: "=Data!A1" });
    let data = sheetOf({ A1: "1" });
    expect(at(computeSheet(main, createWorkbookResolver([{ name: "Data", sheet: data }])), "B1")).toBe("1");

    data = setCellRaw(data, 0, 0, "2");
    expect(at(computeSheet(main, createWorkbookResolver([{ name: "Data", sheet: data }])), "B1")).toBe("2");
  });

  it("still takes the identity fast path when nothing anywhere moved", () => {
    const data = sheetOf({ A1: "1" });
    const main = sheetOf({ B1: "=Data!A1" });
    const tabs = [{ name: "Data", sheet: data }, { name: "Main", sheet: main }];
    computeSheet(main, createWorkbookResolver(tabs));
    const before = computeStats.identity;
    computeSheet(main, createWorkbookResolver(tabs));
    expect(computeStats.identity).toBeGreaterThan(before);
  });

  it("follows a change two sheets away", () => {
    // C reads B, B reads A. Touching A has to reach C.
    let a = sheetOf({ A1: "3" });
    const bSheet = sheetOf({ A1: "=A!A1*2" });
    const cSheet = sheetOf({ A1: "=B!A1+1" });
    const tabs = () => [{ name: "A", sheet: a }, { name: "B", sheet: bSheet }, { name: "C", sheet: cSheet }];
    expect(at(computeSheet(cSheet, createWorkbookResolver(tabs())), "A1")).toBe("7");

    a = setCellRaw(a, 0, 0, "10");
    expect(at(computeSheet(cSheet, createWorkbookResolver(tabs())), "A1")).toBe("21");
  });
});

describe("cycles that span sheets", () => {
  it("reports #CIRCULAR! instead of recursing for ever", () => {
    const one = sheetOf({ A1: "=Two!A1" });
    const two = sheetOf({ A1: "=One!A1" });
    const resolver = createWorkbookResolver([{ name: "One", sheet: one }, { name: "Two", sheet: two }]);
    expect(at(computeSheet(one, resolver), "A1")).toBe("#CIRCULAR!");
  });

  it("catches a three-sheet ring", () => {
    const one = sheetOf({ A1: "=Two!A1" });
    const two = sheetOf({ A1: "=Three!A1" });
    const three = sheetOf({ A1: "=One!A1" });
    const resolver = createWorkbookResolver([
      { name: "One", sheet: one },
      { name: "Two", sheet: two },
      { name: "Three", sheet: three },
    ]);
    expect(at(computeSheet(one, resolver), "A1")).toBe("#CIRCULAR!");
  });

  it("leaves the cells around the cycle working", () => {
    const one = sheetOf({ A1: "=Two!A1", B1: "=1+1" });
    const two = sheetOf({ A1: "=One!A1" });
    const resolver = createWorkbookResolver([{ name: "One", sheet: one }, { name: "Two", sheet: two }]);
    const out = computeSheet(one, resolver);
    expect(at(out, "A1")).toBe("#CIRCULAR!");
    expect(at(out, "B1")).toBe("2");
  });

  it("does not mistake two sheets reading a third for a cycle", () => {
    const shared = sheetOf({ A1: "5" });
    const left = sheetOf({ A1: "=Shared!A1" });
    const main = sheetOf({ A1: "=Shared!A1 + Left!A1" });
    const resolver = createWorkbookResolver([
      { name: "Shared", sheet: shared },
      { name: "Left", sheet: left },
      { name: "Main", sheet: main },
    ]);
    expect(at(computeSheet(main, resolver), "A1")).toBe("10");
  });
});
