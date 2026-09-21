import { isUsageEnabled, isUsageEvent } from "@/lib/usage";
import { recordUsage } from "@/lib/server/usageSink";

export const runtime = "nodejs";

/**
 * Takes one event name and counts it. Takes nothing else, on purpose.
 *
 * The request carries an IP, a user agent and a referrer whether anybody wants them or not — that
 * is what an HTTP request is. What matters is that none of them are read here, and that the only
 * thing that reaches storage is a name from a fixed list. Checking the list again, after the
 * browser already checked it, is the point rather than belt and braces: the browser's copy is a
 * convenience, and this is the one a stranger with `curl` has to get past.
 *
 * Answering 204 either way is deliberate. A response that distinguished "counted" from "not a
 * known event" would tell a prober which names exist, and the browser has no use for the
 * difference — it is a beacon, and it is not listening.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isUsageEnabled()) return new Response(null, { status: 204 });

  let event: unknown;
  try {
    // `slice` before parsing: a beacon body is two dozen bytes, and reading an unbounded one from
    // an unauthenticated endpoint is a way to be kept busy.
    const text = (await request.text()).slice(0, 200);
    event = (JSON.parse(text) as { event?: unknown }).event;
  } catch {
    return new Response(null, { status: 204 });
  }

  if (isUsageEvent(event)) await recordUsage(event);
  return new Response(null, { status: 204 });
}
