import { create } from "zustand";
import { DataSourceConfig, PublicDataSource, TableData } from "@/lib/dataSources/types";
import { useSheetStore } from "./sheetStore";

export type SourceDraft = Omit<DataSourceConfig, "id" | "createdAt">;

interface DataSourceState {
  sources: PublicDataSource[];
  loaded: boolean;
  data: Record<string, TableData>;
  errors: Record<string, string>;
  loading: Record<string, boolean>;

  loadSources: () => Promise<void>;
  refresh: (id: string) => Promise<void>;
  saveSource: (draft: SourceDraft, id?: string) => Promise<PublicDataSource>;
  deleteSource: (id: string) => Promise<void>;
  testSource: (draft: SourceDraft, id?: string) => Promise<TableData>;
}

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}

export const useDataSourceStore = create<DataSourceState>()((set, get) => ({
  sources: [],
  loaded: false,
  data: {},
  errors: {},
  loading: {},

  loadSources: async () => {
    const sources = await readJson<PublicDataSource[]>(await fetch("/api/sources", { cache: "no-store" }));
    set({ sources, loaded: true });
  },

  refresh: async (id) => {
    if (get().loading[id]) return;
    set((s) => ({ loading: { ...s.loading, [id]: true } }));
    try {
      const table = await readJson<TableData>(await fetch(`/api/sources/${id}/data`, { cache: "no-store" }));
      set((s) => {
        const errors = { ...s.errors };
        delete errors[id];
        return { data: { ...s.data, [id]: table }, errors };
      });
      // Push the fresh values into every cell block bound to this source, across all sheets.
      useSheetStore.getState().applyLiveData(id, table);
    } catch (err) {
      set((s) => ({ errors: { ...s.errors, [id]: err instanceof Error ? err.message : "fetch_failed" } }));
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
    void get().refresh(saved.id);
    return saved;
  },

  deleteSource: async (id) => {
    await readJson<{ ok: true }>(await fetch(`/api/sources/${id}`, { method: "DELETE" }));
    set((s) => {
      const data = { ...s.data };
      const errors = { ...s.errors };
      delete data[id];
      delete errors[id];
      return { sources: s.sources.filter((x) => x.id !== id), data, errors };
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
