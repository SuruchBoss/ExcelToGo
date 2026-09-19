import { describe, expect, it } from "vitest";
import { channelName, readPresence } from "./realtimeChannel";

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
