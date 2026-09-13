"use client";

import { create } from "zustand";
import {
  deleteWorkbook,
  fetchUpdatedAt,
  fetchWorkbook,
  insertWorkbook,
  listWorkbooks,
  onSessionChange,
  sendSignInLink,
  signOut,
  updateWorkbook,
} from "@/lib/cloud/client";
import { isCloudConfigured } from "@/lib/cloud/config";
import { CloudWorkbookSummary, readWorkbook, wouldOverwriteNewer } from "@/lib/cloud/workbook";
import { useSheetStore } from "./sheetStore";

/**
 * Session and workbook list for the optional cloud backend.
 *
 * Separate from the sheet store on purpose: the sheet store is the document, and it must keep
 * working identically on a deployment that has no cloud at all. Nothing here is imported by the
 * grid, the formula engine or either export path.
 */

/** Which workbook the open document came from, so saving updates it instead of making a copy. */
interface LinkedWorkbook {
  id: string;
  name: string;
  /** The row's updated_at when it was last read, which is what a conflict is measured against. */
  seenAt: string;
}

interface CloudState {
  email: string | null;
  ready: boolean;
  busy: string | null;
  error: string | null;
  notice: string | null;
  workbooks: CloudWorkbookSummary[];
  linked: LinkedWorkbook | null;

  start: () => Promise<void>;
  signIn: (email: string) => Promise<void>;
  leave: () => Promise<void>;
  refresh: () => Promise<void>;
  save: (name: string) => Promise<void>;
  saveOver: (name: string) => Promise<void>;
  open: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  dismiss: () => void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

let unsubscribe: (() => void) | null = null;

export const useCloudStore = create<CloudState>((set, get) => ({
  email: null,
  ready: false,
  busy: null,
  error: null,
  notice: null,
  workbooks: [],
  linked: null,

  /** Called when the panel first opens, which is also the first time the client is downloaded. */
  start: async () => {
    if (!isCloudConfigured() || unsubscribe) return;
    try {
      unsubscribe = await onSessionChange((session) => {
        set({ email: session?.user.email ?? null, ready: true });
        if (session) void get().refresh();
        else set({ workbooks: [], linked: null });
      });
    } catch (e) {
      set({ ready: true, error: message(e) });
    }
  },

  signIn: async (email) => {
    set({ busy: "signin", error: null, notice: null });
    try {
      await sendSignInLink(email.trim());
      set({ notice: "linkSent" });
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: null });
    }
  },

  leave: async () => {
    set({ busy: "signout", error: null });
    try {
      await signOut();
      set({ email: null, workbooks: [], linked: null });
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: null });
    }
  },

  refresh: async () => {
    set({ busy: "list", error: null });
    try {
      set({ workbooks: await listWorkbooks() });
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: null });
    }
  },

  /** A new row every time, so "Save as" never silently replaces something. */
  save: async (name) => {
    set({ busy: "save", error: null, notice: null });
    try {
      const summary = await insertWorkbook(name.trim(), useSheetStore.getState().sheets);
      set({ linked: { id: summary.id, name: summary.name, seenAt: summary.updatedAt }, notice: "saved" });
      await get().refresh();
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: null });
    }
  },

  /**
   * Overwrites the workbook this document came from — unless the row has moved on since it was
   * read, which means another device saved in the meantime and this write would erase it.
   */
  saveOver: async (name) => {
    const linked = get().linked;
    if (!linked) return;
    set({ busy: "save", error: null, notice: null });
    try {
      if (wouldOverwriteNewer(linked.seenAt, await fetchUpdatedAt(linked.id))) {
        set({ error: "conflict" });
        return;
      }
      const summary = await updateWorkbook(linked.id, name.trim(), useSheetStore.getState().sheets);
      set({ linked: { id: summary.id, name: summary.name, seenAt: summary.updatedAt }, notice: "saved" });
      await get().refresh();
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: null });
    }
  },

  open: async (id) => {
    set({ busy: "open", error: null, notice: null });
    try {
      const row = await fetchWorkbook(id);
      const sheets = readWorkbook(row.data);
      if (!sheets) {
        set({ error: "unreadable" });
        return;
      }
      useSheetStore.getState().replaceWorkbook(sheets);
      set({ linked: { id: row.id, name: row.name, seenAt: row.updated_at }, notice: "opened" });
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: null });
    }
  },

  remove: async (id) => {
    set({ busy: "delete", error: null });
    try {
      await deleteWorkbook(id);
      // Unlink if the open document was the one deleted, so the next save doesn't target a row
      // that is no longer there.
      if (get().linked?.id === id) set({ linked: null });
      await get().refresh();
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: null });
    }
  },

  dismiss: () => set({ error: null, notice: null }),
}));
