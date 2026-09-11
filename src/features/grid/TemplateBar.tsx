"use client";

import { FileLock2, Unlock } from "lucide-react";
import { useSheetStore } from "@/store/sheetStore";
import { inputCount } from "@/lib/sheetTemplate";
import { useT } from "@/i18n";

/** Says out loud that the open sheet is a form from a file, and how many cells are actually
 *  yours to fill. Without it a user meets a grid where most cells silently refuse to be typed
 *  in, which reads as the app being broken rather than the template doing its job. */
export default function TemplateBar() {
  const t = useT();
  const template = useSheetStore((s) => s.sheets.find((tab) => tab.id === s.activeSheetId)?.sheet.template);
  const unlockTemplate = useSheetStore((s) => s.unlockTemplate);

  if (!template) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      <span className="flex items-center gap-1.5 font-semibold">
        <FileLock2 size={14} /> {t.template.title}
      </span>
      <span className="rounded bg-amber-200/70 px-1.5 py-0.5 font-medium">{t.template.fieldCount(inputCount(template))}</span>
      <span className="text-amber-700">{t.template.hint}</span>
      <div className="flex-1" />
      <button
        onClick={() => {
          if (confirm(t.template.confirmUnlock)) unlockTemplate();
        }}
        className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 font-medium text-amber-900 hover:bg-amber-100"
      >
        <Unlock size={13} /> {t.template.unlock}
      </button>
    </div>
  );
}
