// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useState } from "react";
import { ArrowRight, Database, Globe, Plus, X } from "lucide-react";
import Link from "next/link";
import { PublicDataSource } from "@/lib/dataSources/types";
import { useDataSourceStore } from "@/store/dataSourceStore";
import { useLiveBlocks, useSheetStore } from "@/store/sheetStore";
import { cellRef } from "@/lib/formulaEngine/address";
import { useT } from "@/i18n";
import SourceRow from "./SourceRow";
import SourceSetupDialog from "./SourceSetupDialog";
import BrowserSourceDialog from "./BrowserSourceDialog";
import SourcesUnlock, { useSourcesToken } from "./SourcesUnlock";
import { useServerSources } from "./useServerSources";
import { SAMPLE_APIS, sampleDraft, sampleUrl } from "./sampleApis";
import type { BrowserSourceDraft } from "@/store/dataSourceStore";
import { useLocaleStore } from "@/store/localeStore";
import { valueLabel } from "./valueLabel";

/** The side panel stays a short list: what's connected, and one button per source. Choosing what
 *  to insert and where happens in the picker dialog, which has room to show the actual data.
 *
 *  Two kinds of source live here (#110, #109). **This browser's own** — an API the visitor's
 *  machine can reach, fetched by the browser — are for everyone, always. **The server's** are
 *  there only when the deployment set `SOURCES_ADMIN_TOKEN`; otherwise that half of the panel is
 *  simply absent, with nothing saying it is switched off. */
export default function DataSourcePanel() {
  const t = useT();
  const sources = useDataSourceStore((s) => s.sources);
  const browserSources = useDataSourceStore((s) => s.browserSources);
  const data = useDataSourceStore((s) => s.data);
  const resume = useDataSourceStore((s) => s.resume);
  const setResume = useDataSourceStore((s) => s.setResume);
  const blocks = useLiveBlocks();
  const removeLiveBlock = useSheetStore((s) => s.removeLiveBlock);
  const openPicker = useSheetStore((s) => s.openDataPicker);
  const [setup, setSetup] = useState<{ open: boolean; source?: PublicDataSource }>({ open: false });
  const [browserForm, setBrowserForm] = useState<{ open: boolean; id?: string; preset?: BrowserSourceDraft }>({ open: false });
  const locale = useLocaleStore((s) => s.locale);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  // A sample already added (in either language) shows as added rather than inviting a duplicate.
  const addedPaths = new Set(browserSources.map((b) => b.url.split("?")[0]));
  const token = useSourcesToken();
  const serverOffered = useServerSources();
  const serverUnlocked = serverOffered && Boolean(token);

  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id;
  const shown = sources.filter((s) => s.local || serverUnlocked);
  const editing = browserForm.id ? browserSources.find((b) => b.id === browserForm.id) : undefined;
  const closeBrowserForm = () => {
    setBrowserForm({ open: false });
    setResume(null);
  };

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-hidden">
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <Database size={16} className="text-emerald-600" /> {t.data.title}
        </h2>
        <p className="text-xs text-zinc-600">{t.data.subtitle}</p>
      </div>

      <button
        onClick={() => setBrowserForm({ open: true })}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-[13px] font-semibold text-white hover:bg-emerald-800 sm:min-h-0 sm:py-2"
      >
        <Globe size={15} aria-hidden /> {t.data.browser.add}
      </button>

      {/* One scrolling region for everything between the add button and what is in the sheet. Only the
          source list used to scroll, and the samples below it, which do not shrink, squeezed it to
          nothing on a short panel — a source just connected was on the panel with no height at all. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
        <div className="flex flex-col gap-2">
          {shown.length === 0 && <p className="p-3 text-center text-xs text-zinc-600">{t.data.empty}</p>}
          {shown.map((src) => (
            <SourceRow
              key={src.id}
              source={src}
              onUse={() => openPicker({ sourceId: src.id })}
              onEdit={src.local ? () => setBrowserForm({ open: true, id: src.id }) : () => setSetup({ open: true, source: src })}
            />
          ))}
        </div>

        {/* After the person's own sources, not before: once something is connected, the samples are the
            lesser thing on the panel. With nothing connected yet they sit right under the empty line. */}
        <section aria-labelledby="sample-apis" className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5">
          <h3 id="sample-apis" className="text-[13px] font-semibold text-zinc-800">
            {t.data.samples.title}
          </h3>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-600">{t.data.samples.lead}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {SAMPLE_APIS.map((sample) => {
              const words = t.data.samples.items[sample.key];
              const added = addedPaths.has(sampleUrl(sample, origin, locale).split("?")[0]);
              return (
                <li key={sample.key} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 ring-1 ring-zinc-200">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-zinc-800">{words.name}</span>
                    <span className="block text-[11px] leading-snug text-zinc-600">{words.hint}</span>
                  </span>
                  <button
                    onClick={() => setBrowserForm({ open: true, preset: sampleDraft(sample, words.name, origin, locale) })}
                    disabled={added}
                    aria-label={`${t.data.samples.tryIt}: ${words.name}`}
                    className="shrink-0 rounded-md border border-emerald-600 px-2.5 py-1 text-[12px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:border-zinc-300 disabled:text-zinc-500 disabled:hover:bg-transparent"
                  >
                    {added ? t.data.samples.added : t.data.samples.tryIt}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Server sources are the operator's business (#109): their lock sits last, beside their add button. */}
        {serverOffered && <SourcesUnlock />}
        {serverUnlocked && (
          <button
            onClick={() => setSetup({ open: true })}
            className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-3 py-2 text-[13px] font-medium text-zinc-600 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <Plus size={15} /> {t.data.addSource}
          </button>
        )}
        <Link href="/guide" className="-mt-1 inline-flex items-center gap-1 self-center text-[11px] text-zinc-600 underline underline-offset-2 hover:text-emerald-800">
          {t.data.guideLink} <ArrowRight size={11} aria-hidden />
        </Link>
      </div>

      <div className="border-t border-zinc-100 pt-2.5">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t.data.inSheet}</p>
        {blocks.length === 0 ? (
          <p className="text-xs text-zinc-500">{t.data.inSheetEmpty}</p>
        ) : (
          <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-2 py-0.5 text-xs text-zinc-700">
                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700">
                  {cellRef(b.anchorRow, b.anchorCol)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {sourceName(b.sourceId)} ·{" "}
                  {b.kind === "table"
                    ? t.data.picker.wholeTable
                    : valueLabel(t, data[b.sourceId], b.column ?? "", b.aggregate ?? "first")}
                </span>
                <button
                  onClick={() => removeLiveBlock(b.id)}
                  title={t.data.unlink}
                  className="rounded p-0.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {setup.open && <SourceSetupDialog source={setup.source} onClose={() => setSetup({ open: false })} />}
      {(browserForm.open || resume) && (
        <BrowserSourceDialog
          // A resumed test and an ordinary open are different forms; the key keeps them from sharing state.
          key={resume ? "resume" : (browserForm.id ?? "new")}
          source={resume?.id ? browserSources.find((b) => b.id === resume.id) : editing}
          resume={resume ?? undefined}
          preset={resume ? undefined : browserForm.preset}
          onClose={closeBrowserForm}
        />
      )}
    </div>
  );
}
