// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import type { TableData } from "@/lib/dataSources/types";
import { computeSheet } from "@/lib/sheet";
import { useSheetStore } from "./sheetStore";

/**
 * A source whose list comes back empty (#65).
 *
 * The envelope used to become the table — `ok | page | total…` — and a SUM over the old qty column
 * read the envelope's `total` as data. Now an empty list is no rows, and the block keeps the
 * columns it last had: a header with nothing under it, rather than a block wiped without a word.
 */
const state = () => useSheetStore.getState();
const tab = () => state().sheets[0];
const at = () => new Date(0).toISOString();

const FULL: TableData = {
  columns: [
    { key: "sku", label: "sku", numeric: false },
    { key: "qty", label: "qty", numeric: true },
  ],
  rows: [
    ["CF-01", 10],
    ["CF-02", 20],
  ],
  fetchedAt: at(),
};
const EMPTY: TableData = { columns: [], rows: [], fetchedAt: at() };

beforeEach(() => {
  state().startBlank();
  state().addLiveBlock({ sourceId: "orders", anchorRow: 0, anchorCol: 0, kind: "table" }, FULL);
  state().setCellRaw(0, 4, "=SUM(B2:B10)");
});

describe("an empty result from a live source (#65)", () => {
  it("keeps the last columns as a header and clears the rows under it", () => {
    state().applyLiveData("orders", EMPTY);
    const cells = tab().sheet.cells;
    expect(cells[0].slice(0, 2)).toEqual(["sku", "qty"]);
    expect(cells[1].slice(0, 2)).toEqual(["", ""]);
    expect(cells[2].slice(0, 2)).toEqual(["", ""]);
    expect(computeSheet(tab().sheet).values[0][4]).toBe(0);
  });

  it("keeps the block, sized to its header, and fills it again when rows come back", () => {
    state().applyLiveData("orders", EMPTY);
    expect(tab().liveBlocks?.[0]).toMatchObject({ rows: 1, cols: 2 });
    state().applyLiveData("orders", FULL);
    expect(tab().sheet.cells[2].slice(0, 2)).toEqual(["CF-02", "20"]);
  });
});
