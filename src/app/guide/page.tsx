// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LanguageToggle from "@/features/toolbar/LanguageToggle";
import SkipLink from "@/features/a11y/SkipLink";
import { useLocale, useT } from "@/i18n";
import { useHydrateLocaleStore } from "@/store/localeStore";

const REPO_URL = "https://github.com/SuruchBoss/ExcelToGo";
/** The README section each language's reader should land on. Anchors follow GitHub's slugs. */
const README_LIVE_DATA = {
  th: `${REPO_URL}#ข้อมูลสดจาก-api--csv-prototype`,
  en: `${REPO_URL}/blob/main/README.en.md#live-data-from-an-api--csv-prototype`,
} as const;

/**
 * A command block with a copy button.
 *
 * Copying is the whole point of a starter kit: a command retyped from a screen is where a stray
 * character gets in. The result is said in a live region that is always present, so a screen
 * reader hears it, and a failure says what to do instead of failing quietly.
 */
function Code({ code, id }: { code: string; id: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(reset.current), []);

  const copy = async () => {
    clearTimeout(reset.current);
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
    reset.current = setTimeout(() => setState("idle"), 2500);
  };

  return (
    <div className="mt-4 border border-ink">
      <div className="flex items-center justify-between gap-3 border-b border-ink bg-ink px-3 py-1.5">
        <span id={id} className="font-mono text-[11px] text-white/70">
          {t.guide.codeLabel}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-describedby={id}
          className="min-h-9 border border-white/30 px-3 font-mono text-[11.5px] text-white transition-colors hover:border-white hover:bg-white/10"
        >
          {state === "copied" ? t.guide.copied : t.guide.copy}
        </button>
      </div>
      {/* Focusable, because a block wider than a phone scrolls sideways and a keyboard has to be
          able to reach it to scroll it. */}
      <pre
        tabIndex={0}
        aria-labelledby={id}
        className="overflow-x-auto bg-white px-3 py-3 font-mono text-[12.5px] leading-[1.7] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ledger"
      >
        {code}
      </pre>
      <p role="status" className={`px-3 font-mono text-[11px] ${state === "failed" ? "text-ref" : "text-ledger-ink"}`}>
        {state === "failed" ? t.guide.copyFailed : state === "copied" ? t.guide.copied : ""}
      </p>
    </div>
  );
}

/** A heading on a heavy rule — the same device the landing page is built from. */
function Head({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="border-b border-ink pb-3 text-[1.35rem] font-semibold leading-[1.35] tracking-[-0.012em] text-ink sm:text-[1.6rem]">
      {children}
    </h2>
  );
}

/**
 * How to connect your own API or database.
 *
 * It exists because the person who built the app could not find this on their own phone: on the
 * public demo the "connect new data" button is deliberately absent, and nothing on screen said why
 * or what to do instead. The answer used to live only in the README, which is where someone who
 * already knows the answer goes. This page is where the app itself sends people.
 *
 * Written for the person doing the setup, in order, with every command copyable. The claims here
 * are the README's and SECURITY.md's in fewer words; when one of those changes, this has to follow.
 */
export default function Guide() {
  useHydrateLocaleStore();
  const t = useT();
  const locale = useLocale();
  const g = t.guide;

  return (
    <div className="flex-1 bg-paper text-ink">
      <SkipLink />
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/92 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-8">
          <Link href="/" className="font-mono text-[13px] font-semibold tracking-[0.02em] text-ink hover:text-ledger">
            {t.app.brand}
          </Link>
          <div className="flex-1" />
          <LanguageToggle className="flex min-h-11 items-center gap-1.5 border border-rule px-3 font-mono text-[12px] text-ash transition-colors hover:border-ink/40 hover:text-ink sm:min-h-0 sm:py-2" />
          <Link href="/app" className="bg-ledger px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-ledger-ink">
            {g.openApp}
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 outline-none sm:px-8">
        <div className="border-b border-rule py-10 sm:py-14">
          <p className="flex items-center gap-2.5 font-mono text-[11.5px] text-ledger">
            <span className="h-[7px] w-[7px] shrink-0 bg-ledger" aria-hidden />
            {g.eyebrow}
          </p>
          <h1 className="mt-4 max-w-[26ch] text-[1.8rem] font-semibold leading-[1.28] tracking-[-0.02em] text-ink [text-wrap:balance] sm:text-[2.3rem]">
            {g.title}
          </h1>
          <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.75] text-ash">{g.lead}</p>

        </div>

        {/* The way that works on this site comes first (#110): the browser fetches, nothing to
            install. Running a server is for databases and server-side fetching, and comes after. */}
        <section aria-labelledby="browser" className="pt-12">
          <Head id="browser">{g.browserTitle}</Head>
          {g.browserBody.map((line) => (
            <p key={line} className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-ink/80">
              {line}
            </p>
          ))}
          <ol className="mt-4">
            {g.browserSteps.map((step, i) => (
              <li key={step} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b border-rule py-3.5">
                <span aria-hidden className="font-mono text-[12px] font-medium tabular-nums text-ledger">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="max-w-[62ch] text-[14.5px] leading-relaxed text-ink/85">{step}</p>
              </li>
            ))}
          </ol>
          <Link href="/app" className="mt-5 inline-flex bg-ledger px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-ledger-ink">
            {g.openApp}
          </Link>
        </section>

        <section aria-labelledby="it" className="pt-12">
          <Head id="it">{g.itTitle}</Head>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-ash">{g.itLead}</p>
          <ul className="mt-3">
            {g.itItems.map((item) => (
              <li key={item} className="border-b border-rule py-3 text-[14px] leading-relaxed text-ink/85">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="server" className="pt-14">
          <Head id="server">{g.serverTitle}</Head>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-ash">{g.serverLead}</p>
        </section>

        <section aria-labelledby="types" className="pt-10">
          <Head id="types">{g.typesTitle}</Head>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-ash">{g.typesLead}</p>
          {/* A list of entries rather than a table: at phone width a four-column table with long
              examples could only scroll sideways, and the example is the part worth reading whole. */}
          <dl className="mt-4">
            {g.types.map((ty) => (
              <div key={ty.name} className="grid gap-x-6 gap-y-1 border-b border-rule py-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <dt className="text-[15px] font-semibold text-ink">{ty.name}</dt>
                <dd className="min-w-0">
                  <p className="text-[14px] leading-relaxed text-ink/80">{ty.needs}</p>
                  <p className="mt-1.5 break-all font-mono text-[12px] text-ledger-ink">{ty.example}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="kit" className="pt-14">
          <Head id="kit">{g.kitTitle}</Head>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ash">{g.kitLead}</p>
          {/* Numbered because it is a sequence: step three before step two does not work. */}
          <ol className="mt-2">
            {g.steps.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b border-rule py-7">
                <span aria-hidden className="pt-1 font-mono text-[12px] font-medium tabular-nums text-ledger">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-semibold leading-snug text-ink">{step.title}</h3>
                  <p className="mt-1.5 max-w-[62ch] text-[14.5px] leading-relaxed text-ink/80">{step.body}</p>
                  {step.code && <Code code={step.code} id={`step-${i + 1}-code`} />}
                  {step.note && (
                    <p className="mt-3 max-w-[62ch] border-l-2 border-ledger pl-3 text-[13.5px] leading-relaxed text-ink/75">{step.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="safety" className="pt-14">
          <Head id="safety">{g.safetyTitle}</Head>
          <dl className="mt-1">
            {g.safety.map((item) => (
              <div key={item.title} className="border-b border-rule py-4">
                <dt className="text-[15px] font-semibold text-ink">{item.title}</dt>
                <dd className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-ink/75">{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="cloud" className="pt-14">
          <Head id="cloud">{g.cloudTitle}</Head>
          {g.cloudBody.map((line) => (
            <p key={line} className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-ink/80">
              {line}
            </p>
          ))}
          <Code code={g.cloudCode} id="cloud-code" />
        </section>

        <section aria-labelledby="more" className="pt-14">
          <Head id="more">{g.moreTitle}</Head>
          <ul className="mt-2">
            <li className="border-b border-rule">
              <Link href="/formulas" className="flex min-h-12 items-center justify-between gap-3 py-2 text-[15px] font-medium text-ledger-ink hover:text-ink">
                {g.moreFormulas} <span aria-hidden className="font-mono">→</span>
              </Link>
            </li>
            <li className="border-b border-rule">
              <a href={README_LIVE_DATA[locale]} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-between gap-3 py-2 text-[15px] font-medium text-ledger-ink hover:text-ink">
                {g.moreReadme} <span aria-hidden className="font-mono">↗</span>
              </a>
            </li>
            <li className="border-b border-rule">
              <a href={`${REPO_URL}/blob/main/SECURITY.md`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-between gap-3 py-2 text-[15px] font-medium text-ledger-ink hover:text-ink">
                {g.moreSecurity} <span aria-hidden className="font-mono">↗</span>
              </a>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
