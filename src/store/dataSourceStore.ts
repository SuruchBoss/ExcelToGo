import { create } from "zustand";
import { backoffSec } from "@/lib/dataSources/rateLimit";
import { DataSourceConfig, PublicDataSource, TableData } from "@/lib/dataSources/types";
import { useSheetStore } from "./sheetStore";

export type SourceDraft = Omit<DataSourceConfig, "id" | "createdAt">;

/** Why a source isn't being polled right now, and until when. `rateLimited` is the source itself
 *  asking for a break; otherwise it's our own backoff after repeated failures. */
export interface BackoffState {
  until: number;
  rateLimited: boolean;
  failures: number;
}

interface DataSourceState {
  sources: PublicDataSource[];
  loaded: boolean;
  data: Record<string, TableData>;
  errors: Record<string, string>;
  loading: Record<string, boolean>;
  backoff: Record<string, BackoffState>;

  loadSources: () => Promise<void>;
  /** Skipped while a source is waiting out a backoff, unless `force` (a manual "refresh now"). */
  refresh: (id: string, force?: boolean) => Promise<void>;
  saveSource: (draft: SourceDraft, id?: string) => Promise<PublicDataSource>;
  deleteSource: (id: string) => Promise<void>;
  testSource: (draft: SourceDraft, id?: string) => Promise<TableData>;
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
  loaded: false,
  data: {},
  errors: {},
  loading: {},
  backoff: {},

  loadSources: async () => {
    const sources = await readJson<PublicDataSource[]>(await fetch("/api/sources", { cache: "no-store" }));
    set({ sources, loaded: true });
  },

  refresh: async (id, force = false) => {
    if (get().loading[id]) return;
    const waiting = get().backoff[id];
    // The whole point of a backoff is that the tick that fires during it does nothing. A manual
    // refresh still goes through — the user asking is a deliberate act, not the poller.
    if (!force && waiting && Date.now() < waiting.until) return;

    set((s) => ({ loading: { ...s.loading, [id]: true } }));
    try {
      const table = await readJson<TableData>(await fetch(`/api/sources/${id}/data`, { cache: "no-store" }));
      set((s) => {
        const errors = { ...s.errors };
        const backoff = { ...s.backoff };
        delete errors[id];
        // A table can arrive complete-looking but still carry a rate limit hit partway through the
        // pages. The rows are good; the next poll still has to wait.
        if (table.retryAfterSec) {
          backoff[id] = { until: Date.now() + table.retryAfterSec * 1000, rateLimited: true, failures: 0 };
        } else {
          delete backoff[id];
        }
        return { data: { ...s.data, [id]: table }, errors, backoff };
      });
      // Push the fresh values into every cell block bound to this source, across all sheets.
      useSheetStore.getState().applyLiveData(id, table);
    } catch (err) {
      set((s) => {
        const failures = (s.backoff[id]?.failures ?? 0) + 1;
        const refreshSec = s.sources.find((x) => x.id === id)?.refreshSec ?? 30;
        const wait = err instanceof RateLimited ? err.retryAfterSec : backoffSec(refreshSec, failures);
        return {
          errors: { ...s.errors, [id]: err instanceof RateLimited ? "rate_limited" : err instanceof Error ? err.message : "fetch_failed" },
          backoff: { ...s.backoff, [id]: { until: Date.now() + wait * 1000, rateLimited: err instanceof RateLimited, failures } },
        };
      });
    } finally {
      set((s) => ({ loading: { ...s.loading, [id]: false } }));
    }
  },

  saveSource: async (draft, id) => {
    const res = id
      ? await fetch(`/api/sources/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) })
      : await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const saved = await readJson<PublicDataSource>(res);
    set((s) => ({
      sources: id ? s.sources.map((x) => (x.id === id ? saved : x)) : [...s.sources, saved],
    }));
    set((s) => {
      const backoff = { ...s.backoff };
      delete backoff[saved.id];
      return { backoff };
    });
    void get().refresh(saved.id, true);
    return saved;
  },

  deleteSource: async (id) => {
    await readJson<{ ok: true }>(await fetch(`/api/sources/${id}`, { method: "DELETE" }));
    set((s) => {
      const data = { ...s.data };
      const errors = { ...s.errors };
      const backoff = { ...s.backoff };
      delete data[id];
      delete errors[id];
      delete backoff[id];
      return { sources: s.sources.filter((x) => x.id !== id), data, errors, backoff };
    });
    useSheetStore.getState().removeLiveBlocksForSource(id);
  },

  testSource: async (draft, id) => {
    const res = await fetch(`/api/sources/test${id ? `?id=${encodeURIComponent(id)}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    return readJson<TableData>(res);
  },
}));
