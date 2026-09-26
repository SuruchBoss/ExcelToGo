// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Counting that somebody used the app, without learning anything about them.
 *
 * The question this answers is the smallest useful one — **has anyone actually used this, or am I
 * looking at my own visits?** — and it is at odds with the sentence the landing page leads with, so
 * the shape is the argument. Five decisions, each of which closes off a way this could become
 * something else:
 *
 * 1. **Off unless a deployment switches it on.** `NEXT_PUBLIC_USAGE=1` and nothing else. A fork
 *    that clones this repo sends nothing, ever, and there is no default endpoint to forget to
 *    unset. The gate is checked again on the server, so a post to a deployment that said no is
 *    refused rather than quietly recorded.
 * 2. **The event name is the entire payload, and it comes from a fixed list.** Not free text, and
 *    this is the load-bearing one: the policy already allows the page to talk to its own origin,
 *    so a free-text field here would be a ready-made way for a bug — or an injected script — to
 *    post a cell's contents somewhere and have it look like telemetry. A closed union cannot carry
 *    a spreadsheet. The same list is checked again in the route and a third time in SQL.
 * 3. **At most once per event per page load.** Held in memory, not in storage, so there is no id
 *    to persist and nothing to correlate across visits. It also changes what is being measured,
 *    on purpose: *did this happen at all*, not *how many times* — a per-keystroke counter is a
 *    behavioural trace wearing a number's clothes.
 * 4. **No time of day, no IP, no user agent, no referrer, no cookie, no session.** The day is
 *    stamped by the database, not sent from here: a client-supplied date is a field somebody will
 *    eventually make more precise. What is stored is `(day, event) → count`, which is a number
 *    that cannot be narrowed to a person even by whoever owns the database.
 * 5. **Do Not Track and Global Privacy Control are honoured**, because an app whose whole argument
 *    is "we do not take your data" does not get to ignore the browser saying the same thing.
 *
 * What this cannot tell you, stated so nobody reads more into a chart than is in it: how many
 * *people* (two visits from one person and one each from two are the same number), whether anyone
 * came back, where they came from, or anything at all about one visit.
 */

/**
 * Everything that may be counted.
 *
 * Chosen to separate "looked", "opened it" and "used it", which is the distinction the whole feature
 * exists for: `landing_viewed` and `app_opened` are page loads, and every other one takes a
 * deliberate act. The landing page is counted apart from the app because they answer different
 * questions — how many people the link reached, and how many of them went on to try the thing.
 */
export const USAGE_EVENTS = [
  "landing_viewed",
  "app_opened",
  "formula_entered",
  "file_imported",
  "file_exported",
  "ai_asked",
  "live_data_inserted",
] as const;

export type UsageEvent = (typeof USAGE_EVENTS)[number];

/** Where the browser posts. Same origin, so `connect-src 'self'` already allows it and no policy
 *  had to be widened to add this. */
export const USAGE_PATH = "/api/usage";

export const isUsageEnabled = (flag = process.env.NEXT_PUBLIC_USAGE): boolean => flag === "1";

/** Narrowing for the route, which is handed whatever the network sent it. */
export function isUsageEvent(value: unknown): value is UsageEvent {
  return typeof value === "string" && (USAGE_EVENTS as readonly string[]).includes(value);
}

/**
 * The browser asking not to be counted, in either of the two ways it can.
 *
 * `doNotTrack` is the old header-era flag and `globalPrivacyControl` the one that replaced it;
 * both are read because browsers ship them in different combinations and honouring only the one
 * that happens to be missing is the same as honouring neither.
 */
export function optedOut(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean } | undefined): boolean {
  if (!nav) return false;
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/**
 * Which events this page load has already counted.
 *
 * Module state rather than `sessionStorage`: writing it down would create exactly the identifier
 * this feature is built not to have, and a reload counting one more `app_opened` is a rounding
 * error next to that.
 */
const sent = new Set<UsageEvent>();

/** Test seam — the set above is module state, and a test that counts posts needs it empty. */
export function resetUsage(): void {
  sent.clear();
}

export interface UsageDeps {
  enabled?: boolean;
  navigator?: { doNotTrack?: string | null; globalPrivacyControl?: boolean; sendBeacon?: (url: string, data?: BodyInit) => boolean };
  fetch?: typeof fetch;
}

/**
 * Counts one event, or — far more often — does nothing.
 *
 * Returns whether anything went out, which is what the tests assert on; nothing in the app looks
 * at it. Every failure is swallowed: a counter that can break the app it is counting is worse than
 * no counter, and this one runs on the path where somebody is exporting their work.
 */
export function countUsage(event: UsageEvent, deps: UsageDeps = {}): boolean {
  const enabled = deps.enabled ?? isUsageEnabled();
  const nav = deps.navigator ?? (typeof navigator === "undefined" ? undefined : navigator);
  if (!enabled || !isUsageEvent(event) || sent.has(event) || optedOut(nav)) return false;
  // Marked before the send, not after: a failed post must not turn into a retry on the next
  // keystroke, because "how many times did this fail" is traffic nobody asked for either.
  sent.add(event);

  const body = JSON.stringify({ event });
  try {
    // `sendBeacon` for the same reason the crash reporter uses it: `file_exported` fires as a
    // download starts, and a fetch in flight when the page goes away is a count that never arrives.
    if (typeof nav?.sendBeacon === "function") {
      return nav.sendBeacon(USAGE_PATH, new Blob([body], { type: "application/json" }));
    }
    const send = deps.fetch ?? (typeof fetch === "undefined" ? undefined : fetch);
    if (!send) return false;
    void send(USAGE_PATH, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
    return true;
  } catch {
    return false;
  }
}
