"use client";

import { useState } from "react";
import { Palette, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  CF_BAR_COLOR,
  CF_PRESET_STYLES,
  CF_SCALE_PRESETS,
  CfComparison,
  CfStyle,
  CfTest,
} from "@/lib/conditionalFormat";
import { rangeRefString } from "@/lib/formulaEngine/address";
import { selectActiveSelection, selectActiveSheet, useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

type CfKind = CfTest["kind"];

const KINDS: CfKind[] = ["compare", "textContains", "rank", "colorScale", "dataBar"];
const OPERATORS: CfComparison[] = ["gt", "lt", "gte", "lte", "eq", "ne", "between"];
const SCALE_KEYS = ["redGreen", "greenRed", "whiteBlue"] as const;

/** A swatch that shows what a rule will actually look like, since a colour name alone
 *  ("amber") doesn't tell anyone whether the text will still be readable on it. */
function StyleSwatch({ style, selected, label, onClick }: { style: CfStyle; selected: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={clsx(
        "flex h-7 flex-1 items-center justify-center rounded-md border text-xs font-semibold",
        selected ? "border-emerald-600 ring-1 ring-emerald-600" : "border-zinc-300"
      )}
      style={{ backgroundColor: style.fill, color: style.color }}
    >
      123
    </button>
  );
}

export default function ConditionalFormatPanel() {
  const t = useT();
  const sheet = useSheetStore(selectActiveSheet);
  const selection = useSheetStore(selectActiveSelection);
  const addRule = useSheetStore((s) => s.addConditionalRule);
  const removeRule = useSheetStore((s) => s.removeConditionalRule);
  const clearRules = useSheetStore((s) => s.clearConditionalRules);

  const [kind, setKind] = useState<CfKind>("compare");
  const [op, setOp] = useState<CfComparison>("gt");
  const [value, setValue] = useState("0");
  const [value2, setValue2] = useState("100");
  const [text, setText] = useState("");
  const [count, setCount] = useState("3");
  const [bottom, setBottom] = useState(false);
  const [scale, setScale] = useState<(typeof SCALE_KEYS)[number]>("redGreen");
  const [styleId, setStyleId] = useState(CF_PRESET_STYLES[0].id);

  const rules = sheet.conditionalRules ?? [];
  const rangeLabel = rangeRefString(selection.startRow, selection.startCol, selection.endRow, selection.endCol);
  const chosenStyle = CF_PRESET_STYLES.find((p) => p.id === styleId)?.style ?? CF_PRESET_STYLES[0].style;
  const needsStyle = kind === "compare" || kind === "textContains" || kind === "rank";

  function submit() {
    const num = Number(value);
    const num2 = Number(value2);
    let test: CfTest;
    switch (kind) {
      case "compare":
        // A blank or half-typed number would make a rule that silently matches nothing.
        if (!Number.isFinite(num)) return;
        test = { kind: "compare", op, value: num, value2: op === "between" && Number.isFinite(num2) ? num2 : undefined };
        break;
      case "textContains":
        if (text.trim() === "") return;
        test = { kind: "textContains", text: text.trim() };
        break;
      case "rank": {
        const n = Math.max(1, Math.round(Number(count)));
        if (!Number.isFinite(n)) return;
        test = { kind: "rank", bottom, count: n };
        break;
      }
      case "colorScale": {
        const preset = CF_SCALE_PRESETS[scale];
        test = { kind: "colorScale", min: preset.min, max: preset.max, mid: "mid" in preset ? preset.mid : undefined };
        break;
      }
      case "dataBar":
        test = { kind: "dataBar", color: CF_BAR_COLOR };
        break;
    }
    addRule(test, needsStyle ? chosenStyle : undefined);
  }

  const fieldClass = "h-8 w-full rounded-md border border-zinc-300 px-2 text-sm text-zinc-800 outline-none focus:border-emerald-500";

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
          <Palette size={15} className="text-emerald-700" />
          {t.conditionalFormat.title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t.conditionalFormat.subtitle}</p>
      </div>

      <div className="rounded-lg border border-zinc-200 p-3">
        <p className="text-xs font-medium text-emerald-800">{t.conditionalFormat.appliesTo(rangeLabel)}</p>

        <label className="mt-3 block text-xs font-medium text-zinc-600">{t.conditionalFormat.kindLabel}</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as CfKind)} className={clsx(fieldClass, "mt-1")}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t.conditionalFormat.kinds[k]}
            </option>
          ))}
        </select>

        {kind === "compare" && (
          <div className="mt-2 flex flex-col gap-2">
            <select value={op} onChange={(e) => setOp(e.target.value as CfComparison)} className={fieldClass}>
              {OPERATORS.map((o) => (
                <option key={o} value={o}>
                  {t.conditionalFormat.operators[o]}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input type="number" value={value} onChange={(e) => setValue(e.target.value)} className={fieldClass} aria-label={t.conditionalFormat.valueLabel} />
              {op === "between" && (
                <>
                  <span className="shrink-0 text-xs text-zinc-500">{t.conditionalFormat.value2Label}</span>
                  <input type="number" value={value2} onChange={(e) => setValue2(e.target.value)} className={fieldClass} aria-label={t.conditionalFormat.value2Label} />
                </>
              )}
            </div>
          </div>
        )}

        {kind === "textContains" && (
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.conditionalFormat.textLabel}
            aria-label={t.conditionalFormat.textLabel}
            className={clsx(fieldClass, "mt-2")}
          />
        )}

        {kind === "rank" && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-zinc-300">
              {[false, true].map((isBottom) => (
                <button
                  key={String(isBottom)}
                  type="button"
                  onClick={() => setBottom(isBottom)}
                  className={clsx(
                    "h-8 border-r border-zinc-300 px-2.5 text-xs last:border-r-0",
                    bottom === isBottom ? "bg-emerald-50 font-medium text-emerald-700" : "text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  {isBottom ? t.conditionalFormat.bottomLabel : t.conditionalFormat.topLabel}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              aria-label={t.conditionalFormat.countLabel}
              className={fieldClass}
            />
          </div>
        )}

        {kind === "colorScale" && (
          <select value={scale} onChange={(e) => setScale(e.target.value as typeof scale)} className={clsx(fieldClass, "mt-2")}>
            {SCALE_KEYS.map((k) => (
              <option key={k} value={k}>
                {t.conditionalFormat.scales[k]}
              </option>
            ))}
          </select>
        )}

        {needsStyle && (
          <>
            <label className="mt-3 block text-xs font-medium text-zinc-600">{t.conditionalFormat.styleLabel}</label>
            <div className="mt-1 flex gap-1.5">
              {CF_PRESET_STYLES.map((preset) => (
                <StyleSwatch
                  key={preset.id}
                  style={preset.style}
                  selected={styleId === preset.id}
                  label={t.conditionalFormat.styleNames[preset.id as keyof typeof t.conditionalFormat.styleNames]}
                  onClick={() => setStyleId(preset.id)}
                />
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={submit}
          className="mt-3 h-8 w-full rounded-md bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          {t.conditionalFormat.add}
        </button>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-600">{t.conditionalFormat.ruleCount(rules.length)}</span>
          <div className="flex-1" />
          {rules.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm(t.conditionalFormat.confirmClear)) clearRules();
              }}
              className="text-xs text-zinc-500 underline-offset-2 hover:text-red-700 hover:underline"
            >
              {t.conditionalFormat.clearAll}
            </button>
          )}
        </div>

        {rules.length === 0 ? (
          <p className="mt-2 rounded-md border border-dashed border-zinc-300 p-3 text-xs text-zinc-500">{t.conditionalFormat.empty}</p>
        ) : (
          <>
            <ul className="mt-2 flex flex-col gap-1.5">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5">
                  <span
                    className="flex h-6 w-8 shrink-0 items-center justify-center rounded text-[11px] font-semibold"
                    style={{
                      backgroundColor:
                        rule.style?.fill ??
                        (rule.test.kind === "colorScale" ? rule.test.max : rule.test.kind === "dataBar" ? rule.test.color : undefined),
                      color: rule.style?.color ?? "#3f3f46",
                    }}
                  >
                    123
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-zinc-800">{t.conditionalFormat.describe(rule.test)}</p>
                    <p className="text-[11px] text-zinc-500">
                      {rangeRefString(rule.range.startRow, rule.range.startCol, rule.range.endRow, rule.range.endCol)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRule(rule.id)}
                    title={t.conditionalFormat.remove}
                    className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
            {rules.length > 1 && <p className="mt-2 text-[11px] text-zinc-500">{t.conditionalFormat.orderNote}</p>}
          </>
        )}
      </div>
    </div>
  );
}
