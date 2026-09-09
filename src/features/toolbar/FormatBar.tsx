"use client";

import { Bold, AlignLeft, AlignCenter, AlignRight, ArrowDownAZ, ArrowDownZA } from "lucide-react";
import { NumberFormat } from "@/lib/sheet";
import { useAnchorFormat, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import clsx from "clsx";

export default function FormatBar() {
  const t = useT();
  const format = useAnchorFormat();
  const toggleBold = useSheetStore((s) => s.toggleBold);
  const setAlign = useSheetStore((s) => s.setAlign);
  const setTextColor = useSheetStore((s) => s.setTextColor);
  const setNumberFormat = useSheetStore((s) => s.setNumberFormat);
  const sortSelection = useSheetStore((s) => s.sortSelection);

  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-1.5">
      <span className="text-xs font-medium text-zinc-400">{t.formatBar.label}</span>

      <button
        onClick={toggleBold}
        title={t.formatBar.boldTitle}
        className={clsx(
          "flex h-7 w-7 items-center justify-center rounded-md border",
          format.bold ? "border-blue-500 bg-blue-50 text-blue-700" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
        )}
      >
        <Bold size={14} />
      </button>

      <div className="flex overflow-hidden rounded-md border border-zinc-300">
        {(
          [
            { v: "left", Icon: AlignLeft },
            { v: "center", Icon: AlignCenter },
            { v: "right", Icon: AlignRight },
          ] as const
        ).map(({ v, Icon }) => (
          <button
            key={v}
            onClick={() => setAlign(v)}
            title={t.formatBar.alignTitle[v]}
            className={clsx(
              "flex h-7 w-7 items-center justify-center border-r border-zinc-300 last:border-r-0",
              (format.align ?? "left") === v ? "bg-blue-50 text-blue-700" : "text-zinc-600 hover:bg-zinc-50"
            )}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      <label title={t.formatBar.colorTitle} className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50">
        <span className="text-xs font-bold" style={{ color: format.color ?? "#18181b" }}>
          A
        </span>
        <input
          type="color"
          value={format.color ?? "#18181b"}
          onChange={(e) => setTextColor(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <select
        value={format.numberFormat ?? "general"}
        onChange={(e) => setNumberFormat(e.target.value as NumberFormat)}
        className="h-7 rounded-md border border-zinc-300 px-1.5 text-xs text-zinc-700 outline-none focus:border-blue-500"
      >
        {Object.entries(t.numberFormats).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <div className="mx-1 h-5 w-px bg-zinc-200" />

      <button
        onClick={() => sortSelection(true)}
        title={t.formatBar.sortAscTitle}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
      >
        <ArrowDownAZ size={14} />
      </button>
      <button
        onClick={() => sortSelection(false)}
        title={t.formatBar.sortDescTitle}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
      >
        <ArrowDownZA size={14} />
      </button>
    </div>
  );
}
