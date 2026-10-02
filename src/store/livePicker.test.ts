// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import type { TableData } from "@/lib/dataSources/types";
import { pickerChoice } from "@/lib/liveBlocks";
import { useSheetStore } from "./sheetStore";

/**
 * A single-value live cell never replaces a cell with a blank (#126).
 *
 * QA's first-time visitor opened the picker on a five-row sample source. The dialog had fixed its
 * defaults before the rows arrived — "a single summary number", nothing picked — Insert was
 * enabled, and A1 ("Product") became a blank that every refresh wrote again. Tested at both ends:
 * the choice the dialog derives as the table turns up, and the store refusing a value with no
 * column from any caller.
 */
const state = () => useSheetStore.getState();
const at = () => new Date(0).toISOString();

const FIVE_ROWS: TableData = {
  columns: [
    { key: "product", label: "Product", numeric: false },
    { key: "sales", label: "Sales", numeric: true },
  ],
  rows: [
    ["Coffee", 120],
    ["Tea", 80],
    ["Milk", 45],
    ["Juice", 60],
    ["Water", 30],
  ],
  fetchedAt: at(),
};
/** What the dialog saw on its first render before: nothing has arrived yet. */
const NOT_YET: TableData = { columns: [], rows: [], fetchedAt: at() };

beforeEach(() => {
  state().startBlank();
  useSheetStore.temporal.getState().clear();
  state().setCellRaw(0, 0, "Product");
});

describe("the picker's choice follows the table as it arrives", () => {
  it("nothing picked yet is not ready, and five rows arriving make the whole table the default", () => {
    const before = pickerChoice(NOT_YET, null, null);
    expect(before).toEqual({ kind: "value", picked: null, ready: false });

    const after = pickerChoice(FIVE_ROWS, null, null);
    expect(after.kind).toBe("table");
    expect(after.ready).toBe(true);
  });

  it("a single value the person chose picks a real number once the rows are there", () => {
    expect(pickerChoice(NOT_YET, "value", null).ready).toBe(false);
    const chosen = pickerChoice(FIVE_ROWS, "value", null);
    expect(chosen.picked).toEqual({ column: "sales", aggregate: "sum" });
    expect(chosen.ready).toBe(true);
  });

  it("keeps what the person picked, and drops a pick whose column is gone", () => {
    const mine = { column: "sales", aggregate: "avg" as const };
    expect(pickerChoice(FIVE_ROWS, "value", mine).picked).toEqual(mine);
    expect(pickerChoice(FIVE_ROWS, "value", { column: "gone", aggregate: "sum" }).picked).toEqual({
      column: "sales",
      aggregate: "sum",
    });
  });
});

describe("the store never writes a single value with nothing in it", () => {
  it("QA's repro: a value block with no column leaves A1 as it was, and nothing is bound", () => {
    state().addLiveBlock({ sourceId: "sales", anchorRow: 0, anchorCol: 0, kind: "value", column: "", aggregate: "first" }, FIVE_ROWS);
    expect(state().sheets[0].sheet.cells[0][0]).toBe("Product");
    expect(state().sheets[0].liveBlocks ?? []).toHaveLength(0);
  });

  it("the same for changing a placed block into an empty value", () => {
    state().addLiveBlock({ sourceId: "sales", anchorRow: 2, anchorCol: 0, kind: "value", column: "sales", aggregate: "sum" }, FIVE_ROWS);
    const block = state().sheets[0].liveBlocks![0];
    expect(state().sheets[0].sheet.cells[2][0]).toBe("335");
    state().replaceLiveBlock(block.id, { sourceId: "sales", anchorRow: 2, anchorCol: 0, kind: "value", column: "" }, FIVE_ROWS);
    expect(state().sheets[0].sheet.cells[2][0]).toBe("335");
    expect(state().sheets[0].liveBlocks![0].column).toBe("sales");
  });
});
