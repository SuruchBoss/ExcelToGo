// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { CRASH_TEST_KEY, crashTestAsked } from "./crashTest";

/** The crash the gates use to reach the rescue screen (#145) is never a switch a person can hit. */
describe("the crash test", () => {
  const asking = { getItem: (key: string) => (key === CRASH_TEST_KEY ? "1" : null) };
  const quiet = { getItem: () => null };

  it("crashes only a browser driven by automation that asked for it", () => {
    expect(crashTestAsked({ webdriver: true }, asking)).toBe(true);
  });

  it("never crashes a browser a person uses, whatever its storage holds", () => {
    expect(crashTestAsked({ webdriver: false }, asking)).toBe(false);
    expect(crashTestAsked({}, asking)).toBe(false);
    expect(crashTestAsked(undefined, asking)).toBe(false);
  });

  it("does nothing in an automated browser that did not ask", () => {
    expect(crashTestAsked({ webdriver: true }, quiet)).toBe(false);
    expect(crashTestAsked({ webdriver: true }, undefined)).toBe(false);
  });

  it("does nothing when storage refuses to be read", () => {
    const refusing = { getItem: () => { throw new Error("SecurityError"); } };
    expect(crashTestAsked({ webdriver: true }, refusing)).toBe(false);
  });
});
