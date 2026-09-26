// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CHANNEL_PREFIX, channelName, readPresence } from "./realtimeChannel";

/**
 * Only the pure part of the adapter is tested here, and that is the point: everything else in that
 * file carries bytes and decides nothing. This function is the exception, and it is exactly where
 * the feature broke first — presence tracks a `Participant`, whose sender field is `id`, while the
 * validator speaks messages, whose sender field is `from`. The mismatch produced no error and no
 * warning. It produced "nobody else is here", for ever.
 */
describe("reading who is on the channel", () => {
  const person = { id: "abc123", name: "มานี", tabId: "t1", row: 3, col: 4 };

  it("turns tracked presence into participants", () => {
    expect(readPresence({ abc123: [person] })).toEqual([person]);
  });

  it("takes the latest state a key has tracked, not the first", () => {
    expect(readPresence({ abc123: [person, { ...person, row: 9 }] })[0].row).toBe(9);
  });

  it("drops an entry that is not a participant rather than rendering a hole", () => {
    expect(readPresence({ a: [], b: [null], c: [{ id: "x" }], d: [{ ...person, row: -1 }] })).toEqual([]);
  });

  it("keeps the good entries when one of them is junk", () => {
    expect(readPresence({ a: [{ nonsense: true }], b: [person] }).map((p) => p.id)).toEqual(["abc123"]);
  });
});

describe("which channel a workbook uses", () => {
  it("is derived from the row id, which is already unique", () => {
    expect(channelName("9f3c")).toBe("workbook:9f3c");
    expect(channelName("a")).not.toBe(channelName("b"));
  });
});

describe("the topic name and the policy that reads it", () => {
  // `channelName()` builds a string; a policy in `0002_sharing_and_realtime.sql` takes that same
  // string apart to decide who may join. Nothing in TypeScript can see the SQL, and nothing in the
  // SQL can see the TypeScript, so the only thing holding them together is this test. A drift here
  // fails closed — a topic the policy cannot parse is one nobody may subscribe to — which means it
  // would look like "live editing stopped working" rather than like a format change.
  const sql = readFileSync(new URL("../../../supabase/migrations/0002_sharing_and_realtime.sql", import.meta.url), "utf8");

  it("uses the prefix the policy checks for", () => {
    expect(CHANNEL_PREFIX).toBe("workbook:");
    expect(sql).toContain(`<> '${CHANNEL_PREFIX}'`);
  });

  it("counts the prefix's characters the same on both sides", () => {
    // `left(topic, 9)` and a nine-character prefix. Off by one and every topic is refused.
    expect(sql).toContain(`left(topic, ${CHANNEL_PREFIX.length}) <>`);
  });

  it("splits on the separator the name actually contains", () => {
    const [prefix, id] = channelName("9f3c").split(":");
    expect(`${prefix}:`).toBe(CHANNEL_PREFIX);
    expect(id).toBe("9f3c");
    expect(sql).toContain("split_part(topic, ':', 2)");
  });

  it("opens the topic as private, or the policy is never consulted at all", () => {
    // The one failure mode with no symptom: a public topic works perfectly and authorises nobody.
    const source = readFileSync(new URL("./realtimeChannel.ts", import.meta.url), "utf8");
    expect(source).toContain("private: true");
    expect(source).toContain("setAuth()");
  });
});
