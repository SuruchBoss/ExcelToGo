import { describe, expect, it } from "vitest";
import {
  CellEdit,
  cellKeyOf,
  colourFor,
  decide,
  DecisionContext,
  LiveMessage,
  randomClientId,
  wins,
} from "./liveSession";

const ME = "me000000";
const THEM = "them0000";

const ctx = (over: Partial<DecisionContext> = {}): DecisionContext => ({
  self: ME,
  knownTabs: new Set(["t1"]),
  editing: null,
  applied: new Map(),
  ...over,
});

const edit = (over: Partial<CellEdit> = {}): CellEdit => ({
  kind: "cell",
  tabId: "t1",
  row: 2,
  col: 3,
  raw: "45",
  at: 1_000,
  from: THEM,
  ...over,
});

const cursor = (over: Partial<Extract<LiveMessage, { kind: "cursor" }>> = {}): LiveMessage => ({
  kind: "cursor",
  tabId: "t1",
  row: 0,
  col: 0,
  from: THEM,
  name: "สมชาย",
  ...over,
});

describe("what to do with a message that arrives", () => {
  it("applies an edit from someone else", () => {
    expect(decide(edit(), ctx())).toEqual({ action: "apply" });
  });

  it("ignores its own message coming back off the wire", () => {
    // Supabase delivers what you broadcast back to you. Applying it would be harmless for a cell
    // but not for undo: every keystroke would land in history twice.
    expect(decide(edit({ from: ME }), ctx())).toEqual({ action: "ignore", why: "own-message" });
  });

  it("ignores an edit for a tab this client does not have", () => {
    expect(decide(edit({ tabId: "gone" }), ctx())).toEqual({ action: "ignore", why: "other-tab" });
  });

  it("resyncs rather than merging a row or column insert", () => {
    // A structural change moves every cell below or right of it, so a cell message crossing one on
    // the wire lands in the wrong place. Reloading the saved copy is visible; diverging is not.
    expect(decide({ kind: "structure", tabId: "t1", at: 5, from: THEM }, ctx())).toEqual({
      action: "resync",
      why: "structure-changed",
    });
  });

  it("defers an edit to the cell the local person has open", () => {
    const editing = { tabId: "t1", row: 2, col: 3 };
    expect(decide(edit(), ctx({ editing }))).toEqual({ action: "defer", why: "being-edited" });
  });

  it("applies to a neighbouring cell while one is being edited", () => {
    const editing = { tabId: "t1", row: 2, col: 4 };
    expect(decide(edit(), ctx({ editing }))).toEqual({ action: "apply" });
  });

  it("applies to the same address on a different tab while one is being edited", () => {
    const editing = { tabId: "t2", row: 2, col: 3 };
    expect(decide(edit(), ctx({ editing, knownTabs: new Set(["t1", "t2"]) }))).toEqual({ action: "apply" });
  });

  it("ignores a message that lost a race it has already seen the winner of", () => {
    const applied = new Map([[cellKeyOf("t1", 2, 3), { at: 2_000, from: THEM }]]);
    expect(decide(edit({ at: 1_000 }), ctx({ applied }))).toEqual({ action: "ignore", why: "older" });
  });

  it("applies a message newer than the last one it applied to that cell", () => {
    const applied = new Map([[cellKeyOf("t1", 2, 3), { at: 1_000, from: THEM }]]);
    expect(decide(edit({ at: 2_000 }), ctx({ applied }))).toEqual({ action: "apply" });
  });

  it("does not let a stale write to one cell block a fresh one to another", () => {
    const applied = new Map([[cellKeyOf("t1", 9, 9), { at: 9_000, from: THEM }]]);
    expect(decide(edit({ at: 1 }), ctx({ applied }))).toEqual({ action: "apply" });
  });
});

describe("a cursor is not an edit", () => {
  it("is applied even for a tab this client does not have, so presence still reads right", () => {
    expect(decide(cursor({ tabId: "gone" }), ctx())).toEqual({ action: "apply" });
  });

  it("is applied even over the cell being edited — it changes nothing in the sheet", () => {
    const editing = { tabId: "t1", row: 0, col: 0 };
    expect(decide(cursor(), ctx({ editing }))).toEqual({ action: "apply" });
  });

  it("is still ignored when it is this client's own", () => {
    expect(decide(cursor({ from: ME }), ctx())).toEqual({ action: "ignore", why: "own-message" });
  });
});

describe("which of two writes to the same cell stands", () => {
  it("gives it to the later one", () => {
    expect(wins({ at: 2, from: "a" }, { at: 1, from: "b" })).toBe(true);
    expect(wins({ at: 1, from: "a" }, { at: 2, from: "b" })).toBe(false);
  });

  it("breaks a tie by client id rather than leaving two screens different for ever", () => {
    // Without this, two clients whose clocks agree to the millisecond each keep their own value
    // and never converge — the one outcome the module exists to prevent.
    expect(wins({ at: 1, from: "b" }, { at: 1, from: "a" })).toBe(true);
    expect(wins({ at: 1, from: "a" }, { at: 1, from: "b" })).toBe(false);
  });

  it("reaches the same answer from both sides, which is what makes it a rule and not a guess", () => {
    const a = { at: 1, from: "aaa" };
    const b = { at: 1, from: "zzz" };
    expect(wins(a, b)).toBe(false);
    expect(wins(b, a)).toBe(true);
  });

  it("refuses to let a message win against itself, so a redelivery is not applied twice", () => {
    const one = { at: 7, from: "aaa" };
    expect(wins(one, one)).toBe(false);
  });
});

describe("telling participants apart", () => {
  it("gives the same person the same colour every time", () => {
    expect(colourFor("abc123")).toBe(colourFor("abc123"));
  });

  it("uses colours from its own palette and nothing else", () => {
    const seen = new Set(Array.from({ length: 200 }, () => colourFor(randomClientId())));
    expect(seen.size).toBeGreaterThan(1);
    for (const colour of seen) expect(colour).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("makes ids that do not collide across a roomful of people", () => {
    const ids = new Set(Array.from({ length: 500 }, randomClientId));
    expect(ids.size).toBe(500);
  });
});

describe("the key a cell is remembered under", () => {
  it("keeps the same address on two tabs apart", () => {
    expect(cellKeyOf("t1", 2, 3)).not.toBe(cellKeyOf("t2", 2, 3));
  });

  it("does not confuse row 1 column 12 with row 11 column 2", () => {
    expect(cellKeyOf("t1", 1, 12)).not.toBe(cellKeyOf("t1", 11, 2));
  });
});
