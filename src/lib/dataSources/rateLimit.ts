/**
 * Reading "you're calling me too often" out of an HTTP response, and deciding how long to wait.
 *
 * Two things go wrong without this. The user sees `HTTP 429 Too Many Requests`, which tells a
 * non-technical person nothing they can act on. And the poller keeps firing on its normal interval,
 * so a source that asked for a break gets hit harder — the one response guaranteed to keep it
 * broken. Everything here is pure so both the server fetch loop and the client poller can share
 * the same rules.
 */

/** Longest wait we'll ever schedule. Past this, a source is effectively paused until a manual refresh. */
export const MAX_BACKOFF_SEC = 15 * 60;
/** Used when a response says "slow down" without saying for how long. */
export const DEFAULT_RETRY_AFTER_SEC = 60;

export interface RateLimitInfo {
  /** Seconds to wait before trying again. */
  retryAfterSec: number;
  /** Where the number came from — the UI words itself differently for a guess. */
  source: "retry-after" | "reset-header" | "default";
}

function clampSec(v: number): number {
  return Math.min(Math.max(Math.ceil(v), 1), MAX_BACKOFF_SEC);
}

/**
 * Parses a `Retry-After` value, which is either a number of seconds ("120") or an HTTP date
 * ("Wed, 21 Oct 2015 07:28:00 GMT"). Returns null when it's neither, or when the date is past.
 */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return clampSec(Number(trimmed));
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  const sec = (at - now) / 1000;
  return sec <= 0 ? null : clampSec(sec);
}

/**
 * Parses the `X-RateLimit-Reset` family, which is maddeningly inconsistent: GitHub sends an epoch
 * in seconds, some APIs send epoch milliseconds, others send seconds-from-now. Told apart by
 * magnitude rather than by trusting any one convention.
 */
export function parseResetHeader(value: string | null | undefined, now = Date.now()): number | null {
  if (!value || !/^\d+(\.\d+)?$/.test(value.trim())) return null;
  const n = Number(value.trim());
  const nowSec = now / 1000;
  // Epoch milliseconds (year ~2001 onwards as ms).
  if (n > 1e12) return clampSec((n - now) / 1000);
  // Epoch seconds.
  if (n > 1e9) return clampSec(n - nowSec);
  // Anything smaller is a plain duration in seconds.
  return clampSec(n);
}

/** Headers we can read a wait out of, cheapest signal first. */
const RESET_HEADERS = ["x-ratelimit-reset", "ratelimit-reset", "x-rate-limit-reset"];

/**
 * Decides whether a response is a rate-limit refusal, and for how long.
 *
 * 429 is the honest answer. A 403 only counts when a rate-limit header says the remaining quota is
 * zero — GitHub answers that way, and treating every 403 as a rate limit would misreport a plain
 * permission error as "try again later", which would leave the user waiting on something that will
 * never fix itself.
 */
export function readRateLimit(
  status: number,
  headers: { get(name: string): string | null },
  now = Date.now()
): RateLimitInfo | null {
  const remaining = headers.get("x-ratelimit-remaining") ?? headers.get("ratelimit-remaining");
  const quotaExhausted = remaining !== null && /^0+$/.test(remaining.trim());
  if (status !== 429 && !(status === 403 && quotaExhausted)) return null;

  const fromRetryAfter = parseRetryAfter(headers.get("retry-after"), now);
  if (fromRetryAfter !== null) return { retryAfterSec: fromRetryAfter, source: "retry-after" };

  for (const name of RESET_HEADERS) {
    const fromReset = parseResetHeader(headers.get(name), now);
    if (fromReset !== null) return { retryAfterSec: fromReset, source: "reset-header" };
  }
  return { retryAfterSec: DEFAULT_RETRY_AFTER_SEC, source: "default" };
}

/** Thrown by the fetch layer so the API route can answer with a real 429 instead of a generic 502. */
export class RateLimitError extends Error {
  readonly retryAfterSec: number;
  constructor(info: RateLimitInfo) {
    super(`rate_limited:${info.retryAfterSec}`);
    this.name = "RateLimitError";
    this.retryAfterSec = info.retryAfterSec;
  }
}

/**
 * How long to wait after `failures` consecutive ordinary failures (a 500, a dropped connection).
 * Doubles from the source's own interval and stops at MAX_BACKOFF_SEC, so a source that's simply
 * down stops being polled every few seconds forever.
 */
export function backoffSec(refreshSec: number, failures: number): number {
  if (failures <= 1) return Math.max(1, refreshSec);
  return clampSec(Math.max(1, refreshSec) * 2 ** Math.min(failures - 1, 10));
}
