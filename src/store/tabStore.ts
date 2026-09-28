// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { create } from "zustand";
import type { TabRole } from "@/lib/tabLock";

/**
 * Whether this tab is the one editing the workbook (#47). See `lib/tabLock.ts` for how that is
 * decided; this only holds the answer for the store and the screen to read.
 *
 * Kept apart from `sheetStore` because that store reads it — to refuse an edit and to hold back a
 * save — and the hook that sets it reads `sheetStore` in turn.
 */
interface TabState {
  role: TabRole;
  /** Bumped when an edit is refused here, so the notice can say why nothing happened. */
  refused: number;
  takeOver: () => void;
  viewOnly: () => void;
}

export const useTabStore = create<TabState>(() => ({
  role: "starting",
  refused: 0,
  takeOver: () => {},
  viewOnly: () => {},
}));

/**
 * True on the tab that edits and saves. Also while the lock has not answered yet — a few
 * milliseconds after load — so a tab never waits on it to save, and a browser (or a test) where it
 * never answers behaves as every tab did before.
 */
export function isEditingTab(): boolean {
  const { role } = useTabStore.getState();
  return role === "editor" || role === "starting";
}

export function noteRefusedEdit(): void {
  useTabStore.setState((s) => ({ refused: s.refused + 1 }));
}
