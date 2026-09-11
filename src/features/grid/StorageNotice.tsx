"use client";

import { useCallback, useSyncExternalStore } from "react";
import { HardDriveDownload, X } from "lucide-react";
import { useT } from "@/i18n";

const DISMISSED_KEY = "exceltogo.storage-notice-dismissed";
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

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
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
  const dismissed = useSyncExternalStore(subscribe, isDismissed, serverSnapshot);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Can't remember it; the event below still closes it for this session.
    }
    window.dispatchEvent(new Event(CHANGED_EVENT));
  }, []);

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      <HardDriveDownload size={14} className="mt-0.5 shrink-0" />
      <p className="flex-1 leading-relaxed">{t.storageNotice.text}</p>
      <button
        onClick={dismiss}
        title={t.storageNotice.dismiss}
        aria-label={t.storageNotice.dismiss}
        className="shrink-0 rounded p-0.5 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
      >
        <X size={14} />
      </button>
    </div>
  );
}
