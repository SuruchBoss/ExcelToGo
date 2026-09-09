"use client";

import { useEffect } from "react";
import { useDataSourceStore } from "@/store/dataSourceStore";

/** Loads the source list once, then keeps every source polling on its own interval. Runs at the
 *  app root (not inside the panel) so live cells keep updating with the panel closed. */
export function useLiveDataPolling() {
  const sources = useDataSourceStore((s) => s.sources);
  const loaded = useDataSourceStore((s) => s.loaded);

  useEffect(() => {
    if (!loaded) void useDataSourceStore.getState().loadSources().catch(() => {});
  }, [loaded]);

  useEffect(() => {
    const { refresh } = useDataSourceStore.getState();
    const timers = sources.map((src) => {
      void refresh(src.id);
      return setInterval(() => void refresh(src.id), Math.max(2, src.refreshSec) * 1000);
    });
    return () => timers.forEach(clearInterval);
  }, [sources]);
}
