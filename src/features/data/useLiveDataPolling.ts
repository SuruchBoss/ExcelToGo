// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect } from "react";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { readSourcesToken } from "@/lib/dataSources/sourcesToken";
import { DEMO_MODE } from "@/lib/demoMode";

/** Loads the source list once, then keeps every source polling on its own interval. Runs at the
 *  app root (not inside the panel) so live cells keep updating with the panel closed. */
export function useLiveDataPolling() {
  const sources = useDataSourceStore((s) => s.sources);
  const loaded = useDataSourceStore((s) => s.loaded);

  useEffect(() => {
    if (loaded) return;
    // Don't ask a question whose answer is already known to be no. The list endpoint refuses
    // without a token — and on a public demo it refuses outright — so firing this at startup
    // produced a red 403 in the console of every first visit, which reads as a broken app to
    // anyone who opens devtools. The catch() swallowed the rejection but not the browser's own
    // network log, which no JS can suppress: the fix has to be not making the request.
    //
    // Nothing is lost by waiting. Unlocking calls loadSources() itself, and a token already
    // stored from a previous session still starts polling straight away.
    // A demo needs no token — the list endpoint answers it with the three built-ins — so only the
    // tokenless non-demo case is still a question whose answer is known to be no.
    if (!DEMO_MODE && readSourcesToken() === "") return;
    void useDataSourceStore.getState().loadSources().catch(() => {});
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
