import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The bug this pins, as it happened: a workbook too big for `localStorage` made every save throw,
 * the throw escaped from the action that caused it, and Export — which sets a busy flag, and so
 * saves — never reached the download. The work was then lost on reload with no warning.
 *
 * The store builds its storage when the module loads, so the fake has to be in place before the
 * store is imported; hence the dynamic imports.
 */
const writes = { fail: true, count: 0 };
const data = new Map<string, string>();
const fake = {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => {
    writes.count++;
    if (writes.fail) throw Object.assign(new Error("exceeded the quota"), { name: "QuotaExceededError" });
    data.set(k, v);
  },
  removeItem: (k: string) => void data.delete(k),
};

const downloads: Blob[] = [];
vi.mock("@/lib/excelIO", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/excelIO")>()),
  downloadBlob: (blob: Blob) => void downloads.push(blob),
}));

beforeAll(() => {
  (globalThis as { localStorage?: unknown }).localStorage = fake;
});
afterAll(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("when the browser will not take the save", () => {
  it("an edit still lands, and the failure becomes a status rather than an exception", async () => {
    const { useSheetStore } = await import("./sheetStore");
    const { getSaveStatus } = await import("@/lib/saveHealth");
    expect(() => useSheetStore.getState().setCellRaw(0, 0, "kept in memory")).not.toThrow();
    expect(writes.count).toBeGreaterThan(0); // the save really was attempted — and refused
    expect(useSheetStore.getState().sheets[0].sheet.cells[0][0]).toBe("kept in memory");
    expect(getSaveStatus()).toBe("full");
  });

  it("export still produces a file", async () => {
    const { useSheetStore } = await import("./sheetStore");
    await useSheetStore.getState().exportXlsx();
    expect(downloads).toHaveLength(1);
    expect(downloads[0].size).toBeGreaterThan(0);
    expect(useSheetStore.getState().busy).toBeNull();
  });

  it("clears the moment a save lands again", async () => {
    const { useSheetStore } = await import("./sheetStore");
    const { getSaveStatus } = await import("@/lib/saveHealth");
    writes.fail = false;
    useSheetStore.getState().setCellRaw(0, 1, "smaller now");
    expect(getSaveStatus()).toBe("ok");
    expect(data.get("exceltogo-sheet-v2")).toContain("smaller now");
  });
});
