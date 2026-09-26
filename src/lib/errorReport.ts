// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Telling the operator that the app crashed, without telling them what was in the spreadsheet.
 *
 * The crash screen already does the important half: it gets the user's work back out as CSV. What
 * it never did was tell whoever deployed the app that it happened, so a bug that only fires on one
 * imported file could run for months with nobody knowing.
 *
 * Which puts this feature at odds with the one thing the whole app promises — your file never
 * leaves the browser. So the shape here is deliberate and the README says the same words:
 *
 * - **Off unless somebody turns it on.** No URL configured, nothing is sent, and there is no
 *   default endpoint to forget to unset. A self-hosted deployment points it at its own collector.
 * - **What it sends is a fixed list**, not "the error object". A message, a digest, a trimmed
 *   stack, the path (never the query string), the browser's own user-agent, and a timestamp.
 * - **The stack is scrubbed** before it goes. A thrown error can carry a cell's contents in its
 *   message — `#NAME?` in `=ยอดขายสาขาเหนือ(...)` is the user's data — and an API key the visitor
 *   pasted is one `throw` away from a crash report. Both are removed here rather than trusted not
 *   to appear.
 */

/** Where reports go. Empty on every deployment that has not chosen otherwise, including the demo. */
export const REPORT_URL = process.env.NEXT_PUBLIC_ERROR_REPORT_URL ?? "";

export function isReportingConfigured(url = REPORT_URL): boolean {
  return url.trim().length > 0;
}

export interface ErrorReport {
  message: string;
  /** Next's own id for the error, which is what a server log can be matched against. */
  digest?: string;
  stack: string;
  /** Path only. A query string is user input, and user input is the thing not to send. */
  path: string;
  userAgent: string;
  at: string;
}

const MAX_MESSAGE = 300;
const MAX_STACK = 4_000;

/**
 * Takes out of a string the two things that must not travel.
 *
 * Not a general-purpose redactor and not pretending to be one: it knows about the key shapes this
 * app actually handles, and it cuts Thai text because in this app a run of Thai in a stack trace is
 * almost always a cell, a sheet name or a file name rather than anything about the code.
 */
export function scrub(text: string): string {
  return text
    // Anthropic keys, as the BYOK panel accepts them.
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-[removed]")
    // A JWT, which is the shape a Supabase anon or access token arrives in.
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[token removed]")
    // Anything that looks like an email address.
    //
    // Both sides exclude `@` and carry a length bound, and neither is decoration. Written the
    // obvious way — `[^\s"']+@[^\s"']+\.[A-Za-z]{2,}` — the two runs can each swallow an `@`, so on
    // a long string with no `@` in it at all the engine retries every split of every start
    // position: 50,000 characters of one letter took 2.8 seconds here and timed out three CI runs
    // in a row, on a different Node version each time, because it sat either side of a 5s limit.
    // That input is not hypothetical — this function reads an error message, and an error message
    // in this app can carry a whole cell. A crash reporter that hangs the crash screen has taken
    // the one thing the crash screen was for. The bounds are RFC 5321's, which is the other reason
    // they are the right numbers rather than merely small ones.
    .replace(/[^\s"'@]{1,64}@[^\s"'@]{1,255}\.[A-Za-z]{2,24}/g, "[email removed]")
    // A run of Thai. See the note above: in a stack from this app it is the user's content.
    .replace(/[฀-๿][฀-๿\s]*/g, "[text removed]");
}

export function buildReport(
  error: { message?: string; stack?: string; digest?: string },
  where: { path: string; userAgent: string; at?: string }
): ErrorReport {
  const report: ErrorReport = {
    message: scrub(error.message ?? "unknown error").slice(0, MAX_MESSAGE),
    stack: scrub(error.stack ?? "").slice(0, MAX_STACK),
    // Split rather than parsed: this runs inside a crash handler, where `new URL` throwing would
    // replace a report about one bug with a blank screen about another.
    path: (where.path ?? "").split("?")[0].split("#")[0],
    userAgent: where.userAgent.slice(0, 200),
    at: where.at ?? new Date().toISOString(),
  };
  if (error.digest) report.digest = String(error.digest).slice(0, 120);
  return report;
}

/**
 * Sends one, or does nothing at all.
 *
 * `sendBeacon` because the page may be about to be reloaded by the person reading the crash screen,
 * and a `fetch` in flight when that happens is a report that never arrives. Every failure here is
 * swallowed: a reporting endpoint that is down must not turn a recoverable crash into a second one.
 */
export function sendReport(report: ErrorReport, url = REPORT_URL): boolean {
  if (!isReportingConfigured(url)) return false;
  const body = JSON.stringify(report);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      return navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    }
    void fetch(url, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
    return true;
  } catch {
    return false;
  }
}
