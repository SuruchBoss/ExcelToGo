"use client";

import { Bold, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { NUMBER_FORMAT_LABELS, NumberFormat } from "@/lib/sheet";
import { useAnchorFormat, useSheetStore } from "@/store/sheetStore";
import clsx from "clsx";

export default function FormatBar() {
  const format = useAnchorFormat();
  const toggleBold = useSheetStore((s) => s.toggleBold);
  const setAlign = useSheetStore((s) => s.setAlign);
  const setTextColor = useSheetStore((s) => s.setTextColor);
  const setNumberFormat = useSheetStore((s) => s.setNumberFormat);

  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-1.5">
      <span className="text-xs font-medium text-zinc-400">จัดรูปแบบ:</span>

      <button
        onClick={toggleBold}
        title="ตัวหนา"
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
            title={`จัดตำแหน่ง${v === "left" ? "ซ้าย" : v === "center" ? "กลาง" : "ขวา"}`}
            className={clsx(
              "flex h-7 w-7 items-center justify-center border-r border-zinc-300 last:border-r-0",
              (format.align ?? "left") === v ? "bg-blue-50 text-blue-700" : "text-zinc-600 hover:bg-zinc-50"
            )}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      <label title="สีข้อความ" className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50">
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
        {Object.entries(NUMBER_FORMAT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
