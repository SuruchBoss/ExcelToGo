// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import {
  DEFAULT_SEARCH_OPTIONS,
  findMatches,
  matchLabel,
  nextMatchFrom,
  type SearchOptions,
} from "@/lib/sheetSearch";

/**
 * Find and replace.
 *
 * A bar pinned to the top-right rather than a modal, because unlike the shortcut sheet this one is
 * used *against* the sheet: you need to see the cell it lands on. Nothing here traps focus for the
 * same reason — Tab out to the grid and back is a normal thing to want mid-search.
 */
export default function FindPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const sheets = useSheetStore((s) => s.sheets);
  const activeSheetId = useSheetStore((s) => s.activeSheetId);
  const selection = useSheetStore((s) => s.selectionBySheetId[s.activeSheetId]);
  const goToMatch = useSheetStore((s) => s.goToMatch);
  const replaceOne = useSheetStore((s) => s.replaceOne);
  const replaceAll = useSheetStore((s) => s.replaceAll);

  const [needle, setNeedle] = useState("");
  const [replacement, setReplacement] = useState("");
  const [options, setOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [current, setCurrent] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const matches = useMemo(() => {
    const searchable = sheets.map((tab) => ({ id: tab.id, name: tab.name, sheet: tab.sheet }));
    const scope = options.allSheets ? searchable : searchable.filter((tab) => tab.id === activeSheetId);
    return findMatches(scope, needle, options);
  }, [sheets, activeSheetId, needle, options]);

  const step = (direction: 1 | -1) => {
    if (matches.length === 0) return;
    const from = selection ? { sheetId: activeSheetId, row: selection.anchorRow, col: selection.anchorCol } : null;
    const i = nextMatchFrom(matches, from, direction);
    if (i === -1) return;
    setCurrent(i);
    goToMatch(matches[i]);
  };

  const onReplace = () => {
    // The match under the cursor, not `current`: the sheet may have been edited since the last
    // press, and an index into a list that has since got shorter points at the wrong cell.
    const from = selection ? { sheetId: activeSheetId, row: selection.anchorRow, col: selection.anchorCol } : null;
    const here = matches.findIndex(
      (m) => from && m.sheetId === from.sheetId && m.row === from.row && m.col === from.col
    );
    if (here === -1) {
      step(1);
      return;
    }
    replaceOne(matches[here], needle, replacement, options);
    step(1);
  };

  const toggle = (key: keyof SearchOptions, label: string) => (
    <label className="flex items-center gap-1.5 text-[11px] text-zinc-600">
      <input
        type="checkbox"
        checked={options[key]}
        onChange={(e) => {
          setOptions((o) => ({ ...o, [key]: e.target.checked }));
          setCurrent(-1);
        }}
        className="h-3.5 w-3.5 rounded border-zinc-300"
      />
      {label}
    </label>
  );

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      className="absolute right-3 top-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-zinc-200 bg-white p-3 shadow-xl"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id={titleId} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
          <Search size={14} className="text-emerald-600" /> {t.find.title}
        </h2>
        <button
          onClick={onClose}
          aria-label={t.find.close}
          className="-mr-1 flex min-h-11 min-w-11 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 sm:min-h-7 sm:min-w-7"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          value={needle}
          onChange={(e) => {
            setNeedle(e.target.value);
            setCurrent(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder={t.find.searchPlaceholder}
          aria-label={t.find.searchPlaceholder}
          className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
        />
        <button
          onClick={() => step(-1)}
          disabled={matches.length === 0}
          aria-label={t.find.previous}
          title={t.find.previous}
          className="flex min-h-11 min-w-11 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 sm:min-h-8 sm:min-w-8"
        >
          <ChevronUp size={15} />
        </button>
        <button
          onClick={() => step(1)}
          disabled={matches.length === 0}
          aria-label={t.find.next}
          title={t.find.next}
          className="flex min-h-11 min-w-11 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 sm:min-h-8 sm:min-w-8"
        >
          <ChevronDown size={15} />
        </button>
      </div>

      <div className="mt-1.5 flex gap-1.5">
        <input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder={t.find.replacePlaceholder}
          aria-label={t.find.replacePlaceholder}
          className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
        />
        <button
          onClick={onReplace}
          disabled={matches.length === 0}
          className="shrink-0 rounded border border-zinc-300 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
        >
          {t.find.replace}
        </button>
        <button
          onClick={() => {
            replaceAll(needle, replacement, options);
            setCurrent(-1);
          }}
          disabled={matches.length === 0}
          className="shrink-0 rounded bg-emerald-700 px-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
        >
          {t.find.replaceAll}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {toggle("matchCase", t.find.matchCase)}
        {toggle("wholeCell", t.find.wholeCell)}
        {toggle("allSheets", t.find.allSheets)}
      </div>

      {/* A live region of its own: the count changes as you type, and a screen reader needs to hear
          "no matches" without having to go looking for it. */}
      <p role="status" aria-live="polite" className="mt-2 min-h-4 text-[11px] text-zinc-500">
        {needle === ""
          ? t.find.hint
          : matches.length === 0
            ? t.find.noMatches
            : current < 0
              ? t.find.found(matches.length)
              : t.find.count(current + 1, matches.length, matchLabel(matches[current]))}
      </p>
    </div>
  );
}
