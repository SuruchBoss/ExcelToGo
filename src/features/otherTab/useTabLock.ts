// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect } from "react";
import { browserTabLock, type TabRole } from "@/lib/tabLock";
import { useSheetStore } from "@/store/sheetStore";
import { isEditingTab, useTabStore } from "@/store/tabStore";

/**
 * Decides whether this tab edits the workbook, and keeps a tab that does not showing the latest
 * save (#47). Call once near the root of the app.
 *
 * A tab that is only looking has no undo history of its own: its copy moves only when the editing
 * tab saves, and stepping back through changes it cannot keep would only mislead. A tab that takes
 * over starts with an empty history for the same reason — what it could undo was done elsewhere.
 */
export function useTabLock() {
  useEffect(() => {
    let previous: TabRole = "starting";
    const lock = browserTabLock({
      onRole(role) {
        const history = useSheetStore.temporal.getState();
        if (role === "editor") {
          // The first answer on a tab that was editing all along keeps what it has typed so far.
          if (previous !== "starting") history.clear();
          history.resume();
        } else {
          history.pause();
          history.clear();
        }
        previous = role;
        useTabStore.setState({ role, refused: 0 });
      },
      // A cell half-typed commits on blur, and the commit is saved before the lock is let go.
      beforeHandOff: () => (document.activeElement as HTMLElement | null)?.blur?.(),
      // Reads the save through the store's own `merge`: a field added to what autosave keeps (a
      // workbook's name, say) follows a hand-over when `merge` takes it back as well as `partialize`.
      afterTakeOver: () => void useSheetStore.persist.rehydrate(),
    });
    useTabStore.setState({ takeOver: lock.takeOver, viewOnly: lock.viewOnly });

    // Another tab saved: a tab that is only looking shows it. `storage` fires in every tab but the
    // one that wrote, so the editing tab never re-reads its own save.
    const key = useSheetStore.persist.getOptions().name;
    const onStorage = (event: StorageEvent) => {
      if (event.key === key && !isEditingTab()) void useSheetStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      lock.stop();
    };
  }, []);
}
