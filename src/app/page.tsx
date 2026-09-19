"use client";

import Image from "next/image";
import Link from "next/link";
import LanguageToggle from "@/features/toolbar/LanguageToggle";
import LiveSheet from "@/features/landing/LiveSheet";
import SkipLink from "@/features/a11y/SkipLink";
import { useT } from "@/i18n";
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

/** Paired by index with `t.landing.features`. Kept out of the message dictionaries because a file
 *  path and its pixel size are the same in every language — only the alt text needs translating. */
/** Paired by index with `landing.features` in the message files — reorder one, reorder both. */
// Paired with `t.landing.features` by index, so the two lists move together or not at all.
const FEATURE_MEDIA = [
  { src: "/screenshots/04-ai-assistant.png", width: 2720, height: 1720 },
  // Animated, so it shows the one thing a still cannot: the number arriving in the cell, and then
  // changing again on its own. `unoptimized` because the optimiser returns a single still frame.
  { src: "/screenshots/34-live-data.gif", width: 820, height: 478, unoptimized: true },
  { src: "/screenshots/02-formula-panel.png", width: 2720, height: 1720 },
  { src: "/screenshots/17-styled-import.png", width: 2720, height: 1720 },
  { src: "/screenshots/20-charts.png", width: 1440, height: 900 },
];

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
function SectionHead({ n, title, lead, inverted }: { n: string; title: string; lead?: string; inverted?: boolean }) {
  return (
    <div className={`border-b pb-4 ${inverted ? "border-white/25" : "border-ink"}`}>
      <div className="flex items-baseline gap-3 sm:gap-5">
        <span className={`tabular-nums font-mono text-[11px] font-medium ${inverted ? "text-[#5ad0a3]" : "text-ledger"}`}>{n}</span>
        <h2
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

      {/* ── Where this differs ───────────────────────────────────────────────────────────────
          Unnumbered on purpose: it belongs to the pitch, not to the numbered tour below it.
          The first thing a visitor thinks is "Sheets already does this", and they are right, so
          the page answers it here instead of hoping they read far enough to find out. Every row
          is a checkable fact, and the row the app loses is in the table too — a comparison that
          only the author wins is one nobody believes. */}
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

      {/* ── 01 · Scenario → pain → what happens here → what you get ─────────────────────────── */}
      <section className="border-b border-rule bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-18">
          <SectionHead n="01" title={t.landing.problemTitle} lead={t.landing.problemLead} />
          {/* An <ol>, because the scenarios are numbered on screen. The printed numbers only
              repeat the list's own ordering, so they are decorative. */}
          <ol className="mt-1">
            {t.landing.problems.map((p, i) => (
              <li
                key={p.scenario}
                className={`flex gap-3 border-b border-rule px-2 py-7 sm:gap-4 sm:px-3 ${i % 2 === 1 ? "bg-band/40" : ""}`}
              >
                <span aria-hidden className="tabular-nums shrink-0 pt-[0.2rem] font-mono text-[11px] text-ash">
                  {num(i)}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15.5px] font-semibold leading-snug text-ink sm:text-[1.05rem]">{p.scenario}</h3>
                  {/* The same three labels on every scenario, on purpose: once a reader has seen
                      them, they can skim straight to the only line they came for — the last one. */}
                  <dl className="mt-3.5 space-y-2.5">
                    {(
                      [
                        [t.landing.problemLabels.pain, p.pain, false],
                        [t.landing.problemLabels.solution, p.solution, false],
                        [t.landing.problemLabels.gain, p.gain, true],
                      ] as const
                    ).map(([label, body, isGain]) => (
                      <div key={label} className="grid gap-x-5 gap-y-0.5 sm:grid-cols-[minmax(0,9rem)_1fr]">
                        <dt className={`text-[12.5px] font-semibold leading-relaxed ${isGain ? "text-ledger" : "text-ash"}`}>
                          {label}
                        </dt>
                        <dd className={`text-[14.5px] leading-relaxed ${isGain ? "font-medium text-ink" : "text-ash"}`}>
                          {body}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 02 · What it does ────────────────────────────────────────────────────────────────── */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-18">
          <SectionHead n="02" title={t.landing.featuresTitle} lead={t.landing.featuresSubtitle} />

          <div className="mt-2">
            {t.landing.features.map((f, i) => {
              const media = FEATURE_MEDIA[i];
              // One feature has no exhibit — the live session only exists once someone attaches a
              // Supabase project, and this page says every image on it was taken from the running
              // app. So it lays out as one column rather than leaving half the row empty, capped at
              // the measure the two-column rows already read at.
              const exhibited = media && f.alt;
              return (
                <article
                  key={f.title}
                  className={
                    "grid items-start gap-7 border-b border-rule py-10 md:gap-12 lg:py-12 " +
                    (exhibited ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : "")
                  }
                >
                  {/* Alternate which side the exhibit sits on, but only once there are two columns. */}
                  <div className={`min-w-0 ${exhibited ? (i % 2 === 1 ? "md:order-2" : "") : "md:max-w-[38rem]"}`}>
                    <span className="tabular-nums font-mono text-[11px] text-ash">{num(i)}</span>
                    <h3 className="mt-2.5 text-[1.2rem] font-semibold leading-[1.4] tracking-[-0.01em] text-ink sm:text-[1.35rem]">
                      {f.title}
                    </h3>
                    <p className="mt-3 text-[14.5px] leading-[1.75] text-ash">{f.body}</p>
                    <ul className="mt-5 border-t border-rule">
                      {f.points.map((point) => (
                        <li key={point} className="flex items-start gap-3 border-b border-rule py-2.5 text-[13.5px] leading-relaxed text-ink">
                          <span className="mt-[7px] h-[4px] w-[4px] shrink-0 bg-ledger" aria-hidden />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {media && f.alt && (
                    <figure className="min-w-0 border border-rule bg-white">
                      <Image
                        src={media.src}
                        width={media.width}
                        height={media.height}
                        unoptimized={"unoptimized" in media && media.unoptimized}
                        alt={f.alt}
                        sizes="(max-width: 768px) 100vw, 620px"
                        className="h-auto w-full"
                      />
                      {/* Styled as the formula bar, so an exhibit reads as part of the same instrument. */}
                      <figcaption className="border-t border-rule bg-paper px-3 py-2 font-mono text-[11px] text-ash">
                        {f.alt}
                      </figcaption>
                    </figure>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 03 · Under the hood — the page's one inverted band ───────────────────────────────── */}
      <section className="bg-ink">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-18">
          <SectionHead n="03" title={t.landing.statsTitle} inverted />
          <dl className="mt-10 grid grid-cols-2 gap-y-9 sm:grid-cols-5 sm:gap-y-0">
            {t.landing.stats.map((s, i) => (
              <div key={s.label} className={`px-1 sm:px-6 ${i > 0 ? "sm:border-l sm:border-white/15" : ""} ${i === 0 ? "sm:pl-0" : ""}`}>
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

      {/* ── 04 · What it can't do ────────────────────────────────────────────────────────────── */}
      <section className="border-b border-rule bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-18">
          <SectionHead n="04" title={t.landing.limitsTitle} lead={t.landing.limitsLead} />
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
