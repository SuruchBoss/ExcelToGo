// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LanguageToggle from "@/features/toolbar/LanguageToggle";
import LiveSheet from "@/features/landing/LiveSheet";
import SkipLink from "@/features/a11y/SkipLink";
import { useLocale, useT } from "@/i18n";
import type { Locale } from "@/i18n/types";
import { useHydrateLocaleStore } from "@/store/localeStore";
import { countUsage } from "@/lib/usage";

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
const CONTACT_EMAIL = "bossxiii@gmail.com";

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
  { id: "formulas", file: "04-ai-assistant.png", size: { th: [2880, 1720], en: [2880, 1720] } },
  // The names panel open over a sheet that is already using one: the formula bar reads the total
  // by its name, the cells that name stands for are lit as its precedents, and the emerald rings
  // down column A are the validated cells. One frame carries three of the four fixes.
  { id: "silent-errors", file: "43-sheet-rules.png", size: { th: [2880, 1200], en: [2880, 1200] } },
  // Animated, so it shows the one thing a still cannot: the table arriving in the sheet, and then
  // changing again on its own. `unoptimized` because the optimiser returns a single still frame.
  { id: "monthly-export", file: "34-live-data.gif", size: { th: [1000, 542], en: [1000, 542] }, unoptimized: true },
  { id: "existing-files", file: "17-styled-import.png", size: { th: [2880, 1720], en: [2880, 1720] } },
  { id: "privacy", file: "33-byok.png", size: { th: [735, 678], en: [735, 678] } },
  { id: "lost-work", file: "42-save-failed.png", size: { th: [2880, 1720], en: [2880, 1720] } },
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

/**
 * How to reach the author, written as two lines of the ledger: a mono label, the address in full,
 * and the action at the end of the row. The address is printed rather than hidden behind a
 * "Contact me" button because a reader who has no mail client set up — most people on webmail —
 * gets nothing from a `mailto:` link, and can still copy what they can see. Hence the copy button
 * too, which says what happened in a live region rather than trusting the click to be enough.
 */
function Contact() {
  const t = useT();
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(reset.current), []);

  const copyEmail = async () => {
    clearTimeout(reset.current);
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
    reset.current = setTimeout(() => setCopy("idle"), 2500);
  };

  const row = "grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 border-b border-ink/15 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]";
  const label = "font-mono text-[11px] font-medium text-ledger";
  const link =
    "flex min-h-11 min-w-0 items-center gap-2 py-3 text-[15px] font-medium text-ink underline-offset-4 transition-colors hover:text-ledger-ink hover:underline";

  return (
    <section id="contact" aria-labelledby="contact-title" className="min-w-0 scroll-mt-20">
      <h2 id="contact-title" className="flex items-center gap-2.5 font-mono text-[11.5px] font-medium text-ledger">
        <span className="h-[7px] w-[7px] shrink-0 bg-ledger" aria-hidden />
        {t.landing.contact.title}
      </h2>
      <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-ink/70">{t.landing.contact.lead}</p>

      <ul className="mt-5 border-t-2 border-ink">
        <li className={row}>
          <span className={label}>{t.landing.contact.emailLabel}</span>
          <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
            <span className="min-w-0 break-all">{CONTACT_EMAIL}</span>
          </a>
          {/* Under the address on a phone, where a third column would squeeze it onto two lines. */}
          <div className="col-start-2 -mt-1 pb-3 sm:col-start-3 sm:mt-0 sm:pb-0">
            <button
              type="button"
              onClick={copyEmail}
              className="min-h-11 border border-ink/25 bg-paper px-3 font-mono text-[11.5px] text-ink transition-colors hover:border-ink sm:min-h-0 sm:py-1.5"
            >
              {t.landing.contact.copy}
            </button>
          </div>
        </li>
        <li className={row}>
          <span className={label}>{t.landing.contact.linkedinLabel}</span>
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className={`${link} sm:col-span-2`}>
            <span className="min-w-0 break-all">linkedin.com/in/suruchboss</span>
            <span aria-hidden className="shrink-0 font-mono text-[13px] text-ash">
              ↗
            </span>
          </a>
        </li>
      </ul>
      {/* Always in the DOM, so the announcement is heard: a live region that appears with its text
          already inside is one most screen readers never read. */}
      <p role="status" className="mt-2 min-h-5 font-mono text-[11.5px] text-ledger-ink">
        {copy === "copied" ? `${t.landing.contact.copied} — ${CONTACT_EMAIL}` : copy === "failed" ? t.landing.contact.copyFailed : ""}
      </p>
    </section>
  );
}

export default function Landing() {
  useHydrateLocaleStore();
  const t = useT();
  const locale = useLocale();

  // A page load, counted apart from `app_opened` so the two numbers say how many visits the link
  // got and how many of them opened the app. Nothing at all unless NEXT_PUBLIC_USAGE=1 — see
  // lib/usage.ts for the whole of what it may send.
  useEffect(() => {
    countUsage("landing_viewed");
  }, []);

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
            {/* The promise's limit, right under the promise (#125). The public site has no server key
                on purpose, so a visitor without their own gets the keyword guess — and three blind
                testers took its wrong formulas for the product. Said here, where the claim is made,
                not in fine print further down. */}
            <p className="mt-4 max-w-xl border-l-2 border-amber-500 pl-3.5 text-[14px] leading-relaxed text-ink/80">
              {t.landing.aiNote}
            </p>

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
            {/* The three questions a first visit asked and the page did not answer out loud: is it
                free, where does my file go, does it work on my phone. Answered next to the button
                rather than somewhere in the fine print (blind test U31). */}
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-medium text-ink">
              {t.landing.benefits.map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <span aria-hidden className="font-mono text-[13px] text-ledger">
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-ash">{t.landing.ctaNote}</p>
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

          {/* Six cards, not six full-page entries. The problem, what it costs and what changes
              are the three lines a reader needs to recognise their own situation; "how it is
              solved" and the screenshot that proves it open under each card for whoever wants
              them. Laid out as six long entries this section was two-thirds of the page — eight
              phone screens before the comparison — and a reader who is not a developer met the
              engine's internals before the reason to try it. */}
          <div className="mt-8 grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  className="flex min-w-0 scroll-mt-20 flex-col border border-rule bg-white"
                >
                  <div className="px-5 pt-5">
                    <p className="flex items-center gap-2.5 font-mono text-[11.5px] font-medium text-ref">
                      <span className="h-[7px] w-[7px] shrink-0 bg-ref" aria-hidden />
                      {t.landing.painLabels.problem} {num(i)}
                    </p>
                    <h3 id={titleId} className="mt-2.5 text-[1.1rem] font-semibold leading-[1.45] tracking-[-0.01em] text-ink">
                      {p.title}
                    </h3>
                    {/* The cost in red ink — the one place on the page that colour is used for words —
                        because it is the debit the rest of the card is there to clear. */}
                    <p className="mt-3 text-[12px] font-semibold text-ref">{t.landing.painLabels.cost}</p>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-ink/85">{p.cost}</p>
                  </div>

                  {/* The total line: a double rule closes the entry, and it is where a skimming
                      reader lands. */}
                  <div className="mx-5 mt-5 border-t-[3px] border-double border-ink pt-3">
                    <p className="font-mono text-[11.5px] font-medium text-ledger">{t.landing.painLabels.outcome}</p>
                    <p className="mt-1 text-[15px] font-semibold leading-[1.6] text-ink">{p.outcome}</p>
                  </div>

                  <details className="group mt-4 border-t border-rule">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 py-3 text-[13.5px] font-medium text-ledger hover:bg-band/50 [&::-webkit-details-marker]:hidden">
                      <span aria-hidden className="font-mono text-[12px] transition-transform group-open:rotate-90">
                        ›
                      </span>
                      {t.landing.painLabels.details}
                    </summary>
                    <div className="px-5 pb-5">
                      <p className="text-[12px] font-semibold text-ash">{t.landing.painLabels.who}</p>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink/80">{p.who}</p>
                      <p className="mt-4 font-mono text-[11.5px] font-medium text-ledger">{t.landing.painLabels.solvedBy}</p>
                      {/* Lettered, not numbered: they are lines of one entry, not entries of their own. */}
                      <ol className="mt-1.5 border-t border-rule">
                        {p.solvedBy.map((f, j) => (
                          <li key={f.name} className="grid grid-cols-[1.2rem_minmax(0,1fr)] gap-x-2 border-b border-rule py-2.5">
                            <span aria-hidden className="pt-[3px] font-mono text-[11px] text-ledger">
                              {String.fromCharCode(97 + j)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[14px] font-semibold leading-snug text-ink">{f.name}</p>
                              <p className="mt-0.5 text-[13px] leading-relaxed text-ash">{f.does}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {/* A screenshot at card width is too small to read the part that proves
                          anything, so it opens at full size — the link's name is the image's alt. */}
                      <figure className="mt-4 border border-rule bg-white">
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
                            sizes="(max-width: 768px) 100vw, 400px"
                            className="h-auto w-full"
                          />
                        </a>
                        <figcaption className="border-t border-rule bg-paper px-3 py-2 font-mono text-[11px] leading-relaxed text-ash">
                          {p.alt}
                        </figcaption>
                      </figure>
                    </div>
                  </details>
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

      {/* ── 02 · What it can't do ────────────────────────────────────────────────────────────── */}
      <section className="border-b border-rule bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-18">
          <SectionHead n="02" title={t.landing.limitsTitle} lead={t.landing.limitsLead} />
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

      {/* ── Closing ──────────────────────────────────────────────────────────────────────────────
          The last thing on the page is the two things a reader can do next: try it, or ask. They
          sit side by side on a wide screen, and one under the other on a phone, with the try
          first — it is the one that needs nothing from the author. */}
      <section className="border-b border-rule bg-band">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
          <div className="min-w-0">
            <h2 className="max-w-[16ch] text-[1.7rem] font-semibold leading-[1.3] tracking-[-0.015em] text-ink sm:text-[2.2rem]">
              {t.landing.closingTitle}
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-[1.75] text-ink/65">{t.landing.closingBody}</p>
            <div className="mt-8">{cta}</div>
          </div>
          <Contact />
        </div>
      </section>
      {/* ── 03 · Under the hood — the page's one inverted band ─────────────────────────────────
          Last, after the closing call to action: it is how the app was built, which is worth a
          lot to a developer reading the code and nothing to someone deciding whether to try a
          spreadsheet. It used to sit in the middle of the page, between the reasons to try it
          and the limits, where everyone had to scroll through it. */}
      <section className="bg-ink">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-18">
          <SectionHead n="03" title={t.landing.statsTitle} inverted />
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
          <details className="group mt-14 border-t border-white/15 pt-8">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 text-[1.1rem] font-semibold leading-[1.45] tracking-[-0.01em] text-white sm:text-[1.25rem] [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="font-mono text-[14px] text-[#5ad0a3] transition-transform group-open:rotate-90">
                ›
              </span>
              {t.landing.statsStory.title}
            </summary>
            <div className="mt-5 space-y-4 md:pl-7">
              {t.landing.statsStory.body.map((line) => (
                <p key={line} className="max-w-3xl text-[14.5px] leading-[1.8] text-white/70">
                  {line}
                </p>
              ))}
            </div>
          </details>
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
          <Link href="/guide" className="hover:text-ink">
            {t.menu.guide}
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">
            {t.landing.contact.emailLabel}
          </a>
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
