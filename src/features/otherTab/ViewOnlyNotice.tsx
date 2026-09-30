// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { Eye, Pencil, X } from "lucide-react";
import { useTabStore } from "@/store/tabStore";
import { useT } from "@/i18n";

/**
 * Says, for as long as it is true, that this tab is only looking (#47) — and, after an edit was
 * refused, why nothing happened. The way back is right here: taking over loses nothing in the tab
 * that has been editing, it only turns that one view-only instead.
 *
 * When the editing tab closes or leaves the app, this tab edits by itself (#146) and says so once:
 * a notice still claiming another tab is editing would be false, and so would silence about why
 * typing works now.
 */
export default function ViewOnlyNotice() {
  const t = useT();
  const role = useTabStore((s) => s.role);
  const refused = useTabStore((s) => s.refused > 0);
  const takeOver = useTabStore((s) => s.takeOver);
  const freed = useTabStore((s) => s.freed && s.role === "editor");

  if (freed) {
    return (
      <div role="status" className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-950">
        <Pencil size={14} className="shrink-0" aria-hidden />
        <p className="flex-1 leading-relaxed">{t.otherTab.freed}</p>
        <button
          onClick={() => useTabStore.setState({ freed: false })}
          aria-label={t.otherTab.dismiss}
          title={t.otherTab.dismiss}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-emerald-900 hover:bg-emerald-100 sm:min-h-0 sm:min-w-0 sm:p-1.5"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    );
  }
  if (role !== "viewer" && role !== "handedOff") return null;
  return (
    <div role="status" className="flex items-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-950">
      <Eye size={14} className="shrink-0" aria-hidden />
      <p className="flex-1 leading-relaxed">
        {role === "viewer" ? t.otherTab.viewing : t.otherTab.handedOff}
        {refused && <strong className="ml-1 font-semibold">{t.otherTab.refused}</strong>}
      </p>
      <button
        onClick={takeOver}
        className="flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md bg-sky-800 px-3 font-medium text-white hover:bg-sky-900 sm:min-h-0 sm:py-1.5"
      >
        {t.otherTab.useHere}
      </button>
    </div>
  );
}
