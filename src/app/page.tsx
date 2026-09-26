// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import Image from "next/image";
import Link from "next/link";
import LanguageToggle from "@/features/toolbar/LanguageToggle";
import LiveSheet from "@/features/landing/LiveSheet";
import SkipLink from "@/features/a11y/SkipLink";
import { useLocale, useT } from "@/i18n";
import type { Locale } from "@/i18n/types";
import { useHydrateLocaleStore } from "@/store/localeStore";

/**
 * Landing page, built as a ledger rather than as a marketing page.
 *
 * The rules it follows, so that later edits don't drift back into the default look:
 *
 * - **Rules, not cards.** Sections are separated by hairlines that run the width of the column and
 *   by bands of tint, the way rows are separated on accounting paper. Nothing floats in a rounded
 *   box with a drop shadow, because four of those in a grid is the shape every generated landing
 *   page has, and it carries no meaning here.
 * - **Corners are square.** A spreadsheet is a grid of right angles; so is this.
 * - **Mono is for data.** Numbers, cell addresses, formulas, section markers and captions are set
 *   in the mono face with tabular figures. Prose is set in the sans. A reader can tell which is
 *   which without reading either.
 * - **One dark band.** The technical section inverts to ink. It gives the page a spine without a
 *   single gradient, and it is the only place the page raises its voice.
 * - **The hero is the product.** Not a screenshot of it — see LiveSheet.
 */

const REPO_URL = "https://github.com/SuruchBoss/ExcelToGo";
const AUTHOR_URL = "https://github.com/SuruchBoss";
const LINKEDIN_URL = "https://www.linkedin.com/in/suruchboss";

/**
 * The exhibit and the anchor for each problem in `t.landing.pains`, paired by index — reorder one,
 * reorder both. Kept out of the message dictionaries because a file name and a URL fragment are
 * the same in every language; only the alt text needs translating. The anchors are English slugs
 * so that a link someone pastes into a chat reaches the same problem whichever language the reader
 * has chosen.
 *
 * The picture itself is not the same in every language: there is a set per language, taken by
 * `scripts/screenshots.mjs`, and a reader of the English page sees the English app. The sizes are
 * per language because a picture of one panel is as wide as its words — `check:readme` compares
 * each against the file, so a retake that changes one says so.
 */
const PAIN_EXHIBITS = [
  { id: "formulas", file: "04-ai-assistant.png", size: { th: [2720, 1720], en: [2720, 1720] } },
  // The names panel open over a sheet that is already using one: the formula bar reads the total
  // by its name, the cells that name stands for are lit as its precedents, and the emerald rings
  // down column A are the validated cells. One frame carries three of the four fixes.
  { id: "silent-errors", file: "43-sheet-rules.png", size: { th: [2720, 1200], en: [2720, 1200] } },
  // Animated, so it shows the one thing a still cannot: the table arriving in the sheet, and then
  // changing again on its own. `unoptimized` because the optimiser returns a single still frame.
  { id: "monthly-export", file: "34-live-data.gif", size: { th: [1000, 542], en: [1000, 542] }, unoptimized: true },
  { id: "existing-files", file: "17-styled-import.png", size: { th: [2720, 1720], en: [2720, 1720] } },
  { id: "privacy", file: "33-byok.png", size: { th: [735, 628], en: [735, 628] } },
  { id: "lost-work", file: "42-save-failed.png", size: { th: [2720, 1720], en: [2720, 1720] } },
] as const;

/** Where a screenshot lives for this language: the Thai set at the root, every other in its own folder. */
const shotUrl = (locale: Locale, file: string) => `/screenshots/${locale === "th" ? "" : `${locale}/`}${file}`;

const num = (i: number) => String(i + 1).padStart(2, "0");

/** The wordmark: a sheet whose bottom-right cell — the one a total lands in — is filled. */
function Mark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="17" height="17" fill="none" stroke="currentColor" strokeOpacity="0.45" />
      <path d="M6.5 0.5V17.5M12 0.5V17.5M0.5 6.5H17.5M0.5 12H17.5" stroke="currentColor" strokeOpacity="0.28" />
      <rect x="12" y="12" width="5.5" height="5.5" fill="var(--color-ledger)" />
    </svg>
  );
}

/** A numbered heading sitting on a heavy rule — the page's one repeated structural device. */
function SectionHead({
  n,
  title,
  lead,
  inverted,
  id,
}: {
  n: string;
  title: string;
  lead?: string;
  inverted?: boolean;
  id?: string;
}) {
  return (
    <div className={`border-b pb-4 ${inverted ? "border-white/25" : "border-ink"}`}>
      <div className="flex items-baseline gap-3 sm:gap-5">
        <span className={`tabular-nums font-mono text-[11px] font-medium ${inverted ? "text-[#5ad0a3]" : "text-ledger"}`}>{n}</span>
        <h2
          id={id}
          className={`text-[1.5rem] font-semibold leading-[1.3] tracking-[-0.015em] sm:text-[2rem] ${
            inverted ? "text-white" : "text-ink"
          }`}
        >
          {title}
        </h2>
      </div>
      {lead && (
        <p className={`mt-3 max-w-2xl text-[14.5px] leading-relaxed sm:ml-[2.6rem] ${inverted ? "text-white/60" : "text-ash"}`}>
          {lead}
        </p>
      )}
    </div>
  );
}

export default function Landing() {
  useHydrateLocaleStore();
  const t = useT();
  const locale = useLocale();

  const cta = (
    <Link
      href="/app"
      className="inline-flex items-center gap-2.5 bg-ledger px-6 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-ledger-ink"
    >
      {t.landing.ctaPrimary}
      <span className="font-mono text-[15px]" aria-hidden>
        →
      </span>
    </Link>
  );

  return (
    <div className="flex-1 bg-paper text-ink">
      <SkipLink />
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/92 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-8">
          <span className="flex items-center gap-2.5 text-ink">
            <Mark />
            <span className="font-mono text-[13px] font-semibold tracking-[0.02em]">{t.app.brand}</span>
          </span>
          <div className="flex-1" />
          <LanguageToggle className="flex min-h-11 items-center gap-1.5 border border-rule px-3 font-mono text-[12px] text-ash transition-colors hover:border-ink/40 hover:text-ink sm:min-h-0 sm:py-2" />
          <Link href="/app" className="bg-ledger px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-ledger-ink">
            {t.landing.backToApp}
          </Link>
        </div>
      </header>

      {/* `tabIndex={-1}` lets the skip link move focus here, not just scroll to it. */}
      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* ── Hero ─────────────────────────────────────────────────────────────────────────────── */}
        <section className="border-b border-rule">
        <div className="mx-auto grid max-w-6xl gap-11 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16 lg:py-24">
          <div className="min-w-0 lg:pt-1.5">
            <p className="flex items-center gap-2.5 font-mono text-[11.5px] leading-relaxed text-ledger">
              <span className="h-[7px] w-[7px] shrink-0 bg-ledger" aria-hidden />
              {t.landing.eyebrow}
            </p>
            <h1 className="mt-5 max-w-[22ch] text-[2.05rem] font-semibold leading-[1.22] tracking-[-0.022em] text-ink sm:text-[2.75rem] lg:text-[3.05rem]">
              {t.landing.headline}
            </h1>
            <p className="mt-5 max-w-xl text-[15.5px] leading-[1.75] text-ash">{t.landing.subheadline}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {cta}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-ink/25 px-6 py-3.5 text-[15px] font-medium text-ink transition-colors hover:border-ink hover:bg-white"
              >
                <span className="font-mono text-[13px] text-ash" aria-hidden>
                  {"</>"}
                </span>
                {t.landing.ctaSecondary}
              </a>
            </div>
            <p className="mt-4 max-w-xl text-[12.5px] leading-relaxed text-ash">{t.landing.ctaNote}</p>
          </div>

          <div className="min-w-0">
            <LiveSheet />
            <p className="mt-3.5 border-l-2 border-ledger pl-3 text-[12.5px] leading-relaxed text-ash">{t.landing.demo.caption}</p>
          </div>
        </div>
      </section>

      {/* ── 01 · The problems a team already pays for → what solves them → what they get ───────
          The business case, told the way a ledger would: each problem is an entry with its cost
          in red ink, the features that answer it are the lines under it, and the outcome sits
          under a double rule, which is how an account writes its total. One problem is usually
          solved by several features working together — that chain is the story, so it is shown
          as one, rather than as the same features scattered across a list further down. */}
      <section className="border-b border-rule bg-white" aria-labelledby="pains-title">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-18">
          <SectionHead n="01" id="pains-title" title={t.landing.painTitle} lead={t.landing.painLead} />

          {/* The index: a reader who manages payroll should reach their problem in one press,
              not by reading five others first. Hairlines between cells come from the gap showing
              the rule colour through, so the grid reads as ruled paper at every width. */}
          <nav aria-label={t.landing.painIndexLabel} className="mt-8">
            <ol className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
              {t.landing.pains.map((p, i) => (
                <li key={PAIN_EXHIBITS[i].id} className="bg-white">
                  <a
                    href={`#${PAIN_EXHIBITS[i].id}`}
                    className="flex min-h-11 items-baseline gap-3 px-3 py-3.5 text-[14px] leading-snug text-ink transition-colors hover:bg-band/60 hover:text-ledger-ink"
                  >
                    <span aria-hidden className="tabular-nums shrink-0 font-mono text-[11px] text-ref">
                      {num(i)}
                    </span>
                    <span className="min-w-0 flex-1">{p.short}</span>
                    <span aria-hidden className="shrink-0 font-mono text-[12px] text-ash">
                      ↓
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-4">
            {t.landing.pains.map((p, i) => {
              const exhibit = PAIN_EXHIBITS[i];
              const src = shotUrl(locale, exhibit.file);
              const [width, height] = exhibit.size[locale];
              const titleId = `${exhibit.id}-title`;
              return (
                <article
                  key={exhibit.id}
                  id={exhibit.id}
                  aria-labelledby={titleId}
                  className="grid scroll-mt-20 items-start gap-8 border-b border-rule py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-12 lg:py-14"
                >
                  {/* Alternate which side the exhibit sits on, but only once there are two columns. */}
                  <div className={`min-w-0 ${i % 2 === 1 ? "md:order-2" : ""}`}>
                    <p className="flex items-center gap-2.5 font-mono text-[11.5px] font-medium text-ref">
                      <span className="h-[7px] w-[7px] shrink-0 bg-ref" aria-hidden />
                      {t.landing.painLabels.problem} {num(i)}
                    </p>
                    <h3
                      id={titleId}
                      className="mt-3 text-[1.3rem] font-semibold leading-[1.42] tracking-[-0.01em] text-ink sm:text-[1.5rem]"
                    >
                      {p.title}
                    </h3>

                    {/* Who has it, and what it costs them today. The cost is in red ink — the one
                        place on the page that colour is used for words — because it is the debit
                        the rest of the entry is there to clear. */}
                    <dl className="mt-5 space-y-3 border-l-2 border-ref/35 pl-4">
                      <div>
                        <dt className="text-[12px] font-semibold text-ash">{t.landing.painLabels.who}</dt>
                        <dd className="mt-0.5 text-[14px] leading-relaxed text-ink/80">{p.who}</dd>
                      </div>
                      <div>
                        <dt className="text-[12px] font-semibold text-ref">{t.landing.painLabels.cost}</dt>
                        <dd className="mt-0.5 text-[14.5px] leading-relaxed text-ink">{p.cost}</dd>
                      </div>
                    </dl>

                    <h4 className="mt-8 font-mono text-[11.5px] font-medium text-ledger">{t.landing.painLabels.solvedBy}</h4>
                    {/* Lettered, not numbered: they are lines of one entry, not entries of their own. */}
                    <ol className="mt-2 border-t border-rule">
                      {p.solvedBy.map((f, j) => (
                        <li key={f.name} className="grid grid-cols-[1.4rem_minmax(0,1fr)] gap-x-2 border-b border-rule py-3.5">
                          <span aria-hidden className="pt-[3px] font-mono text-[11px] text-ledger">
                            {String.fromCharCode(97 + j)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[14.5px] font-semibold leading-snug text-ink">{f.name}</p>
                            <p className="mt-1 text-[13.5px] leading-relaxed text-ash">{f.does}</p>
                          </div>
                        </li>
                      ))}
                    </ol>

                    {/* The total line. A double rule over the result is how a ledger closes a column;
                        here it closes the entry, and it is the line a skimming reader lands on. */}
                    <div className="mt-6 border-t-[3px] border-double border-ink pt-4">
                      <p className="font-mono text-[11.5px] font-medium text-ledger">{t.landing.painLabels.outcome}</p>
                      <p className="mt-1.5 text-[16px] font-semibold leading-[1.6] text-ink sm:text-[17px]">{p.outcome}</p>
                    </div>
                  </div>

                  {/* Sticky on wide screens, so the proof stays beside the entry while it is read. A
                      whole-app screenshot at column width is too small to read the part that proves
                      anything, so the exhibit opens at full size — the link's name is the image's alt. */}
                  <figure className="min-w-0 border border-rule bg-white md:sticky md:top-24">
                    <a
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="block cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ledger"
                    >
                      <Image
                        src={src}
                        width={width}
                        height={height}
                        unoptimized={"unoptimized" in exhibit && exhibit.unoptimized}
                        alt={p.alt}
                        sizes="(max-width: 768px) 100vw, 620px"
                        className="h-auto w-full"
                      />
                    </a>
                    {/* Styled as the formula bar, so an exhibit reads as part of the same instrument. */}
                    <figcaption className="border-t border-rule bg-paper px-3 py-2 font-mono text-[11px] leading-relaxed text-ash">
                      {p.alt}
                    </figcaption>
                  </figure>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Where this differs ───────────────────────────────────────────────────────────────
          Unnumbered on purpose: it answers an objection rather than making a point of its own.
          It sits straight after the problems because that is when the objection arrives — a
          reader who has just recognised their problem thinks "Sheets already does this", and
          they are partly right, so the page answers it here instead of hoping they read on. Every
          row is a checkable fact, and the row the app loses is in the table too — a comparison
          that only the author wins is one nobody believes. */}
      <section className="border-b border-rule bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-14">
          {/* A scrollable table has to be reachable by keyboard, or someone who cannot use a
              pointer cannot read the columns that are off-screen at phone width. */}
          <div
            role="region"
            aria-label={t.landing.compare.title}
            tabIndex={0}
            className="-mx-4 overflow-x-auto px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ledger sm:mx-0 sm:px-0"
          >
            <table className="w-full border-collapse text-left sm:min-w-[34rem]">
              <caption className="mb-5 text-left text-[1.35rem] font-semibold leading-snug tracking-[-0.015em] text-ink sm:text-[1.6rem]">
                {t.landing.compare.title}
              </caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th scope="col" className="py-2.5 pr-2 sm:pr-4" />
                  {t.landing.compare.columns.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={`w-[19%] py-2.5 pl-1.5 font-mono text-[10.5px] leading-snug sm:w-[17%] sm:pl-3 sm:text-[12px] ${
                        i === 0 ? "font-semibold text-ledger" : "font-normal text-ash"
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.landing.compare.rows.map((row, i) => (
                  <tr key={row.label} className={`border-b border-rule ${i % 2 === 1 ? "bg-band/40" : ""}`}>
                    <th scope="row" className="py-3.5 pr-2 text-[12px] font-medium leading-snug text-ink sm:pr-4 sm:text-[14px]">
                      {row.label}
                    </th>
                    {row.values.map((v, j) => (
                      <td
                        key={t.landing.compare.columns[j]}
                        className={`py-3.5 pl-1.5 text-[11.5px] leading-snug sm:pl-3 sm:text-[13.5px] ${
                          j === 0 && row.good ? "font-semibold text-ledger" : "text-ash"
                        }`}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 max-w-3xl border-l-2 border-rule pl-3.5 text-[13px] leading-relaxed text-ash">
            {t.landing.compare.disclaimer}
          </p>
        </div>
      </section>

      {/* ── 02 · Under the hood — the page's one inverted band ───────────────────────────────── */}
      <section className="bg-ink">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-18">
          <SectionHead n="02" title={t.landing.statsTitle} inverted />
          <dl className="mt-10 grid grid-cols-2 gap-y-9 sm:grid-cols-5 sm:gap-y-0">
            {t.landing.stats.map((s, i, all) => (
              // Two columns on a phone and five figures leave the last one alone on its row, half
              // the band empty beside it. Let it take the whole row instead: it is the "0", the
              // figure the rest of the band is built on, so it is the one worth a line to itself.
              <div
                key={s.label}
                className={`px-1 sm:px-6 ${i > 0 ? "sm:border-l sm:border-white/15" : ""} ${i === 0 ? "sm:pl-0" : ""} ${
                  i === all.length - 1 && all.length % 2 === 1 ? "col-span-2 border-t border-white/15 pt-9 sm:col-span-1 sm:border-t-0 sm:pt-0" : ""
                }`}
              >
                <dd className="tabular-nums font-mono text-[2.6rem] font-medium leading-none text-white sm:text-[3rem]">{s.value}</dd>
                <dt className="mt-3.5 text-[12.5px] leading-relaxed text-white/55">{s.label}</dt>
              </div>
            ))}
          </dl>

          {/* The figures above are what a reader can check. This is the one thing they cannot
              say — that a suite can be green and still be looking the wrong way. It sits on the
              inverted band with them rather than in the feature list, because it is about how the
              app was built, not about what it does. */}
          <div className="mt-14 border-t border-white/15 pt-10 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
            <h3 className="text-[1.15rem] font-semibold leading-[1.45] tracking-[-0.01em] text-white sm:text-[1.3rem]">
              {t.landing.statsStory.title}
            </h3>
            <div className="mt-5 space-y-4 md:mt-0">
              {t.landing.statsStory.body.map((line) => (
                <p key={line} className="max-w-2xl text-[14.5px] leading-[1.8] text-white/65">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 · What it can't do ────────────────────────────────────────────────────────────── */}
      <section className="border-b border-rule bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-18">
          <SectionHead n="03" title={t.landing.limitsTitle} lead={t.landing.limitsLead} />
          <dl className="mt-1">
            {t.landing.limits.map((l, i) => (
              <div
                key={l.title}
                className="grid gap-x-6 gap-y-1.5 border-b border-rule px-2 py-5 sm:grid-cols-[minmax(0,22rem)_1fr] sm:px-3"
              >
                <dt className="flex gap-3 text-[15px] font-semibold leading-snug text-ink sm:gap-4">
                  <span aria-hidden className="tabular-nums shrink-0 pt-0.5 font-mono text-[11px] font-normal text-ref">
                    {num(i)}
                  </span>
                  {l.title}
                </dt>
                <dd className="text-[14.5px] leading-relaxed text-ash">{l.body}</dd>
              </div>
            ))}
          </dl>

          {/* The full list of limitations lives in the README, where a reader who followed the link
              is already invested enough to want it. Two scope statements belong on a page someone
              is deciding whether to try; fourteen do not. */}
          <p className="mt-7 flex flex-col gap-3 px-2 text-[14.5px] leading-relaxed text-ash sm:flex-row sm:items-center sm:gap-5 sm:px-3">
            <span className="max-w-2xl">{t.landing.limitsMoreText}</span>
            <a
              href={`${REPO_URL}#-สิ่งที่จะทำต่อ`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 whitespace-nowrap font-medium text-ledger underline underline-offset-4 hover:text-ink"
            >
              {t.landing.limitsMoreCta} →
            </a>
          </p>
        </div>
      </section>

      {/* ── Closing ──────────────────────────────────────────────────────────────────────────── */}
      <section className="border-b border-rule bg-band">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
          <h2 className="max-w-[16ch] text-[1.7rem] font-semibold leading-[1.3] tracking-[-0.015em] text-ink sm:text-[2.2rem]">
            {t.landing.closingTitle}
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.75] text-ink/65">{t.landing.closingBody}</p>
          <div className="mt-8">{cta}</div>
        </div>
      </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-8 font-mono text-[11.5px] text-ash sm:px-8">
          {/* The licence only compels attribution inside the source tree, which nobody using the
              app ever opens. This is the line a person actually reads. */}
          <span>
            {t.landing.builtBy}{" "}
            <a href={AUTHOR_URL} target="_blank" rel="noreferrer" className="text-ink underline-offset-2 hover:text-ledger hover:underline">
              {t.landing.authorName}
            </a>
          </span>
          <span className="text-rule">·</span>
          <span>{t.landing.footerNote}</span>
          <div className="flex-1" />
          {/* No lucide icon for LinkedIn — this version dropped its brand icons — and a plain text
              link avoids reproducing a trademarked mark for no gain. */}
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
            LinkedIn
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
