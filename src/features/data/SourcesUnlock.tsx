"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { KeyRound, LockOpen } from "lucide-react";
import { readSourcesToken, TOKEN_CHANGED_EVENT, writeSourcesToken } from "@/lib/dataSources/sourcesToken";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { useT } from "@/i18n";

/**
 * The token box in front of the data-source panel.
 *
 * The API refuses every request without a token — it can drive the server's HTTP client, so it is
 * not something to leave open to whoever loads the page. This is where the person who set the
 * deployment up types the token once per browser session.
 *
 * Read through `useSyncExternalStore` rather than an effect that calls setState: sessionStorage is
 * exactly the kind of outside-React value it exists for, and it keeps the server and client renders
 * in agreement.
 */

function subscribe(onChange: () => void): () => void {
  window.addEventListener(TOKEN_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(TOKEN_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSourcesToken(): string {
  // The server has no session storage; "" matches what the first client render produces before the
  // subscription corrects it.
  return useSyncExternalStore(subscribe, readSourcesToken, () => "");
}

export default function SourcesUnlock() {
  const t = useT();
  const token = useSourcesToken();
  const loadSources = useDataSourceStore((s) => s.loadSources);
  const forgetSources = useDataSourceStore((s) => s.forgetSources);
  const [typed, setTyped] = useState("");
  const [failed, setFailed] = useState(false);

  const unlock = useCallback(
    async (value: string) => {
      writeSourcesToken(value);
      try {
        await loadSources();
        setFailed(false);
      } catch {
        // A wrong token looks exactly like no token to the API, so clear it rather than leaving a
        // value in place that will keep failing silently on every poll.
        writeSourcesToken("");
        setFailed(true);
      }
    },
    [loadSources]
  );

  if (token) {
    return (
      <button
        onClick={() => {
          // Handing the token back should take the data with it, not leave a list on screen that
          // nothing can refresh any more.
          writeSourcesToken("");
          forgetSources();
        }}
        className="flex items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
      >
        <LockOpen size={12} /> {t.data.lock}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (typed.trim()) void unlock(typed);
      }}
      className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"
    >
      <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-700" htmlFor="sources-token">
        <KeyRound size={13} className="text-amber-600" /> {t.data.tokenLabel}
      </label>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{t.data.tokenHint}</p>
      <input
        id="sources-token"
        type="password"
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={t.data.tokenPlaceholder}
        className="mt-2 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
      />
      {failed && <p className="mt-1.5 text-[11px] text-red-700">{t.data.tokenRejected}</p>}
      <button
        type="submit"
        className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 sm:min-h-0 sm:py-2"
      >
        {t.data.unlock}
      </button>
    </form>
  );
}
