// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * A tab that is only looking at the workbook (#47) neither changes it nor saves it: a second tab
 * used to write its whole copy over the first one's work. The store builds its storage when the
 * module loads, so the fake is in place before the store is imported.
 */
const data = new Map<string, string>();
let writes = 0;
const fake = {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => {
    writes++;
    data.set(k, v);
  },
  removeItem: (k: string) => void data.delete(k),
};

beforeAll(() => {
  (globalThis as { localStorage?: unknown }).localStorage = fake;
});
afterAll(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

const load = async () => ({ ...(await import("./sheetStore")), ...(await import("./tabStore")) });

beforeEach(async () => {
  const { useTabStore, useSheetStore } = await load();
  useTabStore.setState({ role: "editor", refused: 0 });
  useSheetStore.getState().startBlank();
});

describe("a tab that is only looking (#47)", () => {
  it("refuses an edit and says so, and saves nothing", async () => {
    const { useTabStore, useSheetStore } = await load();
    useTabStore.setState({ role: "viewer" });
    const before = useSheetStore.getState().sheets;
    const saved = writes;
    useSheetStore.getState().setCellRaw(0, 0, "typed while looking");
    expect(useSheetStore.getState().sheets).toBe(before);
    expect(useTabStore.getState().refused).toBe(1);
    expect(writes).toBe(saved);
  });

  it("still moves the selection, so the sheet can be read and copied", async () => {
    const { useTabStore, useSheetStore } = await load();
    useTabStore.setState({ role: "handedOff" });
    const { setSelection } = useSheetStore.getState();
    setSelection({ startRow: 3, startCol: 2, endRow: 3, endCol: 2, anchorRow: 3, anchorCol: 2 });
    const { activeSheetId, selectionBySheetId } = useSheetStore.getState();
    expect(selectionBySheetId[activeSheetId]?.anchorRow).toBe(3);
    expect(useTabStore.getState().refused).toBe(0);
  });

  it("the tab that edits changes and saves as before", async () => {
    const { useSheetStore } = await load();
    const saved = writes;
    useSheetStore.getState().setCellRaw(0, 0, "typed while editing");
    expect(useSheetStore.getState().sheets[0].sheet.cells[0][0]).toBe("typed while editing");
    expect(writes).toBeGreaterThan(saved);
  });

  it("a tab whose lock has not answered yet edits and saves, as every tab did before", async () => {
    const { useTabStore, useSheetStore } = await load();
    useTabStore.setState({ role: "starting" });
    const saved = writes;
    useSheetStore.getState().setCellRaw(1, 1, "first keystroke");
    expect(useSheetStore.getState().sheets[0].sheet.cells[1][1]).toBe("first keystroke");
    expect(writes).toBeGreaterThan(saved);
  });
});
