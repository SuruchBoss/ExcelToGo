import { describe, expect, it } from "vitest";
import { MAX_RAW_LENGTH, parseLiveMessage } from "./liveSession";

/**
 * Everything that arrives on a live channel is input, not data.
 *
 * The channel is joined with the anon key, which every visitor to a deployment with cloud turned
 * on is holding. So a message is not something a colleague sent; it is something *somebody* sent,
 * and the difference is the whole reason this file exists. A `row` of `-1` reaches an array index,
 * a `raw` that is not a string reaches the formula engine, and a megabyte in one cell is not an
 * edit at all.
 */
const THEM = "them0000";

describe("a message from another browser is not trusted", () => {
  const good = { kind: "cell", tabId: "t1", row: 1, col: 2, raw: "45", at: 5, from: THEM };

  it("accepts each of the three kinds when they are well formed", () => {
    expect(parseLiveMessage(good)).toEqual(good);
    expect(parseLiveMessage({ kind: "structure", tabId: "t1", at: 5, from: THEM })).toBeTruthy();
    expect(parseLiveMessage({ kind: "cursor", tabId: "t1", row: 0, col: 0, from: THEM, name: "มานี" })).toBeTruthy();
  });

  it("refuses a row or column that is not a usable index", () => {
    // A `-1` here reaches an array index; a fractional one reaches it and misses.
    for (const row of [-1, 1.5, NaN, Infinity, "3", null, 2_000_000]) {
      expect(parseLiveMessage({ ...good, row })).toBeNull();
    }
  });

  it("refuses a value that is not a string, which the formula engine would choke on", () => {
    for (const value of [42, null, { toString: () => "=SUM(A1)" }, ["x"]]) {
      expect(parseLiveMessage({ ...good, raw: value })).toBeNull();
    }
  });

  it("refuses a cell value far larger than a cell, which is a payload and not an edit", () => {
    expect(parseLiveMessage({ ...good, raw: "ก".repeat(MAX_RAW_LENGTH) })).toBeTruthy();
    expect(parseLiveMessage({ ...good, raw: "ก".repeat(MAX_RAW_LENGTH + 1) })).toBeNull();
  });

  it("trims a display name rather than letting it push the others off the screen", () => {
    const long = parseLiveMessage({ kind: "cursor", tabId: "t1", row: 0, col: 0, from: THEM, name: "ก".repeat(500) });
    expect((long as { name: string }).name.length).toBeLessThanOrEqual(40);
  });

  it("refuses anything that is not one of the three kinds", () => {
    for (const junk of [null, undefined, 7, "cell", [], {}, { ...good, kind: "delete-everything" }]) {
      expect(parseLiveMessage(junk)).toBeNull();
    }
  });

  it("refuses a missing or oversized identifier", () => {
    expect(parseLiveMessage({ ...good, tabId: "" })).toBeNull();
    expect(parseLiveMessage({ ...good, from: "x".repeat(65) })).toBeNull();
  });
});
