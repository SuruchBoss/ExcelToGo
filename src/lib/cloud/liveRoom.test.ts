// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { LiveChannel, LiveRoom } from "./liveRoom";
import { CellEdit, LiveMessage, Participant } from "./liveSession";

/**
 * A transport that delivers messages by calling a function.
 *
 * Everything worth testing about a live session — a deferred edit flushing late, an echo of your
 * own keystroke, a message that lost a race arriving second — is reachable here and reachable
 * nowhere else, because nobody running these tests has a Supabase project to open a socket to.
 */
function fakeChannel() {
  let onMessage: (m: LiveMessage) => void = () => {};
  let onPresence: (p: Participant[]) => void = () => {};
  const sent: LiveMessage[] = [];
  const tracked: Participant[] = [];
  let closed = false;

  const channel: LiveChannel = {
    send: (m) => sent.push(m),
    onMessage: (h) => (onMessage = h),
    onPresence: (h) => (onPresence = h),
    track: (s) => tracked.push(s),
    close: () => (closed = true),
  };

  return {
    channel,
    sent,
    tracked,
    deliver: (m: LiveMessage) => onMessage(m),
    presence: (p: Participant[]) => onPresence(p),
    isClosed: () => closed,
  };
}

const THEM = "them0000";

const edit = (over: Partial<CellEdit> = {}): CellEdit => ({
  kind: "cell",
  tabId: "t1",
  row: 1,
  col: 1,
  raw: "45",
  at: 1_000,
  from: THEM,
  ...over,
});

function room(clock = { t: 1_000 }) {
  const wire = fakeChannel();
  const applied: CellEdit[] = [];
  const resyncs: string[] = [];
  const overwritten: CellEdit[] = [];
  let people: Participant[] = [];

  const live = new LiveRoom({
    channel: wire.channel,
    name: "สมชาย",
    self: "me000000",
    now: () => clock.t,
    hooks: {
      applyCell: (e) => applied.push(e),
      resync: (tabId) => resyncs.push(tabId),
      participants: (list) => (people = list),
      overwritten: (e) => overwritten.push(e),
    },
  });
  live.setTabs(["t1", "t2"]);

  return { live, wire, applied, resyncs, overwritten, people: () => people, clock };
}

describe("messages arriving while someone is working", () => {
  it("puts a remote edit into the sheet", () => {
    const r = room();
    r.wire.deliver(edit({ raw: "กาแฟ" }));
    expect(r.applied.map((e) => e.raw)).toEqual(["กาแฟ"]);
  });

  it("does not apply the echo of its own broadcast", () => {
    // Supabase delivers what you send back to you. Applying it is not harmless: every keystroke
    // would land in undo history twice.
    const r = room();
    r.live.localEdit("t1", 1, 1, "45");
    r.wire.deliver(r.wire.sent[0]);
    expect(r.applied).toHaveLength(0);
  });

  it("reloads rather than patching when a row is inserted somewhere else", () => {
    const r = room();
    r.wire.deliver({ kind: "structure", tabId: "t1", at: 2_000, from: THEM });
    expect(r.resyncs).toEqual(["t1"]);
    expect(r.applied).toHaveLength(0);
  });

  it("ignores an edit for a tab this client does not have open", () => {
    const r = room();
    r.wire.deliver(edit({ tabId: "deleted" }));
    expect(r.applied).toHaveLength(0);
  });

  it("drops a write that lost to one already applied, whichever order they arrive in", () => {
    const r = room();
    r.wire.deliver(edit({ at: 2_000, raw: "ทีหลัง" }));
    r.wire.deliver(edit({ at: 1_000, raw: "ก่อนหน้า" }));
    expect(r.applied.map((e) => e.raw)).toEqual(["ทีหลัง"]);
  });
});

describe("the cell someone has open", () => {
  it("is never overwritten mid-word", () => {
    // Watching your own typing vanish as you do it is the thing that makes people stop trusting a
    // shared document.
    const r = room();
    r.live.beginEdit("t1", 1, 1);
    r.wire.deliver(edit({ raw: "ของเขา" }));
    expect(r.applied).toHaveLength(0);
  });

  it("takes the held edit once the editor closes, and says so", () => {
    const r = room();
    r.live.beginEdit("t1", 1, 1);
    r.wire.deliver(edit({ at: 5_000, raw: "ของเขา" }));
    r.live.endEdit();
    expect(r.applied.map((e) => e.raw)).toEqual(["ของเขา"]);
    expect(r.overwritten).toHaveLength(1);
  });

  it("keeps what the local person typed when their edit is the later one", () => {
    const r = room({ t: 9_000 });
    r.live.beginEdit("t1", 1, 1);
    r.wire.deliver(edit({ at: 5_000, raw: "ของเขา" }));
    r.live.localEdit("t1", 1, 1, "ของเรา");
    r.live.endEdit();
    expect(r.applied).toHaveLength(0);
    expect(r.overwritten).toHaveLength(0);
  });

  it("holds only the winner when several arrive for the same cell", () => {
    // Replaying three superseded values in order would show the user two states that never existed.
    const r = room();
    r.live.beginEdit("t1", 1, 1);
    r.wire.deliver(edit({ at: 3_000, raw: "สอง" }));
    r.wire.deliver(edit({ at: 5_000, raw: "สาม" }));
    r.wire.deliver(edit({ at: 4_000, raw: "ตกรุ่น" }));
    r.live.endEdit();
    expect(r.applied.map((e) => e.raw)).toEqual(["สาม"]);
  });

  it("lets an edit to the cell next door through while one is held", () => {
    const r = room();
    r.live.beginEdit("t1", 1, 1);
    r.wire.deliver(edit({ row: 1, col: 2, raw: "ข้าง ๆ" }));
    expect(r.applied.map((e) => e.raw)).toEqual(["ข้าง ๆ"]);
  });

  it("does nothing on a close with nothing held", () => {
    const r = room();
    r.live.beginEdit("t1", 1, 1);
    r.live.endEdit();
    r.live.endEdit();
    expect(r.applied).toHaveLength(0);
  });
});

describe("what this client puts on the wire", () => {
  it("stamps an edit with its own id and the clock", () => {
    const r = room({ t: 4_242 });
    r.live.localEdit("t1", 0, 0, "=SUM(A1:A3)");
    expect(r.wire.sent[0]).toEqual({
      kind: "cell",
      tabId: "t1",
      row: 0,
      col: 0,
      raw: "=SUM(A1:A3)",
      at: 4_242,
      from: "me000000",
    });
  });

  it("remembers its own edit, so a remote write from before it cannot undo it", () => {
    const r = room({ t: 8_000 });
    r.live.localEdit("t1", 1, 1, "ของเรา");
    r.wire.deliver(edit({ at: 7_000, raw: "เก่ากว่า" }));
    expect(r.applied).toHaveLength(0);
  });

  it("announces a structural change instead of the cell moves it implies", () => {
    const r = room();
    r.live.localStructureChange("t1");
    expect(r.wire.sent[0].kind).toBe("structure");
  });

  it("publishes the cursor through presence and as a message", () => {
    const r = room();
    r.live.moveCursor("t1", 4, 5);
    expect(r.wire.tracked[0]).toMatchObject({ id: "me000000", row: 4, col: 5 });
    expect(r.wire.sent[0].kind).toBe("cursor");
  });
});

describe("who else is here", () => {
  it("lists the others and leaves this client out of its own list", () => {
    const r = room();
    r.wire.presence([
      { id: "me000000", name: "สมชาย", tabId: "t1", row: 0, col: 0 },
      { id: THEM, name: "มานี", tabId: "t1", row: 2, col: 2 },
    ]);
    expect(r.people().map((p) => p.name)).toEqual(["มานี"]);
  });

  it("follows a cursor without waiting for presence to catch up", () => {
    const r = room();
    r.wire.deliver({ kind: "cursor", tabId: "t2", row: 7, col: 1, from: THEM, name: "มานี" });
    expect(r.people()[0]).toMatchObject({ tabId: "t2", row: 7, col: 1 });
  });

  it("keeps one entry per person however much they move", () => {
    const r = room();
    for (let i = 0; i < 5; i++) {
      r.wire.deliver({ kind: "cursor", tabId: "t1", row: i, col: 0, from: THEM, name: "มานี" });
    }
    expect(r.people()).toHaveLength(1);
    expect(r.people()[0].row).toBe(4);
  });
});

describe("leaving", () => {
  it("closes the transport and stops sending", () => {
    const r = room();
    r.live.close();
    r.live.localEdit("t1", 0, 0, "x");
    r.live.moveCursor("t1", 0, 0);
    expect(r.wire.isClosed()).toBe(true);
    expect(r.wire.sent).toHaveLength(0);
  });

  it("stops applying messages that arrive after the door shut", () => {
    const r = room();
    r.live.close();
    r.wire.deliver(edit());
    expect(r.applied).toHaveLength(0);
  });

  it("can be closed twice without complaining", () => {
    const r = room();
    r.live.close();
    r.live.close();
    expect(r.wire.isClosed()).toBe(true);
  });
});
