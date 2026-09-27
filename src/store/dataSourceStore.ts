// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { create } from "zustand";
import { backoffSec } from "@/lib/dataSources/rateLimit";
import { DataSourceConfig, PublicDataSource, TableData } from "@/lib/dataSources/types";
import { withSourcesToken } from "@/lib/dataSources/sourcesToken";
import { BrowserFetchError, BrowserSourceConfig, fetchInBrowser } from "@/lib/dataSources/browserSource";
import { forgetSecret, readSecret, writeSecret } from "@/lib/dataSources/browserSecrets";
import { originsAllowedAtLoad, writeApiOriginsCookie } from "@/lib/apiOrigins";
import { SourceLimitError } from "@/lib/dataSources/fetchLimits";
import { RateLimitError } from "@/lib/dataSources/rateLimit";
import { useSheetStore } from "./sheetStore";
import { getLocale } from "@/i18n";

export type SourceDraft = Omit<DataSourceConfig, "id" | "createdAt">;

/** Why a source isn't being polled right now, and until when. `rateLimited` is the source itself
 *  asking for a break; otherwise it's our own backoff after repeated failures. */
export interface BackoffState {
  until: number;
  rateLimited: boolean;
  failures: number;
}

/** A browser source as the form edits it: everything but the id, and the header's value beside it. */
export type BrowserSourceDraft = Omit<BrowserSourceConfig, "id" | "createdAt">;

/** What a failed browser fetch could say beyond its code: a status, a URL without its query, the
 *  top-level keys that were there instead of a table. */
export type ErrorDetail = BrowserFetchError["detail"];

interface DataSourceState {
  /** Server sources and this browser's sources together — what every list and picker shows. */
  sources: PublicDataSource[];
  /** The server's half, as `/api/sources` last listed it. */
  serverSources: PublicDataSource[];
  /** This browser's half (#110), as saved in `localStorage` — settings only, never the header value. */
  browserSources: BrowserSourceConfig[];
  errorDetail: Record<string, ErrorDetail>;
  /** A browser-source test to resume after the reload that allowed its origin. */
  resume: { draft: BrowserSourceDraft; headerValue: string; id?: string } | null;
  setResume: (resume: DataSourceState["resume"]) => void;
  loaded: boolean;
  data: Record<string, TableData>;
  errors: Record<string, string>;
  loading: Record<string, boolean>;
  backoff: Record<string, BackoffState>;

  loadSources: () => Promise<void>;
  /** Drops everything fetched under a token that has been given up. */
  forgetSources: () => void;
  /** Skipped while a source is waiting out a backoff, unless `force` (a manual "refresh now"). */
  refresh: (id: string, force?: boolean) => Promise<void>;
  saveSource: (draft: SourceDraft, id?: string) => Promise<PublicDataSource>;
  deleteSource: (id: string) => Promise<void>;
  testSource: (draft: SourceDraft, id?: string) => Promise<TableData>;
  /** Reads this browser's saved sources and keeps the CSP cookie in step with them. */
  loadBrowserSources: (extraOrigin?: string) => void;
  saveBrowserSource: (draft: BrowserSourceDraft, headerValue: string, id?: string) => BrowserSourceConfig;
  /** Runs a draft from this browser without saving it. Throws the way a refresh fails. */
  testBrowserSource: (draft: BrowserSourceDraft, headerValue: string) => Promise<TableData>;
}

const BROWSER_SOURCES_KEY = "etg-browser-sources";

function readBrowserSources(): BrowserSourceConfig[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(BROWSER_SOURCES_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === "string" && typeof x.url === "string") : [];
  } catch {
    return [];
  }
}

function writeBrowserSources(list: BrowserSourceConfig[]) {
  try {
    // Settings only. The config type has no field for the header's value, and this is the one place
    // it is written from, so a value cannot end up in localStorage by being carried along.
    window.localStorage.setItem(BROWSER_SOURCES_KEY, JSON.stringify(list));
  } catch {
    // A full or blocked localStorage: the sources work for this visit and the save banner says why.
  }
}

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
};

/** The cookie the proxy reads is exactly the origins of the saved sources (plus one being tested). */
function syncOriginsCookie(list: BrowserSourceConfig[], extra?: string) {
  const origins = [...list.map((b) => originOf(b.url)), extra ?? ""].filter(Boolean);
  writeApiOriginsCookie(origins);
}

function asPublic(b: BrowserSourceConfig): PublicDataSource {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    url: b.url,
    jsonPath: b.jsonPath,
    maxRows: b.maxRows,
    refreshSec: b.refreshSec,
    createdAt: b.createdAt,
    authHeader: b.headerName ? { name: b.headerName, value: "", masked: true } : undefined,
    local: true,
  };
}

const combine = (server: PublicDataSource[], browser: BrowserSourceConfig[]) => [...server, ...browser.map(asPublic)];

/**
 * The browser's own refresh. Two states need nothing fetched to know the answer: a header whose
 * value was forgotten with the last tab, and an origin this page's CSP was not served with yet.
 */
async function fetchBrowserSource(b: BrowserSourceConfig): Promise<TableData> {
  const secret = readSecret(b.id);
  if (b.headerName && !secret) throw new BrowserFetchError("needs_secret");
  if (!originsAllowedAtLoad().includes(originOf(b.url))) throw new BrowserFetchError("needs_reload");
  return fetchInBrowser(b, secret);
}

/** Thrown client-side so `refresh` can tell "wait this long" apart from an ordinary failure. */
class RateLimited extends Error {
  constructor(readonly retryAfterSec: number) {
    super("rate_limited");
  }
}

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { error?: string; retryAfterSec?: number };
  if (res.status === 429) throw new RateLimited(Number(body?.retryAfterSec) || 60);
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}

export const useDataSourceStore = create<DataSourceState>()((set, get) => ({
  sources: [],
  serverSources: [],
  browserSources: [],
  errorDetail: {},
  resume: null,
  setResume: (resume) => set({ resume }),
  loaded: false,
  data: {},
  errors: {},
  loading: {},
  backoff: {},

  // Only the server's half is forgotten with its token; this browser's own sources are not behind it.
  forgetSources: () =>
    set((s) => {
      const local = new Set(s.browserSources.map((b) => b.id));
      const keep = <T,>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([id]) => local.has(id)));
      return { serverSources: [], sources: combine([], s.browserSources), loaded: false, data: keep(s.data), errors: keep(s.errors), backoff: keep(s.backoff) };
    }),

  loadSources: async () => {
    const serverSources = await readJson<PublicDataSource[]>(await fetch(`/api/sources?lang=${getLocale()}`, { cache: "no-store", headers: withSourcesToken() }));
    set((s) => ({ serverSources, sources: combine(serverSources, s.browserSources), loaded: true }));
  },

  loadBrowserSources: (extraOrigin) => {
    const browserSources = readBrowserSources();
    syncOriginsCookie(browserSources, extraOrigin);
    set((s) => ({ browserSources, sources: combine(s.serverSources, browserSources) }));
  },

  saveBrowserSource: (draft, headerValue, id) => {
    const existing = id ? get().browserSources.find((b) => b.id === id) : undefined;
    const saved: BrowserSourceConfig = {
      ...draft,
      name: draft.name.trim(),
      url: draft.url.trim(),
      headerName: draft.headerName?.trim() || undefined,
      jsonPath: draft.jsonPath?.trim() || undefined,
      id: existing?.id ?? `b-${crypto.randomUUID()}`,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    // An empty value on an edit keeps the one this tab already holds; a header removed takes it too.
    if (!saved.headerName) forgetSecret(saved.id);
    else if (headerValue) writeSecret(saved.id, headerValue);
    const browserSources = existing ? get().browserSources.map((b) => (b.id === saved.id ? saved : b)) : [...get().browserSources, saved];
    writeBrowserSources(browserSources);
    syncOriginsCookie(browserSources);
    set((s) => {
      const backoff = { ...s.backoff };
      delete backoff[saved.id];
      return { browserSources, sources: combine(s.serverSources, browserSources), backoff };
    });
    void get().refresh(saved.id, true);
    return saved;
  },

  testBrowserSource: (draft, headerValue) => fetchInBrowser(draft, headerValue || undefined),

  refresh: async (id, force = false) => {
    if (get().loading[id]) return;
    const waiting = get().backoff[id];
    // The whole point of a backoff is that the tick that fires during it does nothing. A manual
    // refresh still goes through — the user asking is a deliberate act, not the poller.
    if (!force && waiting && Date.now() < waiting.until) return;

    set((s) => ({ loading: { ...s.loading, [id]: true } }));
    const local = get().browserSources.find((b) => b.id === id);
    try {
      const table = local
        ? await fetchBrowserSource(local)
        : await readJson<TableData>(await fetch(`/api/sources/${id}/data?lang=${getLocale()}`, { cache: "no-store", headers: withSourcesToken() }));
      set((s) => {
        const errors = { ...s.errors };
        const errorDetail = { ...s.errorDetail };
        const backoff = { ...s.backoff };
        delete errors[id];
        delete errorDetail[id];
        // A table can arrive complete-looking but still carry a rate limit hit partway through the
        // pages. The rows are good; the next poll still has to wait.
        if (table.retryAfterSec) {
          backoff[id] = { until: Date.now() + table.retryAfterSec * 1000, rateLimited: true, failures: 0 };
        } else {
          delete backoff[id];
        }
        return { data: { ...s.data, [id]: table }, errors, errorDetail, backoff };
      });
      // Push the fresh values into every cell block bound to this source, across all sheets.
      useSheetStore.getState().applyLiveData(id, table);
    } catch (err) {
      set((s) => {
        const failures = (s.backoff[id]?.failures ?? 0) + 1;
        const refreshSec = s.sources.find((x) => x.id === id)?.refreshSec ?? 30;
        // The browser's own fetch meets a rate limit as the error itself; the server's route meets
        // it as a 429 of its own. Either way the source is asking for a break.
        const limited = err instanceof RateLimited ? err.retryAfterSec : err instanceof RateLimitError ? err.retryAfterSec : null;
        const wait = limited ?? backoffSec(refreshSec, failures);
        const code =
          limited !== null
            ? "rate_limited"
            : err instanceof BrowserFetchError || err instanceof SourceLimitError
              ? err.code
              : err instanceof Error
                ? err.message
                : "fetch_failed";
        const errorDetail = { ...s.errorDetail };
        if (err instanceof BrowserFetchError) errorDetail[id] = err.detail;
        else delete errorDetail[id];
        // Waiting out a backoff cannot bring back a forgotten header or reload the page; those two
        // are the person's to fix, and the next tick should see the fix at once.
        const personal = code === "needs_secret" || code === "needs_reload";
        const backoff = { ...s.backoff };
        if (personal) delete backoff[id];
        else backoff[id] = { until: Date.now() + wait * 1000, rateLimited: limited !== null, failures };
        return { errors: { ...s.errors, [id]: code }, errorDetail, backoff };
      });
    } finally {
      set((s) => ({ loading: { ...s.loading, [id]: false } }));
    }
  },

  saveSource: async (draft, id) => {
    const res = id
      ? await fetch(`/api/sources/${id}`, { method: "PUT", headers: withSourcesToken({ "Content-Type": "application/json" }), body: JSON.stringify(draft) })
      : await fetch("/api/sources", { method: "POST", headers: withSourcesToken({ "Content-Type": "application/json" }), body: JSON.stringify(draft) });
    const saved = await readJson<PublicDataSource>(res);
    set((s) => {
      const serverSources = id ? s.serverSources.map((x) => (x.id === id ? saved : x)) : [...s.serverSources, saved];
      return { serverSources, sources: combine(serverSources, s.browserSources) };
    });
    set((s) => {
      const backoff = { ...s.backoff };
      delete backoff[saved.id];
      return { backoff };
    });
    void get().refresh(saved.id, true);
    return saved;
  },

  deleteSource: async (id) => {
    const local = get().browserSources.some((b) => b.id === id);
    if (local) {
      // Nothing to ask the server: it never knew about this source. The last source of an origin
      // takes that origin out of the cookie, so the next load's CSP no longer names it.
      const browserSources = get().browserSources.filter((b) => b.id !== id);
      forgetSecret(id);
      writeBrowserSources(browserSources);
      syncOriginsCookie(browserSources);
      set({ browserSources });
    } else {
      await readJson<{ ok: true }>(await fetch(`/api/sources/${id}`, { method: "DELETE", headers: withSourcesToken() }));
    }
    set((s) => {
      const data = { ...s.data };
      const errors = { ...s.errors };
      const errorDetail = { ...s.errorDetail };
      const backoff = { ...s.backoff };
      delete data[id];
      delete errors[id];
      delete errorDetail[id];
      delete backoff[id];
      const serverSources = s.serverSources.filter((x) => x.id !== id);
      return { serverSources, sources: combine(serverSources, s.browserSources), data, errors, errorDetail, backoff };
    });
    useSheetStore.getState().removeLiveBlocksForSource(id);
  },

  testSource: async (draft, id) => {
    const res = await fetch(`/api/sources/test${id ? `?id=${encodeURIComponent(id)}` : ""}`, {
      method: "POST",
      headers: withSourcesToken({ "Content-Type": "application/json" }),
      body: JSON.stringify(draft),
    });
    return readJson<TableData>(res);
  },
}));
