import { describe, expect, it } from "vitest";
import { backoffSec, DEFAULT_RETRY_AFTER_SEC, MAX_BACKOFF_SEC, parseResetHeader, parseRetryAfter, readRateLimit } from "./rateLimit";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

function headers(h: Record<string, string>) {
  return { get: (n: string) => h[n.toLowerCase()] ?? null };
}

describe("parseRetryAfter", () => {
  it("reads a plain number of seconds", () => {
    expect(parseRetryAfter("120", NOW)).toBe(120);
  });

  it("reads an HTTP date as the seconds until then", () => {
    expect(parseRetryAfter(new Date(NOW + 90_000).toUTCString(), NOW)).toBe(90);
  });

  it("ignores a date that has already passed", () => {
    expect(parseRetryAfter(new Date(NOW - 5_000).toUTCString(), NOW)).toBeNull();
  });

  it("ignores a missing or unparseable value", () => {
    expect(parseRetryAfter(null, NOW)).toBeNull();
    expect(parseRetryAfter("soon", NOW)).toBeNull();
  });

  it("caps an absurd wait instead of parking the source for a day", () => {
    expect(parseRetryAfter("999999", NOW)).toBe(MAX_BACKOFF_SEC);
  });
});

describe("parseResetHeader", () => {
  it("reads epoch seconds", () => {
    expect(parseResetHeader(String(Math.floor(NOW / 1000) + 300), NOW)).toBe(300);
  });

  it("reads epoch milliseconds", () => {
    expect(parseResetHeader(String(NOW + 45_000), NOW)).toBe(45);
  });

  it("reads a small number as a plain duration", () => {
    expect(parseResetHeader("30", NOW)).toBe(30);
  });

  it("ignores non-numeric values", () => {
    expect(parseResetHeader("later", NOW)).toBeNull();
    expect(parseResetHeader(null, NOW)).toBeNull();
  });
});

describe("readRateLimit", () => {
  it("treats 429 as rate limited and prefers Retry-After", () => {
    const info = readRateLimit(429, headers({ "retry-after": "45", "x-ratelimit-reset": "999" }), NOW);
    expect(info).toEqual({ retryAfterSec: 45, source: "retry-after" });
  });

  it("falls back to a reset header when there's no Retry-After", () => {
    const info = readRateLimit(429, headers({ "x-ratelimit-reset": String(Math.floor(NOW / 1000) + 120) }), NOW);
    expect(info).toEqual({ retryAfterSec: 120, source: "reset-header" });
  });

  it("still reports a wait when the response gives no numbers at all", () => {
    expect(readRateLimit(429, headers({}), NOW)).toEqual({ retryAfterSec: DEFAULT_RETRY_AFTER_SEC, source: "default" });
  });

  it("counts a 403 only when a rate-limit header says the quota is spent", () => {
    expect(readRateLimit(403, headers({ "x-ratelimit-remaining": "0", "retry-after": "60" }), NOW)?.retryAfterSec).toBe(60);
    expect(readRateLimit(403, headers({ "x-ratelimit-remaining": "12" }), NOW)).toBeNull();
  });

  it("leaves a plain 403 as a permission error, not something to wait out", () => {
    expect(readRateLimit(403, headers({}), NOW)).toBeNull();
  });

  it("ignores healthy responses and other failures", () => {
    expect(readRateLimit(200, headers({ "retry-after": "60" }), NOW)).toBeNull();
    expect(readRateLimit(500, headers({}), NOW)).toBeNull();
  });

  it("accepts the un-prefixed RateLimit-* spelling too", () => {
    expect(readRateLimit(429, headers({ "ratelimit-reset": "20" }), NOW)?.retryAfterSec).toBe(20);
  });
});

describe("backoffSec", () => {
  it("uses the source's own interval on a first failure", () => {
    expect(backoffSec(30, 1)).toBe(30);
  });

  it("doubles with each consecutive failure", () => {
    expect(backoffSec(30, 2)).toBe(60);
    expect(backoffSec(30, 3)).toBe(120);
    expect(backoffSec(30, 4)).toBe(240);
  });

  it("stops growing at the cap", () => {
    expect(backoffSec(30, 20)).toBe(MAX_BACKOFF_SEC);
  });

  it("never returns zero for a sub-second interval", () => {
    expect(backoffSec(0, 1)).toBe(1);
    expect(backoffSec(0, 3)).toBe(4);
  });
});
