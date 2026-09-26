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
 * Neither is allowed to be slow or loud. A counter that adds latency to an export, or that turns a
 * dead database into a 500 on the page, has cost more than it is worth, so a failed write is
 * swallowed and the request still answers 204.
 *
 * Neither is allowed to be **silent**, either, and that half was missing. The first version caught
 * every error into an empty block and never looked at the response at all, so a write that landed,
 * a 401 from a key the host had not applied, and a 404 from a project that had never run the
 * migration were three different things that produced three identical non-events: no log line, no
 * error, a 204 to the browser, and an empty table. Working out which one it was took ten rounds of
 * reading deploy logs for a fact the function had known all along and thrown away. So the failure
 * now costs one `console.warn`, which is still not slow and still not fatal, and the line names the
 * event as well as the reason — a drain that wants the count back can have it from there.
 *
 * The caller `await`s this on purpose. Answering the browser first and writing after would shave a
 * round trip off a beacon nobody is waiting on, and on a serverless host it would also mean the
 * write races the freeze that follows the response: the fire-and-forget version of this function is
 * the version that sometimes does not write at all.
 */

const URL_ENV = process.env.USAGE_SUPABASE_URL?.trim() ?? "";
const KEY_ENV = process.env.USAGE_SUPABASE_KEY?.trim() ?? "";

export const hasSupabaseSink = (url = URL_ENV, key = KEY_ENV): boolean => url !== "" && key !== "";

/** The line the log sink writes. Parsed by a drain, so its shape is part of the contract. */
export const usageLogLine = (event: UsageEvent): string => `exceltogo.usage ${event}`;

/** The line a write that did not land writes. Same deal: a drain reads it, so the shape is fixed. */
export const usageFailureLine = (event: UsageEvent, reason: string): string =>
  `exceltogo.usage.failed ${event} ${reason}`;

/** What a reason is allowed to look like. Everything outside this is reported as `unknown`. */
const REASON = /^[A-Za-z0-9_]{1,32}$/;

/**
 * What a key has to look like before it is worth sending: printable ASCII, no whitespace.
 *
 * Found in production rather than in review. A key pasted into the host's dashboard with a line
 * break in the middle — or copied while it was displayed truncated, `…` and all — cannot be put in
 * an HTTP header, so `fetch` throws before a byte leaves the function. The log said `TypeError` and
 * "no outgoing requests", which is true and useless: the same error comes from a dozen causes, and
 * working out which one took reproducing each paste mistake against the real code by hand.
 *
 * The rule is what HTTP itself refuses plus whitespace, which no key has — not a guess at the
 * provider's format. Guessing the format (base64url and dots, say) would catch more, but a key
 * format that changes would then be refused with a confident, wrong `bad_key`, and a working
 * deployment would stop counting. Quotes and a `KEY=` prefix still get through here and come back
 * as `http_401`, which already names the fix. The key itself is never in the line.
 */
const KEY_SHAPE = /^[\x21-\x7E]+$/;

/**
 * One word for why the write did not land, and nothing else.
 *
 * Deliberately not the error's message. A `fetch` failure puts the host it could not reach in its
 * own, and an error thrown from further down carries whatever the thrower felt like putting there —
 * which, in the one function in this codebase that holds an API key, is not a string to pipe into a
 * log line on trust. A `code` (`ENOTFOUND`, `ECONNREFUSED`, `UND_ERR_CONNECT_TIMEOUT`) or a
 * constructor name is enough to act on and is shaped like a token, so anything not shaped like a
 * token is reported as `unknown` rather than printed. The test for this hands it an error whose
 * `code` is a connection string.
 */
export function failureReason(error: unknown): string {
  for (const level of [error, (error as { cause?: unknown })?.cause]) {
    const code = (level as { code?: unknown })?.code;
    if (typeof code === "string" && REASON.test(code)) return code;
  }
  const name = (error as { name?: unknown })?.name;
  return typeof name === "string" && REASON.test(name) ? name : "unknown";
}

export async function recordUsage(
  event: UsageEvent,
  deps: {
    url?: string;
    key?: string;
    fetch?: typeof fetch;
    log?: (line: string) => void;
    warn?: (line: string) => void;
  } = {}
): Promise<void> {
  if (!isUsageEvent(event)) return;
  const url = deps.url ?? URL_ENV;
  const key = deps.key ?? KEY_ENV;

  if (!hasSupabaseSink(url, key)) {
    (deps.log ?? console.log)(usageLogLine(event));
    return;
  }

  const send = deps.fetch ?? fetch;
  const complain = deps.warn ?? console.warn;
  if (!KEY_SHAPE.test(key)) {
    complain(usageFailureLine(event, "bad_key"));
    return;
  }
  try {
    const res = await send(`${url.replace(/\/$/, "")}/rest/v1/rpc/bump_usage`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}` },
      // The event and nothing else. The day is the database's own `current_date`, because a date
      // sent from here is a field somebody eventually makes more precise.
      body: JSON.stringify({ p_event: event }),
      cache: "no-store",
    });
    // The status, not the body: PostgREST puts the failing SQL in its error bodies, and a 401 or a
    // 404 is the whole of what there is to do something about anyway.
    if (!res.ok) complain(usageFailureLine(event, `http_${res.status}`));
  } catch (error) {
    complain(usageFailureLine(event, failureReason(error)));
  }
}
