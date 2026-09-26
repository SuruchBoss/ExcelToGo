// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";
import { countUsage, isUsageEnabled, isUsageEvent, optedOut, resetUsage, USAGE_EVENTS, USAGE_PATH } from "./usage";

/**
 * A counter in an app whose whole argument is that it does not take your data.
 *
 * These are counted as security tests, and that is not a stretch: the page is already allowed to
 * talk to its own origin, so the thing standing between this beacon and an exfiltration channel is
 * the closed list of event names. Most of what follows is about what does *not* go out.
 */
const beacon = () => {
  const sent: { url: string; body: string }[] = [];
  return {
    sent,
    nav: {
      sendBeacon: (url: string, data?: BodyInit) => {
        sent.push({ url, body: String(data instanceof Blob ? "[blob]" : data) });
        return true;
      },
    },
  };
};

beforeEach(resetUsage);

describe("when nothing is sent at all", () => {
  it("sends nothing unless the deployment switched it on", () => {
    // The default a reader of this repo gets. There is no endpoint to forget to unset.
    const b = beacon();
    expect(countUsage("app_opened", { enabled: false, navigator: b.nav })).toBe(false);
    expect(b.sent).toHaveLength(0);
  });

  it("honours Do Not Track and Global Privacy Control", () => {
    const b = beacon();
    expect(countUsage("app_opened", { enabled: true, navigator: { ...b.nav, doNotTrack: "1" } })).toBe(false);
    resetUsage();
    expect(countUsage("app_opened", { enabled: true, navigator: { ...b.nav, globalPrivacyControl: true } })).toBe(false);
    expect(b.sent).toHaveLength(0);
  });

  it("reads both flags, because browsers ship them in different combinations", () => {
    expect(optedOut({ doNotTrack: "1" })).toBe(true);
    expect(optedOut({ globalPrivacyControl: true })).toBe(true);
    expect(optedOut({ doNotTrack: "0" })).toBe(false);
    expect(optedOut(undefined)).toBe(false);
  });

  it("counts an event at most once per page load", () => {
    // What is being measured is "did this happen at all". A per-keystroke counter would be a
    // behavioural trace wearing a number's clothes.
    const b = beacon();
    expect(countUsage("formula_entered", { enabled: true, navigator: b.nav })).toBe(true);
    expect(countUsage("formula_entered", { enabled: true, navigator: b.nav })).toBe(false);
    expect(countUsage("formula_entered", { enabled: true, navigator: b.nav })).toBe(false);
    expect(b.sent).toHaveLength(1);
  });

  it("does not retry one that failed to go", () => {
    // "How many times did the beacon fail" is traffic nobody asked for either.
    const nav = { sendBeacon: () => false };
    expect(countUsage("app_opened", { enabled: true, navigator: nav })).toBe(false);
    expect(countUsage("app_opened", { enabled: true, navigator: { sendBeacon: () => true } })).toBe(false);
  });

  it("swallows a browser that throws rather than breaking the page it is counting", () => {
    const nav = {
      sendBeacon: () => {
        throw new Error("blocked by an extension");
      },
    };
    expect(() => countUsage("file_exported", { enabled: true, navigator: nav })).not.toThrow();
  });
});

describe("what a counted event actually contains", () => {
  it("is the event name and nothing else", () => {
    const sent: string[] = [];
    const fetchSpy = vi.fn((_url: string, init?: RequestInit) => {
      sent.push(String(init?.body));
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    countUsage("ai_asked", { enabled: true, navigator: {}, fetch: fetchSpy as unknown as typeof fetch });

    expect(sent).toEqual(['{"event":"ai_asked"}']);
    // No day, no time, no id, no session — the day is stamped by the database precisely so that a
    // field here cannot become more precise later.
    const body = JSON.parse(sent[0]);
    expect(Object.keys(body)).toEqual(["event"]);
  });

  it("goes to this app's own origin, so no policy had to be widened for it", () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    countUsage("app_opened", { enabled: true, navigator: {}, fetch: fetchSpy as unknown as typeof fetch });
    expect(fetchSpy).toHaveBeenCalledWith(USAGE_PATH, expect.anything());
    expect(USAGE_PATH.startsWith("/")).toBe(true);
  });

  it("refuses a name that is not on the list", () => {
    const b = beacon();
    // The closed list is what keeps a cell's contents from travelling as telemetry.
    expect(countUsage("=SUM(เงินเดือน)" as never, { enabled: true, navigator: b.nav })).toBe(false);
    expect(countUsage("" as never, { enabled: true, navigator: b.nav })).toBe(false);
    expect(b.sent).toHaveLength(0);
  });

  it("keeps the list to events, not to a description of what somebody did", () => {
    // A list that grew a "what they typed" or a "which cell" would be the same mistake with more
    // steps, so its shape is asserted rather than trusted.
    for (const event of USAGE_EVENTS) expect(event).toMatch(/^[a-z][a-z_]{2,24}$/);
    expect(new Set(USAGE_EVENTS).size).toBe(USAGE_EVENTS.length);
  });
});

describe("the two narrowings the route also depends on", () => {
  it("recognises exactly the listed events", () => {
    for (const event of USAGE_EVENTS) expect(isUsageEvent(event)).toBe(true);
    for (const junk of ["", "APP_OPENED", "app_opened ", 1, null, {}, ["app_opened"]]) {
      expect(isUsageEvent(junk)).toBe(false);
    }
  });

  it("treats anything but the exact flag as off", () => {
    expect(isUsageEnabled("1")).toBe(true);
    for (const off of ["", "0", "true", "yes", undefined]) expect(isUsageEnabled(off)).toBe(false);
  });
});
