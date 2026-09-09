"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, FORMULA_CATALOG, FormulaDef } from "@/lib/formulaCatalog";
import clsx from "clsx";

interface Props {
  onPick: (def: FormulaDef) => void;
}

export default function FormulaPalette({ onPick }: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ทั้งหมด");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FORMULA_CATALOG.filter((f) => {
      if (activeCategory !== "ทั้งหมด" && f.category !== activeCategory) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div>
        <h2 className="text-sm font-semibold text-zinc-700">สูตรพร้อมใช้</h2>
        <p className="text-xs text-zinc-500">ลากสูตรไปวางบนเซลล์ หรือคลิกเพื่อใส่ในเซลล์ที่เลือกอยู่</p>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาสูตร เช่น รวม, เฉลี่ย, ค้นหา..."
        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
      />
      <div className="flex flex-wrap gap-1">
        {["ทั้งหมด", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={clsx(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              activeCategory === cat ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            )}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex flex-col gap-2">
          {filtered.map((f) => (
            <div
              key={f.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/formula-id", f.id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onPick(f)}
              className="cursor-grab rounded-md border border-zinc-200 bg-white p-2.5 text-left shadow-sm transition hover:border-blue-400 hover:shadow active:cursor-grabbing"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-800">{f.name}</span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                  {f.category}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">{f.description}</p>
              <code className="mt-1 block truncate text-[11px] text-blue-600">{f.example}</code>
            </div>
          ))}
          {filtered.length === 0 && <p className="p-4 text-center text-xs text-zinc-400">ไม่พบสูตรที่ค้นหา</p>}
        </div>
      </div>
    </div>
  );
}
