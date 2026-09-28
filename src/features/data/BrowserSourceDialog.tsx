// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { DEFAULT_MAX_ROWS } from "@/lib/dataSources/paginate";
import { MAX_ROWS_CEILING } from "@/lib/dataSources/fetchLimits";
import { BrowserFetchError, BrowserSourceConfig, checkUrl, hasSecretInQuery, isHeaderName, isHeaderValue } from "@/lib/dataSources/browserSource";
import { readSecret } from "@/lib/dataSources/browserSecrets";
import type { TableData } from "@/lib/dataSources/types";
import { BrowserSourceDraft, ErrorDetail, useDataSourceStore } from "@/store/dataSourceStore";
import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import { useDialogKeys } from "@/features/a11y/useDialogKeys";
import { hostOf, needsReload, reloadToAllow } from "./allowOrigin";
import BrowserSourceError, { BROWSER_CODES } from "./BrowserSourceError";
import { partialHintText, sourceErrorText } from "./sourceError";

interface Props {
  /** Undefined = a new source. */
  source?: BrowserSourceConfig;
  /** A draft brought back across the reload that allowed its origin, to be tested at once. */
  resume?: { draft: BrowserSourceDraft; headerValue: string };
  /** A form filled in for a sample API — nothing is run until the person presses Test. */
  preset?: BrowserSourceDraft;
  onClose: () => void;
}

const inputCls = "w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500";
const labelCls = "text-xs font-medium text-zinc-600";

function draftFrom(source?: BrowserSourceConfig): BrowserSourceDraft {
  return {
    name: source?.name ?? "",
    type: source?.type ?? "rest",
    url: source?.url ?? "",
    headerName: source?.headerName ?? "",
    jsonPath: source?.jsonPath ?? "",
    maxRows: source?.maxRows ?? DEFAULT_MAX_ROWS,
    refreshSec: source?.refreshSec ?? 60,
  };
}

type Result = { ok: true; table: TableData } | { ok: false; code: string; detail?: ErrorDetail };

/**
 * Connecting an API from this browser (#110): name, URL, an optional auth header, where the rows
 * are, how often to refresh — then Test, which shows rows × columns and the first five rows, and
 * Save, which puts the source in the sheet.
 *
 * The first time an origin is used the page has to reload once so its CSP names it; the buttons say
 * so before they are pressed, and the form comes back after the reload with the test running.
 */
export default function BrowserSourceDialog({ source, resume, preset, onClose }: Props) {
  const t = useT();
  const b = t.data.browser;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogKeys(panelRef, onClose);
  const saveBrowserSource = useDataSourceStore((s) => s.saveBrowserSource);
  const testBrowserSource = useDataSourceStore((s) => s.testBrowserSource);
  const openPicker = useSheetStore((s) => s.openDataPicker);
  const [draft, setDraft] = useState<BrowserSourceDraft>(() => resume?.draft ?? preset ?? draftFrom(source));
  const [headerValue, setHeaderValue] = useState(() => resume?.headerValue ?? "");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const patch = (p: Partial<BrowserSourceDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setResult(null);
  };

  const url = draft.url.trim();
  const checked = url ? checkUrl(url) : null;
  const urlProblem = checked && !checked.ok ? checked.code : null;
  const headerName = draft.headerName?.trim() ?? "";
  const badHeader = headerName !== "" && !isHeaderName(headerName);
  const badValue = !isHeaderValue(headerValue);
  // An existing source keeps the value this tab holds when the field is left blank.
  const effectiveValue = headerValue || (source ? readSecret(source.id) : "");
  const canSubmit = draft.name.trim() !== "" && checked?.ok === true && !badHeader && !badValue;
  const reload = url !== "" && checked?.ok === true && needsReload(url);

  const runTest = async (d = draft, value = effectiveValue) => {
    setTesting(true);
    setResult(null);
    try {
      setResult({ ok: true, table: await testBrowserSource(d, value) });
    } catch (err) {
      setResult(
        err instanceof BrowserFetchError
          ? { ok: false, code: err.code, detail: err.detail }
          : { ok: false, code: err instanceof Error ? ("code" in err ? String(err.code) : err.message) : "failed" }
      );
    } finally {
      setTesting(false);
    }
  };

  // Back from the reload that allowed this origin: run the test the person had asked for.
  const resumed = useRef(false);
  useEffect(() => {
    if (!resume || resumed.current) return;
    resumed.current = true;
    void runTest(resume.draft, resume.headerValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allow = (pending: Parameters<typeof reloadToAllow>[1]) => {
    if (reloadToAllow(url, pending)) setNotice(b.reloading(hostOf(url)));
    else setNotice(b.reloadBlocked);
  };

  const onTest = () => {
    if (reload) allow({ action: "test", draft, headerValue: effectiveValue, id: source?.id });
    else void runTest();
  };

  const onSave = () => {
    const saved = saveBrowserSource(draft, headerValue, source?.id);
    if (reload) {
      allow({ action: "insert", sourceId: saved.id });
      return;
    }
    onClose();
    // A new source goes straight to the picker — "save" is only half of what the person came to do.
    if (!source) openPicker({ sourceId: saved.id });
  };

  const table = result?.ok ? result.table : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        ref={panelRef}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-zinc-800">{source ? b.editTitle : b.newTitle}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{b.intro}</p>
          </div>
          <button onClick={onClose} aria-label={t.app.close} title={t.app.close} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-600">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>{b.name}</span>
            <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder={b.namePlaceholder} className={inputCls} />
          </label>

          <div className="flex flex-col gap-1">
            <span className={labelCls}>{b.type}</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { v: "rest", label: b.typeJson },
                  { v: "csv", label: b.typeCsv },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => patch({ type: opt.v })}
                  aria-pressed={draft.type === opt.v}
                  className={clsx(
                    "rounded-md border px-2.5 py-1.5 text-left text-xs font-medium",
                    draft.type === opt.v ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>{b.url}</span>
            <input
              value={draft.url}
              onChange={(e) => patch({ url: e.target.value })}
              placeholder={b.urlPlaceholder}
              inputMode="url"
              spellCheck={false}
              className={inputCls}
              aria-describedby={urlProblem ? `${titleId}-url` : undefined}
            />
            {urlProblem && (
              <span id={`${titleId}-url`} className="text-xs text-red-700">
                {urlProblem === "insecure_http" ? b.insecureHttp : b.invalidUrl}
              </span>
            )}
            {!urlProblem && hasSecretInQuery(url) && <span className="text-xs text-amber-800">⚠ {b.secretInQuery}</span>}
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={labelCls}>{b.header}</legend>
            <div className="grid grid-cols-[2fr_3fr] gap-1.5">
              <input
                value={draft.headerName}
                onChange={(e) => patch({ headerName: e.target.value })}
                placeholder="Authorization"
                aria-label={b.headerName}
                spellCheck={false}
                className={inputCls}
              />
              <input
                type="password"
                value={headerValue}
                onChange={(e) => {
                  setHeaderValue(e.target.value);
                  setResult(null);
                }}
                placeholder={source?.headerName ? b.headerValueKeep : b.headerValue}
                aria-label={b.headerValue}
                autoComplete="off"
                className={inputCls}
              />
            </div>
            {badHeader && <span className="text-xs text-red-700">{b.badHeaderName}</span>}
            {badValue && <span className="text-xs text-red-700">{b.badHeaderValue}</span>}
            <span className="text-[11px] text-zinc-600">{b.headerHint}</span>
          </fieldset>

          {draft.type === "rest" && (
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{b.jsonPath}</span>
              <input value={draft.jsonPath} onChange={(e) => patch({ jsonPath: e.target.value })} placeholder="data.items" spellCheck={false} className={inputCls} />
              <span className="text-[11px] text-zinc-600">{b.jsonPathHint}</span>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{b.maxRows}</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={MAX_ROWS_CEILING}
                  value={draft.maxRows ?? DEFAULT_MAX_ROWS}
                  onChange={(e) => patch({ maxRows: Math.min(MAX_ROWS_CEILING, Math.max(0, Number(e.target.value) || 0)) })}
                  className={inputCls}
                />
                <span className="text-xs text-zinc-600">{b.rows}</span>
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{b.refresh}</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={5}
                  value={draft.refreshSec}
                  onChange={(e) => patch({ refreshSec: Math.max(5, Number(e.target.value) || 5) })}
                  className={inputCls}
                />
                <span className="text-xs text-zinc-600">{b.seconds}</span>
              </span>
            </label>
          </div>

          {reload && <p className="rounded-md bg-sky-50 px-2.5 py-2 text-xs text-sky-900">{b.reloadNotice(hostOf(url))}</p>}
          {notice && (
            <p role="status" className="rounded-md bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-900">
              {notice}
            </p>
          )}

          <div aria-live="polite">
            {result && !result.ok && (
              <BrowserSourceError code={result.code} detail={result.detail} url={url} headerName={headerName} />
            )}
            {result && !result.ok && !BROWSER_CODES.has(result.code) && (
              <p className="text-xs text-red-700">{sourceErrorText(result.code, t.data)}</p>
            )}
            {table && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-900">
                <p className="font-semibold">✓ {b.testOk(table.rows.length, table.columns.length)}</p>
                {table.truncated && <p className="mt-0.5 text-amber-800">⚠ {t.data.partial(table.rows.length)} · {partialHintText(table, t.data)}</p>}
                {table.columns.length > 0 && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full border-collapse text-[11px] text-zinc-800">
                      <caption className="sr-only">{b.preview}</caption>
                      <thead>
                        <tr>
                          {table.columns.map((c) => (
                            <th key={c.key} scope="col" className="border border-emerald-200 bg-white px-1.5 py-0.5 text-left font-semibold">
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            {row.map((v, j) => (
                              <td key={j} className="border border-emerald-200 bg-white px-1.5 py-0.5">
                                {v === null ? "" : String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-zinc-200 px-5 py-3">
          <button
            type="button"
            onClick={onTest}
            disabled={!canSubmit || testing}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? b.testing : reload ? b.testAndAllow : b.test}
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
            {b.cancel}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSubmit}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {reload ? b.saveAndAllow : b.save}
          </button>
        </div>
      </div>
    </div>
  );
}
