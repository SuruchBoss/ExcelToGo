// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveChannel } from "@/lib/cloud/liveRoom";
import type { LiveMessage } from "@/lib/cloud/liveSession";

/**
 * The wiring, with the socket replaced by a function call.
 *
 * Everything below is a seam rather than a rule: the rules have their own tests in
 * `lib/cloud/`. What is tested here is the part that can only go wrong once the pieces are joined
 * up — an edit of this person's reaching the wire, an edit from the wire reaching the document,
 * and the two not feeding each other for ever.
 */
const sent: LiveMessage[] = [];
let deliver: (message: LiveMessage) => void = () => {};

vi.mock("@/lib/cloud/realtimeChannel", () => ({
  openRealtimeChannel: vi.fn(async ({ onStatus }: { onStatus?: (s: "joined" | "failed") => void }) => {
    const channel: LiveChannel = {
      send: (m) => sent.push(m),
      onMessage: (h) => (deliver = h),
      onPresence: () => {},
      track: () => {},
      close: () => {},
    };
    onStatus?.("joined");
    return channel;
  }),
}));

// The cloud client is never reached in these tests, but importing it pulls in the Supabase types
// and, through them, a module that expects a browser. Stubbed rather than worked around.
vi.mock("@/lib/cloud/client", () => ({
  fetchWorkbook: vi.fn(async () => ({ id: "w1", name: "งาน", updated_at: "", data: { format: 1, sheets: [] } })),
  listWorkbooks: vi.fn(async () => []),
  onSessionChange: vi.fn(async () => () => {}),
  insertWorkbook: vi.fn(),
  updateWorkbook: vi.fn(),
  deleteWorkbook: vi.fn(),
  fetchUpdatedAt: vi.fn(async () => null),
  sendSignInLink: vi.fn(),
  signOut: vi.fn(),
}));

const { useCloudStore } = await import("./cloudStore");
const { useLiveStore } = await import("./liveStore");
const { useSheetStore } = await import("./sheetStore");

async function joined() {
  useCloudStore.setState({ linked: { id: "w1", name: "งาน", seenAt: "2026-01-01T00:00:00.000Z" } });
  await useLiveStore.getState().join();
  return useSheetStore.getState().sheets[0].id;
}

beforeEach(() => {
  sent.length = 0;
  useLiveStore.getState().leave();
  useSheetStore.getState().startBlank();
});

describe("turning it on", () => {
  it("does nothing without a saved workbook, because there is no room to join", async () => {
    useCloudStore.setState({ linked: null });
    await useLiveStore.getState().join();
    expect(useLiveStore.getState().status).toBe("off");
  });

  it("goes live once the channel is up", async () => {
    await joined();
    expect(useLiveStore.getState().status).toBe("live");
  });
});

describe("what leaves this browser", () => {
  it("puts a typed cell on the wire", async () => {
    const tabId = await joined();
    useSheetStore.getState().setCellRaw(1, 2, "กาแฟ");
    expect(sent).toContainEqual(expect.objectContaining({ kind: "cell", tabId, row: 1, col: 2, raw: "กาแฟ" }));
  });

  it("puts a pasted block on the wire cell by cell", async () => {
    await joined();
    useSheetStore.getState().setCellRaw(0, 0, "ก");
    useSheetStore.getState().setCellRaw(0, 1, "ข");
    expect(sent.filter((m) => m.kind === "cell")).toHaveLength(2);
  });

  it("sends a cursor when the selection moves", async () => {
    await joined();
    useSheetStore.getState().setSelection({ startRow: 4, startCol: 1, endRow: 4, endCol: 1, anchorRow: 4, anchorCol: 1 });
    expect(sent).toContainEqual(expect.objectContaining({ kind: "cursor", row: 4, col: 1 }));
  });

  it("stops sending the moment the session is left", async () => {
    await joined();
    useLiveStore.getState().leave();
    useSheetStore.getState().setCellRaw(0, 0, "หลังออกห้อง");
    expect(sent).toHaveLength(0);
  });
});

describe("what arrives from the wire", () => {
  it("lands in the sheet", async () => {
    const tabId = await joined();
    deliver({ kind: "cell", tabId, row: 2, col: 1, raw: "45", at: Date.now(), from: "them0000" });
    expect(useSheetStore.getState().sheets[0].sheet.cells[2][1]).toBe("45");
  });

  it("is not sent straight back out again", async () => {
    // Without the guard, the diff would see the remote write as a local edit and broadcast it, and
    // two browsers would trade one keystroke between them for as long as both were open.
    const tabId = await joined();
    deliver({ kind: "cell", tabId, row: 2, col: 1, raw: "45", at: Date.now(), from: "them0000" });
    expect(sent.filter((m) => m.kind === "cell")).toHaveLength(0);
  });

  it("stays out of this person's undo history", async () => {
    // Ctrl+Z should take back what you typed, not quietly reverse a colleague's edit.
    const tabId = await joined();
    useSheetStore.getState().setCellRaw(0, 0, "ของเรา");
    const before = useSheetStore.temporal.getState().pastStates.length;
    deliver({ kind: "cell", tabId, row: 5, col: 0, raw: "ของเขา", at: Date.now(), from: "them0000" });
    expect(useSheetStore.temporal.getState().pastStates.length).toBe(before);
  });

  it("survives this person's undo, which would otherwise erase it without a word", async () => {
    // Undo restores a snapshot of the whole workbook. A colleague's edit that arrived after that
    // snapshot was taken is not in it, so a plain undo of your own last word takes their work with
    // it — silently. The remote value is written into the stored snapshots for exactly this.
    const tabId = await joined();
    useSheetStore.getState().setCellRaw(0, 0, "ของเรา");
    deliver({ kind: "cell", tabId, row: 5, col: 0, raw: "ของเขา", at: Date.now(), from: "them0000" });
    useSheetStore.temporal.getState().undo();

    expect(useSheetStore.getState().sheets[0].sheet.cells[0][0]).toBe("");
    expect(useSheetStore.getState().sheets[0].sheet.cells[5][0]).toBe("ของเขา");
  });

  it("puts it back on redo as well, so a redo is not a second chance to lose it", async () => {
    const tabId = await joined();
    useSheetStore.getState().setCellRaw(0, 0, "ของเรา");
    deliver({ kind: "cell", tabId, row: 5, col: 0, raw: "ของเขา", at: Date.now(), from: "them0000" });
    useSheetStore.temporal.getState().undo();
    useSheetStore.temporal.getState().redo();

    expect(useSheetStore.getState().sheets[0].sheet.cells[0][0]).toBe("ของเรา");
    expect(useSheetStore.getState().sheets[0].sheet.cells[5][0]).toBe("ของเขา");
  });

  it("is ignored for a tab this browser does not have", async () => {
    await joined();
    deliver({ kind: "cell", tabId: "not-here", row: 0, col: 0, raw: "x", at: Date.now(), from: "them0000" });
    expect(useSheetStore.getState().sheets[0].sheet.cells[0][0]).toBe("");
  });
});
