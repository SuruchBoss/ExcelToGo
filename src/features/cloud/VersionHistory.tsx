// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useSyncExternalStore } from "react";
import { History } from "lucide-react";
import { describeVersionAge } from "@/lib/cloud/workbook";
import { useCloudStore } from "@/store/cloudStore";
import { useLocale, useT } from "@/i18n";

/**
 * What this workbook looked like before the last few saves.
 *
 * Saving over a workbook used to be final. The app warns before overwriting a *newer* save from
 * another device — a different problem, already solved — but that warning implies an answer to
 * "what did this look like yesterday" and there was nowhere to look.
 *
 * The button says **open**, not restore. Looking at a version and deciding is a different act from
 * replacing today's work with it, and one button doing both would be the more dangerous one
 * wearing the safer one's label. Saving afterwards is an ordinary save, which snapshots what was
 * there first — so even taking an old version is undoable.
 */
const subscribeToNothing = () => () => {};
const noTimeOnTheServer = () => null;

let cachedMinute = -1;
let cachedNow: Date | null = null;
/** The same `Date` for a whole minute, because `getSnapshot` returning a new object every call loops. */
function currentMinute(): Date {
  const minute = Math.floor(Date.now() / 60_000);
  if (minute !== cachedMinute || !cachedNow) {
    cachedMinute = minute;
    cachedNow = new Date(minute * 60_000);
  }
  return cachedNow;
}

export default function VersionHistory() {
  const t = useT();
  const locale = useLocale();
  const { linked, versions, busy, loadVersions, openVersion } = useCloudStore();
  // "2 hours ago" needs the current time, and the current time is the one value a render must not
  // simply read: it differs between the server and the client, and between two renders for no
  // reason at all. Taken through `useSyncExternalStore` — the same shape the crash rescue uses for
  // `localStorage` — with the server answering "I don't know" and the snapshot rounded to the
  // minute so it is stable enough for React to compare.
  const now = useSyncExternalStore(subscribeToNothing, currentMinute, noTimeOnTheServer);
  const workbookId = linked?.id;

  useEffect(() => {
    void loadVersions();
  }, [loadVersions, workbookId]);

  if (!linked) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-xs leading-relaxed text-zinc-500">
        {t.versions.needsWorkbook}
      </p>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
        <History size={14} className="text-emerald-700" />
        {t.versions.title}
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{t.versions.subtitle}</p>

      {versions.length === 0 ? (
        <p className="mt-2.5 rounded-md border border-dashed border-zinc-300 px-2 py-2 text-[11px] text-zinc-500">
          {t.versions.none}
        </p>
      ) : (
        <>
          <p className="mt-2.5 text-[11px] font-medium text-zinc-600">{t.versions.count(versions.length)}</p>
          <ul className="mt-1.5 border-t border-zinc-100">
            {versions.map((version) => {
              const when = now ? describeVersionAge(version.createdAt, now, locale) : version.createdAt;
              return (
                <li key={version.id} className="flex items-center gap-2 border-b border-zinc-100 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-zinc-700">{version.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">{when}</p>
                  </div>
                  <button
                    onClick={() => {
                      // One question, because what is on screen is about to be replaced — even
                      // though nothing is saved by it.
                      if (window.confirm(t.versions.confirmOpen(when))) void openVersion(version.id);
                    }}
                    disabled={busy !== null}
                    className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {t.versions.open}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-400">{t.versions.limit}</p>
    </section>
  );
}
