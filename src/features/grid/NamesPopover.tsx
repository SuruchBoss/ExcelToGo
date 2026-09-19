"use client";

import { useRef, useState } from "react";
import { Tag, Trash2 } from "lucide-react";
import { listNames, type NameProblem } from "@/lib/namedRanges";
import { selectActiveSelection, selectActiveSheet, useSheetStore } from "@/store/sheetStore";
import { rangeRefString } from "@/lib/formulaEngine/address";
import { useT } from "@/i18n";
import { useClickAway } from "./useClickAway";

/**
 * Names the selected range, and lists the names this sheet already has.
 *
 * The list is half the feature. A name nobody can find is a name that gets defined twice under two
 * spellings, and the formula bar only ever shows the one being used right now — so the panel that
 * creates them is also the only place the set of them is visible.
 */
export default function NamesPopover({ anchor, onClose }: { anchor: { x: number; y: number }; onClose: () => void }) {
  const t = useT();
  const sheet = useSheetStore(selectActiveSheet);
  const selection = useSheetStore(selectActiveSelection);
  const defineName = useSheetStore((s) => s.defineName);
  const deleteName = useSheetStore((s) => s.deleteName);
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<NameProblem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useClickAway(true, onClose);

  const names = listNames(sheet.names);
  const here = rangeRefString(selection.startRow, selection.startCol, selection.endRow, selection.endCol);

  const submit = () => {
    const failed = defineName(draft);
    setProblem(failed);
    if (!failed) {
      setDraft("");
      inputRef.current?.focus();
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      aria-label={t.names.title}
      className="fixed z-50 w-80 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl"
      style={{ left: anchor.x, top: anchor.y }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Tag size={14} className="text-sky-600" />
        <span className="text-xs font-semibold text-zinc-800">{t.names.title}</span>
      </div>
      <p className="mb-2.5 text-[11px] leading-relaxed text-zinc-500">{t.names.subtitle}</p>

      <label className="block text-[11px] font-medium text-zinc-600">
        {t.names.nameLabel}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setProblem(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={t.names.namePlaceholder}
          aria-invalid={problem !== null}
          aria-describedby={problem ? "name-problem" : undefined}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-normal outline-none focus:border-emerald-500"
        />
      </label>
      <p className="mt-1 font-mono text-[11px] text-zinc-500">{t.names.refersTo(here)}</p>
      {problem && (
        <p id="name-problem" role="alert" className="mt-1 text-[11px] leading-relaxed text-red-700">
          {t.names.problem[problem]}
        </p>
      )}

      <button
        onClick={submit}
        className="mt-2 min-h-9 w-full rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 sm:min-h-0 sm:py-1.5"
      >
        {t.names.add}
      </button>

      <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto border-t border-zinc-100 pt-2">
        {names.length === 0 && <li className="text-[11px] text-zinc-500">{t.names.empty}</li>}
        {names.map((entry) => (
          <li key={entry.key} className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-800">{entry.label}</span>
            <span className="shrink-0 font-mono text-[11px] text-zinc-500">{entry.ref}</span>
            <button
              onClick={() => deleteName(entry.label)}
              title={t.names.remove(entry.label)}
              aria-label={t.names.remove(entry.label)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-700 sm:h-6 sm:w-6"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] text-zinc-500">{t.names.hint}</p>
    </div>
  );
}
