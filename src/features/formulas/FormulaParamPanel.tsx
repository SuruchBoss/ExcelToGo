"use client";

import { ApplyScope } from "@/lib/sheet";
import { cellRef } from "@/lib/formulaEngine/address";
import { isSingleCell } from "@/types/sheet-ui";
import { selectActiveSelection, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import { Crosshair, X } from "lucide-react";
import clsx from "clsx";

export default function FormulaParamPanel() {
  const t = useT();
  const pending = useSheetStore((s) => s.pending);
  const selection = useSheetStore(selectActiveSelection);
  const onChange = useSheetStore((s) => s.updatePending);
  const onInsert = useSheetStore((s) => s.insertPending);
  const onCancel = useSheetStore((s) => s.cancelPending);

  if (!pending) return null;
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
        <button onClick={onCancel} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-600">
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-zinc-500">{def.description}</p>

      <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-600">
        {t.paramPanel.insertingAt} <span className="font-semibold text-emerald-700">{anchorAddress}</span>
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
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
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
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                />
                {(p.type === "range" || p.type === "cell") && (
                  <button
                    title={t.paramPanel.pickRangeTitle}
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
        {def.params.length === 0 && <p className="text-xs text-zinc-500">{t.paramPanel.noParams}</p>}
        {pending.pickingKey && (
          <p className="rounded bg-emerald-50 p-2 text-xs text-emerald-700">{t.paramPanel.pickingHint}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600">{t.paramPanel.applyToLabel}</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { v: "cell", label: t.paramPanel.scopeCell },
              { v: "row", label: t.paramPanel.scopeRow },
              { v: "column", label: t.paramPanel.scopeColumn },
              { v: "selection", label: t.paramPanel.scopeSelection, disabled: !selectionIsRange },
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
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t.paramPanel.previewLabel}</p>
        <code className="text-sm text-zinc-800">{preview}</code>
      </div>

      <div className="mt-auto flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
        >
          {t.paramPanel.cancel}
        </button>
        <button
          onClick={onInsert}
          disabled={missingRequired}
          className="flex-1 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.paramPanel.insert}
        </button>
      </div>
    </div>
  );
}
