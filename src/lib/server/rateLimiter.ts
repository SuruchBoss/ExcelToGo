/**
 * A small fixed-window rate limiter for the one endpoint that is open to anybody.
 *
 * `/api/ai/formula` takes no token on purpose — the assistant is the app's own feature and asking
 * a visitor to authenticate to use it would be absurd. But with `ANTHROPIC_API_KEY` configured,
 * every call spends the operator's money, and without it every call still burns CPU. An open
 * endpoint with neither auth nor a ceiling is a standing invitation, and SECURITY.md has been
 * describing that as an accepted risk rather than fixing it.
 *
 * Fixed window rather than a token bucket because the failure it has to prevent is a script in a
 * loop, not a bursty-but-legitimate client, and a window is something an operator can reason about
 * from the logs: "twenty a minute from one address".
 *
 * **What it is not:** the counters live in this process's memory. Two instances behind a load
 * balancer count separately, and a serverless cold start forgets everything. That makes it a
 * guard against casual abuse and runaway loops, not a billing control — a real one needs shared
 * storage, which this project deliberately does not have. Saying so is the point; a limiter
 * described as more than it is would be worse than none.
 */

export interface RateLimitVerdict {
  allowed: boolean;
  /** Calls still available in the current window. Zero once the limit is reached. */
  remaining: number;
  /** Seconds until the window rolls over. Only meaningful when `allowed` is false. */
  retryAfterSec: number;
}

export interface RateLimiterOptions {
  /** Calls permitted per key per window. */
  limit: number;
  windowMs: number;
  /** Injectable so tests can move time without waiting for it. */
  now?: () => number;
  /**
   * How many distinct keys to track before old windows are swept. A cap matters because the key is
   * a client-supplied address: without one, a spray of forged `x-forwarded-for` values would grow
   * the map until the process ran out of memory — turning a rate limiter into the denial of
   * service it exists to prevent.
   */
  maxKeys?: number;
}

interface Window {
  count: number;
  /** When the current window ends, in ms. */
  resetAt: number;
}

export interface RateLimiter {
  check(key: string): RateLimitVerdict;
  /** Number of keys currently held. Exposed for the tests that pin the sweep. */
  size(): number;
}

export function createRateLimiter({ limit, windowMs, now = Date.now, maxKeys = 10_000 }: RateLimiterOptions): RateLimiter {
  const windows = new Map<string, Window>();

  /** Drops windows that have already expired; only runs when the map is at its cap. */
  function sweep(at: number): void {
    for (const [key, win] of windows) {
      if (win.resetAt <= at) windows.delete(key);
    }
    // Everything still live and still over the cap: give up the oldest-inserted entries, which Map
    // yields first. Evicting an active window lets that caller start fresh, which is the safe way
    // to be wrong — the alternative is unbounded growth.
    if (windows.size >= maxKeys) {
      for (const key of windows.keys()) {
        windows.delete(key);
        if (windows.size < maxKeys) break;
      }
    }
  }

  return {
    check(key: string): RateLimitVerdict {
      const at = now();
      const existing = windows.get(key);

      if (!existing || existing.resetAt <= at) {
        if (windows.size >= maxKeys) sweep(at);
        windows.set(key, { count: 1, resetAt: at + windowMs });
        return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
      }

      if (existing.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - at) / 1000)),
        };
      }

      existing.count += 1;
      return { allowed: true, remaining: limit - existing.count, retryAfterSec: 0 };
    },
    size: () => windows.size,
  };
}

/**
 * The caller's address, as well as it can be known behind a proxy.
 *
 * `x-forwarded-for` is a list the proxies append to, so the *first* entry is the original client.
 * It is trivially forged by the client, which is why the key is only ever used for counting and
 * never for authorisation, and why the limiter caps how many distinct keys it will hold.
 *
 * Everything unattributable shares one bucket rather than getting a free pass each: a request with
 * no forwarding headers at all is either a direct local call or something trying to dodge the
 * count, and neither deserves its own allowance.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || "unattributed";
}
