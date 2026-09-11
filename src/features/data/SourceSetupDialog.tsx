"use client";

import { useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { DEFAULT_MAX_ROWS } from "@/lib/dataSources/paginate";
import { PublicDataSource, TableData } from "@/lib/dataSources/types";
import { SourceDraft, useDataSourceStore } from "@/store/dataSourceStore";
import { useT } from "@/i18n";

interface Props {
  /** Undefined = creating a new source. */
  source?: PublicDataSource;
  onClose: () => void;
}

const MASKED = "••••••••";

function draftFrom(source?: PublicDataSource): SourceDraft {
  return {
    name: source?.name ?? "",
    type: source?.type ?? "rest",
    url: source?.url ?? "",
    method: source?.method ?? "GET",
    authHeader: source?.authHeader ? { name: source.authHeader.name, value: MASKED } : { name: "", value: "" },
    jsonPath: source?.jsonPath ?? "",
    maxRows: source?.maxRows ?? DEFAULT_MAX_ROWS,
    refreshSec: source?.refreshSec ?? 30,
  };
}

const inputCls = "w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500";
const labelCls = "text-xs font-medium text-zinc-600";

export default function SourceSetupDialog({ source, onClose }: Props) {
  const t = useT();
  const saveSource = useDataSourceStore((s) => s.saveSource);
  const testSource = useDataSourceStore((s) => s.testSource);
  const [draft, setDraft] = useState<SourceDraft>(() => draftFrom(source));
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: true; table: TableData } | { ok: false; error: string } | null>(null);

  const patch = (p: Partial<SourceDraft>) => setDraft((d) => ({ ...d, ...p }));
  const cleaned = (): SourceDraft => ({
    ...draft,
    authHeader: draft.authHeader?.name?.trim() ? draft.authHeader : undefined,
    jsonPath: draft.jsonPath?.trim() || undefined,
  });
  const canSubmit = draft.name.trim() !== "" && draft.url.trim() !== "";

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const table = await testSource(cleaned(), source?.id);
      setTestResult({ ok: true, table });
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : "failed" });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSource(cleaned(), source?.id);
      onClose();
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : "failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-800">{source ? t.data.setup.editTitle : t.data.setup.newTitle}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{t.data.setup.intro}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.data.setup.name}</span>
            <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder={t.data.setup.namePlaceholder} className={inputCls} />
          </label>

          <div className="flex flex-col gap-1">
            <span className={labelCls}>{t.data.setup.type}</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { v: "rest", label: t.data.setup.typeRest },
                  { v: "csv", label: t.data.setup.typeCsv },
                  { v: "db", label: t.data.setup.typeDb, disabled: true },
                ] as { v: string; label: string; disabled?: boolean }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  disabled={opt.disabled}
                  onClick={() => patch({ type: opt.v as SourceDraft["type"] })}
                  className={clsx(
                    "rounded-md border px-2 py-1.5 text-xs font-medium",
                    opt.disabled && "cursor-not-allowed opacity-40",
                    draft.type === opt.v ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{t.data.setup.url}</span>
              <input value={draft.url} onChange={(e) => patch({ url: e.target.value })} placeholder={t.data.setup.urlPlaceholder} className={clsx(inputCls, "font-mono text-xs")} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{t.data.setup.method}</span>
              <select value={draft.method} onChange={(e) => patch({ method: e.target.value as "GET" | "POST" })} className={inputCls}>
                <option>GET</option>
                <option>POST</option>
              </select>
            </label>
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className={labelCls}>{t.data.setup.auth}</p>
            <p className="mb-2 text-[11px] text-zinc-400">{t.data.setup.authHint}</p>
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <input
                value={draft.authHeader?.name ?? ""}
                onChange={(e) => patch({ authHeader: { name: e.target.value, value: draft.authHeader?.value ?? "" } })}
                placeholder={t.data.setup.authName}
                className={clsx(inputCls, "font-mono text-xs")}
              />
              <input
                type="password"
                value={draft.authHeader?.value ?? ""}
                onChange={(e) => patch({ authHeader: { name: draft.authHeader?.name ?? "", value: e.target.value } })}
                placeholder={t.data.setup.authValue}
                className={clsx(inputCls, "font-mono text-xs")}
              />
            </div>
          </div>

          {draft.type === "rest" && (
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{t.data.setup.jsonPath}</span>
              <input value={draft.jsonPath ?? ""} onChange={(e) => patch({ jsonPath: e.target.value })} placeholder="data.items" className={clsx(inputCls, "font-mono text-xs")} />
              <span className="text-[11px] text-zinc-400">{t.data.setup.jsonPathHint}</span>
            </label>
          )}

          {draft.type === "rest" && (
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{t.data.setup.maxRows}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={50000}
                  step={100}
                  value={draft.maxRows ?? DEFAULT_MAX_ROWS}
                  onChange={(e) => patch({ maxRows: Number(e.target.value) })}
                  className={clsx(inputCls, "w-28")}
                />
                <span className="text-xs text-zinc-500">{t.data.setup.maxRowsUnit}</span>
              </div>
              <span className="text-[11px] text-zinc-400">{t.data.setup.maxRowsHint}</span>
            </label>
          )}

          <label className="flex items-center gap-2">
            <span className={labelCls}>{t.data.setup.refresh}</span>
            <input
              type="number"
              min={2}
              max={3600}
              value={draft.refreshSec}
              onChange={(e) => patch({ refreshSec: Number(e.target.value) })}
              className={clsx(inputCls, "w-24")}
            />
            <span className="text-xs text-zinc-500">{t.data.setup.refreshUnit}</span>
          </label>

          {testResult && (
            <div className={clsx("rounded-md p-2 text-xs", testResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600")}>
              {testResult.ok
                ? [
                    t.data.setup.testOk(testResult.table.rows.length, testResult.table.columns.length),
                    (testResult.table.pageCount ?? 1) > 1 ? t.data.setup.testPages(testResult.table.pageCount ?? 1) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : `${t.data.setup.testFailed}: ${testResult.error}`}
              {testResult.ok && testResult.table.truncated && (
                <p className="mt-1 font-medium text-amber-700">⚠ {t.data.setup.testTruncated}</p>
              )}
              {testResult.ok && testResult.table.columns.length > 0 && (
                <p className="mt-1 truncate text-[11px] text-emerald-600">{testResult.table.columns.map((c) => c.label).join(" · ")}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-zinc-200 px-5 py-3">
          <button
            onClick={() => void runTest()}
            disabled={!canSubmit || testing}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? t.data.setup.testing : t.data.setup.test}
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
            {t.data.setup.cancel}
          </button>
          <button
            onClick={() => void save()}
            disabled={!canSubmit || saving}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? t.data.setup.saving : t.data.setup.save}
          </button>
        </div>
      </div>
    </div>
  );
}
