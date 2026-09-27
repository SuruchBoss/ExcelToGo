// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * How much one refresh of a live source may cost, in one place — the server enforces these and the
 * browser quotes them back in the message, so the two can never disagree about the number.
 */

/** The most rows a source may ask for per refresh. `validate.ts` clamps `maxRows` to it. */
export const MAX_ROWS_CEILING = 50_000;

/**
 * Bytes of response body read per refresh, across every page, after decompression.
 *
 * One kilobyte per row at the row ceiling. Measured before choosing it: 50,000 rows of the demo's
 * orders (seven fields) are 8.1 MB of JSON, and 50,000 rows of a wide record — twenty fields, much
 * of it Thai text — are 34.9 MB. So the ceiling the form offers still fits, with room, and a URL
 * that turns out to be a 2 GB export, or a small gzip that inflates into one, stops here instead of
 * taking the server's memory with it. Counted after decompression because that is what memory
 * holds: `fetch` inflates gzip and brotli on the way in, and 53 KB on the wire has been measured
 * turning into 40 MB of text.
 */
export const MAX_RESPONSE_BYTES = MAX_ROWS_CEILING * 1024;

/**
 * Bytes of JSON one refresh sends on to the browser — the table the route answers with.
 *
 * Vercel refuses a function response over 4.5 MB, so a table the server had fetched without trouble
 * reached the browser as a bare 413 (#80). 4 MiB leaves room for headers under that on Vercel, and
 * holds the same everywhere else so a source behaves alike on both: past it the table is cut to the
 * rows that fit and marked as partial, never refused. Measured on the route's own output (rows go
 * out as arrays, without the upstream's keys): the demo's orders are ~100 bytes a row, so about
 * 41,800 rows fit; twenty fields of mostly Thai text are ~560 bytes a row, about 7,700.
 */
export const MAX_DELIVERED_BYTES = 4 * 1024 * 1024;

/** Per request, from sending it to the last byte of its body — not only until the headers arrive. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Across every redirect and every page of one refresh, bodies included. */
export const TOTAL_BUDGET_MS = 45_000;

/**
 * The two ways a refresh is stopped on purpose, as codes rather than sentences: the server has no
 * idea which language the person reading it speaks, and the data panel does.
 */
export const SOURCE_TOO_LARGE = "response_too_large";
export const SOURCE_TIMED_OUT = "timed_out";

export class SourceLimitError extends Error {
  constructor(public code: typeof SOURCE_TOO_LARGE | typeof SOURCE_TIMED_OUT) {
    super(code);
    this.name = "SourceLimitError";
  }
}
