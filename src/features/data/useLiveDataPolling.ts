// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect } from "react";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { useSheetStore } from "@/store/sheetStore";
import { readSourcesToken } from "@/lib/dataSources/sourcesToken";
import { useLocaleStore } from "@/store/localeStore";
import { pendingOrigin, takePending } from "./allowOrigin";
import { serverSourcesOffered } from "./useServerSources";

/** Loads the source lists once, then keeps every source polling on its own interval. Runs at the
 *  app root (not inside the panel) so live cells keep updating with the panel closed. */
export function useLiveDataPolling() {
  const sources = useDataSourceStore((s) => s.sources);
  const loaded = useDataSourceStore((s) => s.loaded);
  const locale = useLocaleStore((s) => s.locale);

  // This browser's own sources (#110), at once and for everyone — they need no server and no token.
  // A test that reloaded the page to allow its origin is picked up again here: the form reopens and
  // runs it, or the picker opens for a source that was just saved.
  useEffect(() => {
    useDataSourceStore.getState().loadBrowserSources(pendingOrigin());
    const pending = takePending();
    if (!pending) return;
    // After the page's own first effects, one of which closes the sidebar on a phone.
    const timer = setTimeout(() => {
      if (pending.action === "test") {
        useDataSourceStore.getState().setResume({ draft: pending.draft, headerValue: pending.headerValue, id: pending.id });
        useSheetStore.getState().setSidebarMode("data");
      } else {
        useSheetStore.getState().openDataPicker({ sourceId: pending.sourceId });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loaded) return;
    // Don't ask a question whose answer is already known to be no. The server's list refuses
    // without a token — and a deployment without SOURCES_ADMIN_TOKEN offers no server sources at
    // all — so asking anyway put a red 403 in the console of every first visit, which reads as a
    // broken app to anyone who opens devtools.
    if (!serverSourcesOffered() || readSourcesToken() === "") return;
    void useDataSourceStore.getState().loadSources().catch(() => {});
  }, [loaded]);

  // Server sources answer in the language on screen; reloading the list refreshes them all at once.
  useEffect(() => {
    if (!useDataSourceStore.getState().loaded) return;
    void useDataSourceStore.getState().loadSources().catch(() => {});
  }, [locale]);

  useEffect(() => {
    const { refresh } = useDataSourceStore.getState();
    const timers = sources.map((src) => {
      void refresh(src.id);
      return setInterval(() => void refresh(src.id), Math.max(2, src.refreshSec) * 1000);
    });
    return () => timers.forEach(clearInterval);
  }, [sources]);
}
