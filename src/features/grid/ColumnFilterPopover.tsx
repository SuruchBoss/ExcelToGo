"use client";

import { useState } from "react";
import { useColumnFilter, useSheetStore, useUniqueColumnValues } from "@/store/sheetStore";

interface Props {
  col: number;
  x: number;
  y: number;
  onClose: () => void;
}

export default function ColumnFilterPopover({ col, x, y, onClose }: Props) {
  const values = useUniqueColumnValues(col);
  const activeFilter = useColumnFilter(col);
  const setColumnFilter = useSheetStore((s) => s.setColumnFilter);
  const clearColumnFilter = useSheetStore((s) => s.clearColumnFilter);
  const [draft, setDraft] = useState<Set<string>>(new Set(activeFilter ?? values));

  const toggle = (v: string) => {
    const next = new Set(draft);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setDraft(next);
  };

  return (
    <div
      className="fixed z-50 w-56 rounded-md border border-zinc-200 bg-white p-2 text-sm shadow-lg"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 flex gap-3 text-xs">
        <button className="text-blue-600 hover:underline" onClick={() => setDraft(new Set(values))}>
          เลือกทั้งหมด
        </button>
        <button className="text-blue-600 hover:underline" onClick={() => setDraft(new Set())}>
          ล้างทั้งหมด
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto border-t border-zinc-100 pt-1.5">
        {values.map((v) => (
          <label key={v} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-zinc-50">
            <input type="checkbox" checked={draft.has(v)} onChange={() => toggle(v)} />
            <span className="truncate text-zinc-700">{v === "" ? "(ว่าง)" : v}</span>
          </label>
        ))}
        {values.length === 0 && <p className="px-1 py-2 text-center text-xs text-zinc-400">ไม่มีข้อมูลในคอลัมน์นี้</p>}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-zinc-100 pt-2">
        <button
          onClick={() => {
            clearColumnFilter(col);
            onClose();
          }}
          disabled={!activeFilter}
          className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ล้างตัวกรอง
        </button>
        <button
          onClick={() => {
            setColumnFilter(col, Array.from(draft));
            onClose();
          }}
          className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          ตกลง
        </button>
      </div>
    </div>
  );
}
