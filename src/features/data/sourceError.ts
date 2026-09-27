// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import {
  MAX_DELIVERED_BYTES,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  SOURCE_TIMED_OUT,
  SOURCE_TOO_LARGE,
} from "@/lib/dataSources/fetchLimits";
import type { TableData } from "@/lib/dataSources/types";
import type { Messages } from "@/i18n/types";

/**
 * What a source's error says to the person reading it.
 *
 * The server sends codes for the two limits it enforces, because it does not know which language
 * the panel is in; everything else it sends is already a readable line ("HTTP 404", "Response is
 * not valid JSON") and passes through. The numbers come from the same module the server enforces,
 * so the message cannot quote a limit the code no longer has.
 */
export function sourceErrorText(error: string, t: Messages["data"]): string {
  if (error === SOURCE_TOO_LARGE) return t.tooLarge(Math.round(MAX_RESPONSE_BYTES / (1024 * 1024)));
  // Only the first page can fail a refresh on time — a later one that runs out keeps the rows before
  // it and marks the table partial — and the first page always has the full per-request limit.
  if (error === SOURCE_TIMED_OUT) return t.timedOut(REQUEST_TIMEOUT_MS / 1000);
  return error;
}

/**
 * What to do about a partial table: a table cut for size needs fewer columns or a smaller endpoint,
 * and telling that person to raise the row limit would send them to a setting that cannot help.
 */
export function partialHintText(table: Pick<TableData, "sizeLimited">, t: Messages["data"]): string {
  return table.sizeLimited ? t.partialSizeHint(Math.round(MAX_DELIVERED_BYTES / (1024 * 1024))) : t.partialHint;
}
