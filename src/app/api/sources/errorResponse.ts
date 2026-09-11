import { RateLimitError } from "@/lib/dataSources/rateLimit";

/**
 * Turns a fetch failure into a response the browser can act on. A rate limit keeps its own status
 * and carries the wait, so the client can stop polling for exactly that long instead of showing
 * "HTTP 429" and hammering the source on its normal interval.
 */
export function fetchErrorResponse(err: unknown): Response {
  if (err instanceof RateLimitError) {
    return Response.json(
      { error: "rate_limited", retryAfterSec: err.retryAfterSec },
      { status: 429, headers: { "retry-after": String(err.retryAfterSec) } }
    );
  }
  return Response.json({ error: err instanceof Error ? err.message : "fetch_failed" }, { status: 502 });
}
