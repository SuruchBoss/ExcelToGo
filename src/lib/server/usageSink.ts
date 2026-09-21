import { isUsageEvent, type UsageEvent } from "@/lib/usage";

/**
 * Where a counted event ends up.
 *
 * Two sinks, because the useful answer depends on what the deployment already has and neither
 * should be a new dependency:
 *
 * - **A Supabase project**, if one is configured for this. It calls one function, `bump_usage`,
 *   which is the only thing the key can do: the table itself has row-level security on with no
 *   policy at all, so the same key cannot read a single row back. Over `fetch` rather than the
 *   Supabase client so that the client's chunk stays a thing only the cloud feature loads — a
 *   `check:e2e` flow asserts no ordinary page load asks for it, and importing it here would not
 *   break that flow while still being the wrong shape.
 * - **A line in the log**, otherwise. Not a fallback that pretends to be storage: it is one
 *   structured line that any log drain can count, and on a host that keeps logs for an hour it is
 *   worth exactly that much. Said plainly in the README rather than left to be discovered.
 *
 * Neither is allowed to be slow or loud. The browser is told the count was accepted as soon as the
 * shape is valid, and the write happens after; a counter that adds latency to an export, or that
 * turns a dead database into a 500 on the page, has cost more than it is worth.
 */

const URL_ENV = process.env.USAGE_SUPABASE_URL?.trim() ?? "";
const KEY_ENV = process.env.USAGE_SUPABASE_KEY?.trim() ?? "";

export const hasSupabaseSink = (url = URL_ENV, key = KEY_ENV): boolean => url !== "" && key !== "";

/** The line the log sink writes. Parsed by a drain, so its shape is part of the contract. */
export const usageLogLine = (event: UsageEvent): string => `exceltogo.usage ${event}`;

export async function recordUsage(
  event: UsageEvent,
  deps: { url?: string; key?: string; fetch?: typeof fetch; log?: (line: string) => void } = {}
): Promise<void> {
  if (!isUsageEvent(event)) return;
  const url = deps.url ?? URL_ENV;
  const key = deps.key ?? KEY_ENV;

  if (!hasSupabaseSink(url, key)) {
    (deps.log ?? console.log)(usageLogLine(event));
    return;
  }

  const send = deps.fetch ?? fetch;
  try {
    await send(`${url.replace(/\/$/, "")}/rest/v1/rpc/bump_usage`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}` },
      // The event and nothing else. The day is the database's own `current_date`, because a date
      // sent from here is a field somebody eventually makes more precise.
      body: JSON.stringify({ p_event: event }),
      cache: "no-store",
    });
  } catch {
    // A counter that can break the thing it counts is worse than no counter.
  }
}
