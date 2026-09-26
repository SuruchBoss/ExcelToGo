// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rateLimiter";

/** A limiter whose clock the test drives by hand. */
function atClock(limit = 3, windowMs = 1000, maxKeys?: number) {
  let time = 1_000_000;
  const limiter = createRateLimiter({ limit, windowMs, now: () => time, maxKeys });
  return { limiter, advance: (ms: number) => (time += ms), at: () => time };
}

describe("createRateLimiter", () => {
  it("allows up to the limit and then refuses", () => {
    const { limiter } = atClock(3, 1000);
    expect(limiter.check("a")).toMatchObject({ allowed: true, remaining: 2 });
    expect(limiter.check("a")).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check("a")).toMatchObject({ allowed: true, remaining: 0 });

    const refused = limiter.check("a");
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.retryAfterSec).toBeGreaterThan(0);
  });

  it("counts each key separately", () => {
    const { limiter } = atClock(1, 1000);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true); // b is not punished for a
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("lets a caller back in once the window rolls over", () => {
    const { limiter, advance } = atClock(2, 1000);
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    advance(1001);
    expect(limiter.check("a")).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("reports a retry-after that shrinks as the window runs out", () => {
    const { limiter, advance } = atClock(1, 10_000);
    limiter.check("a");
    expect(limiter.check("a").retryAfterSec).toBe(10);
    advance(7000);
    expect(limiter.check("a").retryAfterSec).toBe(3);
  });

  it("never reports a retry-after of zero while still refusing", () => {
    // A caller told to wait 0 seconds would retry immediately and spin.
    const { limiter, advance } = atClock(1, 1000);
    limiter.check("a");
    advance(999);
    const v = limiter.check("a");
    expect(v.allowed).toBe(false);
    expect(v.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  // A forged x-forwarded-for is one header away, so the map must not grow without bound —
  // otherwise the limiter becomes the denial of service it is there to stop.
  it("keeps the key map bounded when flooded with distinct keys", () => {
    const { limiter } = atClock(5, 1000, 50);
    for (let i = 0; i < 5000; i++) limiter.check(`ip-${i}`);
    expect(limiter.size()).toBeLessThanOrEqual(50);
  });

  it("sweeps expired windows rather than live ones when it can", () => {
    const { limiter, advance } = atClock(5, 1000, 10);
    for (let i = 0; i < 9; i++) limiter.check(`old-${i}`);
    advance(1001); // every window above has now expired
    for (let i = 0; i < 9; i++) limiter.check(`new-${i}`);
    expect(limiter.size()).toBeLessThanOrEqual(10);
    // A fresh caller is still served normally after the sweep.
    expect(limiter.check("someone-else").allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("takes the original client from the front of x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" });
    expect(clientKey(h)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(clientKey(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("puts everything unattributable in one bucket rather than letting it through", () => {
    expect(clientKey(new Headers())).toBe("unattributed");
    expect(clientKey(new Headers({ "x-forwarded-for": "   " }))).toBe("unattributed");
  });
});
