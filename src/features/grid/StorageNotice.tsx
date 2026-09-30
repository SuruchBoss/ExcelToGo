// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { HardDriveDownload, X } from "lucide-react";
import { useT } from "@/i18n";
import { useShortScreen } from "@/features/toolbar/useShortScreen";

const DISMISSED_KEY = "exceltogo.storage-notice-dismissed";
// Shown in some visit (localStorage), and whether this visit is that one (sessionStorage).
const SEEN_KEY = "exceltogo.storage-notice-seen";
const VISIT_KEY = "exceltogo.storage-notice-visit";
const CHANGED_EVENT = "exceltogo:storage-notice";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED_EVENT, onChange);
  // Another tab dismissing it should settle this one too.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isHidden(): boolean {
  try {
    if (localStorage.getItem(DISMISSED_KEY) === "1") return true;
    // Read once, in the visit it first appeared in. From the next visit on, the save status on the
    // top bar holds it, with a dot until a copy has been exported (#129).
    return localStorage.getItem(SEEN_KEY) === "1" && sessionStorage.getItem(VISIT_KEY) !== "1";
  } catch {
    // Storage blocked: nothing can be remembered, so the notice shows every time — which is right,
    // since that browser is exactly the one most likely to lose the work.
    return false;
  }
}

/** During server rendering there is no localStorage, so the notice stays out of the HTML and
 *  appears on the client once its real state is known. Painting it server-side and removing it
 *  would flash at everyone who has already dismissed it. */
const serverSnapshot = () => true;

/**
 * Says once, where a person will actually read it, that their work lives only in this browser.
 *
 * One line, in the visit of the first edit, and then never again as a band: the whole text is one
 * press away behind the save status on the top bar (`SaveStatus.tsx`). It was three lines at 390px
 * and, stacked with the import message, left ten rows of grid on a phone (#129).
 *
 * The README says so too, but nobody reads a README before typing into a grid — and finding out
 * afterwards, having lost an afternoon's work, is the kind of first impression there is no
 * recovering from.
 *
 * Dismissible and remembered, because an earlier audit found the stacked bars were eating a fifth
 * of a 1366×768 screen before a single grid row appeared. A warning that costs a grid row forever
 * would be trading one problem for another.
 *
 * Read through `useSyncExternalStore` rather than an effect that calls setState: that is what it
 * exists for, and it keeps the server and client renders in agreement without a cascading render.
 */
export default function StorageNotice() {
  const t = useT();
  const stored = useSyncExternalStore(subscribe, isHidden, serverSnapshot);
  // A short screen has no row to spare: the dot on the save status says it there, and the line
  // waits for a taller one rather than counting as read (#129).
  const short = useShortScreen();
  const hidden = stored || short;

  useEffect(() => {
    if (hidden) return;
    try {
      localStorage.setItem(SEEN_KEY, "1");
      sessionStorage.setItem(VISIT_KEY, "1");
    } catch {
      // Nothing can be remembered: it shows every visit, as `isHidden` explains.
    }
  }, [hidden]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Can't remember it; the event below still closes it for this session.
    }
    window.dispatchEvent(new Event(CHANGED_EVENT));
  }, []);

  if (hidden) return null;

  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1 text-xs text-amber-900">
      <HardDriveDownload size={14} className="shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 truncate" title={t.storageNotice.text}>
        {t.storageNotice.short}
      </p>
      <button
        onClick={dismiss}
        title={t.storageNotice.dismiss}
        aria-label={t.storageNotice.dismiss}
        className="-m-1 shrink-0 rounded p-2 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
      >
        <X size={14} />
      </button>
    </div>
  );
}
