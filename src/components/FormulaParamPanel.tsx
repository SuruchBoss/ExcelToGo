"use client";

import { FormulaDef } from "@/lib/formulaCatalog";
import { ApplyScope } from "@/lib/sheet";
import { cellRef } from "@/lib/formulaEngine/address";
import { SelectionRect, isSingleCell } from "@/types/sheet-ui";
import { Crosshair, X } from "lucide-react";
import clsx from "clsx";

export interface PendingFormula {
  def: FormulaDef;
  anchorRow: number;
  anchorCol: number;
  values: Record<string, string>;
  pickingKey: string | null;
  scope: ApplyScope;
}

interface Props {
  pending: PendingFormula;
  selection: SelectionRect;
  onChange: (pending: PendingFormula) => void;
  onInsert: () => void;
  onCancel: () => void;
}

export default function FormulaParamPanel({ pending, selection, onChange, onInsert, onCancel }: Props) {
  const { def, values } = pending;
  const anchorAddress = cellRef(pending.anchorRow, pending.anchorCol);
  const selectionIsRange = !isSingleCell(selection);

  const preview = (() => {
    try {
      return `=${def.build(values)}`;
    } catch {
      return "=?";
    }
  })();

  const missingRequired = def.params.some((p) => !p.optional && !(values[p.key] ?? "").trim());

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800">{def.name}</h2>
          <code className="text-xs text-zinc-500">{def.syntax}</code>
        </div>
        <button onClick={onCancel} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-zinc-500">{def.description}</p>

      <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-600">
        กำลังใส่สูตรที่เซลล์ <span className="font-semibold text-blue-700">{anchorAddress}</span>
      </div>

      <div className="flex flex-col gap-3">
        {def.params.map((p) => (
          <div key={p.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-600">
              {p.label}
              {!p.optional && <span className="text-red-500"> *</span>}
            </label>
            {p.options ? (
              <select
                value={values[p.key] ?? p.defaultValue ?? ""}
                onChange={(e) => onChange({ ...pending, values: { ...values, [p.key]: e.target.value } })}
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
              >
                {p.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex gap-1">
                <input
                  value={values[p.key] ?? ""}
                  onChange={(e) => onChange({ ...pending, values: { ...values, [p.key]: e.target.value } })}
                  placeholder={p.placeholder}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                />
                {(p.type === "range" || p.type === "cell") && (
                  <button
                    title="เลือกช่วงจากตาราง"
                    onClick={() =>
                      onChange({ ...pending, pickingKey: pending.pickingKey === p.key ? null : p.key })
                    }
                    className={clsx(
                      "flex shrink-0 items-center justify-center rounded-md border px-2",
                      pending.pickingKey === p.key
                        ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                        : "border-zinc-300 text-zinc-500 hover:bg-zinc-50"
                    )}
                  >
                    <Crosshair size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {def.params.length === 0 && <p className="text-xs text-zinc-400">สูตรนี้ไม่ต้องการพารามิเตอร์</p>}
        {pending.pickingKey && (
          <p className="rounded bg-emerald-50 p-2 text-xs text-emerald-700">
            คลิกหรือลากเลือกเซลล์ในตารางเพื่อเลือกช่วง — แถวและคอลัมน์ที่เลือกจะถูกไฮไลต์ให้เห็นชัดเจน
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600">ใส่สูตรนี้ให้กับ</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { v: "cell", label: "เซลล์นี้เท่านั้น" },
              { v: "row", label: "ทั้งแถว" },
              { v: "column", label: "ทั้งคอลัมน์" },
              { v: "selection", label: "ช่วงที่เลือกไว้", disabled: !selectionIsRange },
            ] as { v: ApplyScope; label: string; disabled?: boolean }[]
          ).map((opt) => (
            <button
              key={opt.v}
              disabled={opt.disabled}
              onClick={() => onChange({ ...pending, scope: opt.v })}
              className={clsx(
                "rounded-md border px-2 py-1.5 text-xs font-medium",
                opt.disabled && "cursor-not-allowed opacity-40",
                pending.scope === opt.v && !opt.disabled
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">ตัวอย่างสูตร</p>
        <code className="text-sm text-zinc-800">{preview}</code>
      </div>

      <div className="mt-auto flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
        >
          ยกเลิก
        </button>
        <button
          onClick={onInsert}
          disabled={missingRequired}
          className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ใส่สูตร
        </button>
      </div>
    </div>
  );
}
