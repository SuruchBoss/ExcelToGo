import { beforeEach, describe, expect, it } from "vitest";
import { useSheetStore } from "./sheetStore";
import { ruleAt } from "@/lib/dataValidation";
import { computeSheet } from "@/lib/sheet";

/**
 * The two features that let a sheet say what it means: rules on what may be typed, and names for
 * ranges.
 *
 * At the store rather than through the UI, because both are mostly *refusals* — the popover is a
 * form, and the interesting behaviour is what happens when it is used wrongly.
 */
const state = () => useSheetStore.getState();
const sheet = () => state().sheets[0].sheet;
const select = (startRow: number, startCol: number, endRow: number, endCol: number) =>
  state().setSelection({ startRow, startCol, endRow, endCol, anchorRow: startRow, anchorCol: startCol });

beforeEach(() => {
  state().startBlank();
});

describe("a rule on what may be typed", () => {
  beforeEach(() => {
    select(0, 1, 4, 1);
    state().setValidation({ kind: "list", values: ["เหนือ", "กลาง", "ใต้"] });
  });

  it("covers every cell of the selection", () => {
    expect(ruleAt(sheet(), 4, 1)).toEqual({ kind: "list", values: ["เหนือ", "กลาง", "ใต้"] });
    expect(ruleAt(sheet(), 5, 1)).toBeUndefined();
  });

  it("refuses a value outside the list instead of saving it", () => {
    state().setCellRaw(2, 1, "north");
    expect(sheet().cells[2][1]).toBe("");
  });

  it("says out loud that it refused, because a dead keystroke explains nothing", () => {
    state().setCellRaw(2, 1, "north");
    expect(state().announcement?.text).toContain("B3");
  });

  it("still takes a value from the list, and still takes an empty one", () => {
    state().setCellRaw(2, 1, "กลาง");
    expect(sheet().cells[2][1]).toBe("กลาง");
    state().setCellRaw(2, 1, "");
    expect(sheet().cells[2][1]).toBe("");
  });

  it("moves down with the cells when a row is inserted above it", () => {
    select(0, 0, 0, 0);
    state().insertRowAtSelection();
    expect(ruleAt(sheet(), 1, 1)).toBeDefined();
    expect(ruleAt(sheet(), 0, 1)).toBeUndefined();
  });

  it("goes away entirely when cleared", () => {
    select(0, 1, 4, 1);
    state().setValidation(undefined);
    expect(sheet().validation).toBeUndefined();
  });
});

describe("naming a range", () => {
  const define = (label: string) => {
    select(0, 1, 3, 1);
    return state().defineName(label);
  };

  it("names the selection and makes it usable in a formula", () => {
    for (let r = 0; r < 4; r++) state().setCellRaw(r, 1, String((r + 1) * 10));
    expect(define("ยอดขาย")).toBeNull();
    state().setCellRaw(5, 0, "=SUM(ยอดขาย)");
    expect(computeSheet(sheet()).values[5][0]).toBe(100);
  });

  it("hands back the reason rather than throwing, so the panel can show it", () => {
    expect(define("B2")).toBe("looksLikeRef");
    expect(define("ยอด ขาย")).toBe("badChars");
    define("ยอดขาย");
    expect(define("ยอดขาย")).toBe("taken");
    expect(sheet().names && Object.keys(sheet().names!)).toEqual(["ยอดขาย"]);
  });

  it("follows the rows it points at when one is inserted above them", () => {
    define("ยอดขาย");
    select(0, 0, 0, 0);
    state().insertRowAtSelection();
    expect(sheet().names?.["ยอดขาย"].ref).toBe("$B$2:$B$5");
  });

  it("leaves the formulas holding the name when the name is deleted", () => {
    // Rewriting them back to addresses would look friendlier and quietly rewrite work nobody
    // asked to have rewritten. `#NAME?` is findable, and undo brings the name back.
    define("ยอดขาย");
    state().setCellRaw(5, 0, "=SUM(ยอดขาย)");
    state().deleteName("ยอดขาย");
    expect(sheet().cells[5][0]).toBe("=SUM(ยอดขาย)");
    expect(String(computeSheet(sheet()).values[5][0])).toBe("#NAME?");
  });

  it("can be undone, name and all", () => {
    define("ยอดขาย");
    useSheetStore.temporal.getState().undo();
    expect(sheet().names).toBeUndefined();
  });
});
