// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { useT } from "@/i18n";
import type { ErrorDetail } from "@/store/dataSourceStore";
import { hostOf } from "./allowOrigin";

/**
 * What a failed browser fetch says to the person looking at it (#110).
 *
 * Only what the app actually knows. A browser deliberately hides *why* a cross-origin request failed
 * — unreachable, refused by CORS and refused by the private-network rules all look the same from
 * script — so that case is a checklist, not a diagnosis, with the note for IT ready to copy. The
 * cases that can be named exactly (http from an https page, 401/403, a status, not a table) are
 * named exactly.
 */
/** The codes this component explains; anything else (size, time, rate limit) is `sourceErrorText`'s. */
export const BROWSER_CODES = new Set(["invalid_url", "insecure_http", "network", "auth", "http", "not_table", "bad_header", "needs_secret", "needs_reload"]);

export function browserErrorText(code: string, detail: ErrorDetail | undefined, url: string, t: ReturnType<typeof useT>): string | null {
  const b = t.data.browser;
  switch (code) {
    case "invalid_url":
      return b.invalidUrl;
    case "insecure_http":
      return b.insecureHttp;
    case "auth":
      return b.auth(detail?.status ?? 401);
    case "http":
      return b.http(detail?.status ?? 0, detail?.url ?? "");
    case "not_table":
      return detail?.keys?.length ? `${b.notTable} · ${b.keysFound(detail.keys.join(", "))}` : b.notTable;
    case "bad_header":
      return b.badHeaderValue;
    case "needs_secret":
      return b.needsSecret;
    case "needs_reload":
      return b.needsReload(hostOf(url));
    default:
      return null;
  }
}

export default function BrowserSourceError({
  code,
  detail,
  url,
  headerName,
}: {
  code: string;
  detail?: ErrorDetail;
  url: string;
  headerName?: string;
}) {
  const t = useT();
  const b = t.data.browser;
  const [copied, setCopied] = useState(false);
  if (code !== "network") {
    const text = browserErrorText(code, detail, url, t);
    // Waiting on the person (#115) reads as a note, not an error.
    const waiting = code === "needs_secret" || code === "needs_reload";
    return text ? <p className={waiting ? "text-xs text-amber-900" : "text-xs text-red-700"}>{text}</p> : null;
  }

  const appOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const headers = headerName?.trim() ?? "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(b.itNote(appOrigin, url, headers));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-900">
      <p className="font-semibold">{b.networkTitle}</p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-4">
        {b.networkChecks(appOrigin, headers).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 text-xs font-medium text-red-900 hover:bg-red-100"
      >
        <Copy size={13} aria-hidden /> {copied ? b.copied : b.copyForIt}
      </button>
    </div>
  );
}
