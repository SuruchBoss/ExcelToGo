"use client";

import { useSyncExternalStore } from "react";
import { FileDown, TriangleAlert } from "lucide-react";
import { getSaveStatus, subscribeSaveStatus, type SaveStatus } from "@/lib/saveHealth";
import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/** Nothing has failed during server rendering, and saying so there would flash at everyone. */
const serverSnapshot = (): SaveStatus => "ok";

/**
 * Says, while it is true, that the work on screen is not being saved.
 *
 * Before this, a workbook too big for the browser's storage failed to save in silence: the work
 * looked fine right up until a reload threw it away. The one useful thing to offer at that moment
 * is the way out, so the export button is right here rather than a sentence pointing at the
 * toolbar.
 *
 * Not dismissible, unlike the storage notice: that one is general advice, this one is the state of
 * the work in front of them, and it goes away by itself the moment a save lands again.
 *
 * `role="alert"`: losing work on reload is the one message in this app worth interrupting for, and
 * an alert is announced when it appears — unlike a polite region, which has to exist first.
 */
export default function SaveFailedNotice() {
  const t = useT();
  const status = useSyncExternalStore(subscribeSaveStatus, getSaveStatus, serverSnapshot);
  const exportXlsx = useSheetStore((s) => s.exportXlsx);

  if (status === "ok") return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900"
    >
      <TriangleAlert size={14} className="shrink-0" />
      <p className="flex-1 leading-relaxed">{status === "full" ? t.saveFailed.full : t.saveFailed.blocked}</p>
      <button
        onClick={exportXlsx}
        className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-red-700 px-3 font-medium text-white hover:bg-red-800 sm:min-h-0 sm:py-1.5"
      >
        <FileDown size={14} /> {t.toolbar.exportExcel}
      </button>
    </div>
  );
}
