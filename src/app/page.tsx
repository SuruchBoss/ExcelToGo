"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Code2, Table2 } from "lucide-react";
import LanguageToggle from "@/features/toolbar/LanguageToggle";
import { useT } from "@/i18n";
import { useHydrateLocaleStore } from "@/store/localeStore";

const REPO_URL = "https://github.com/SuruchBoss/ExcelToGo";
const AUTHOR_URL = "https://github.com/SuruchBoss";

/** Paired by index with `t.landing.features`. Kept out of the message dictionaries because a file
 *  path and its pixel size are the same in every language — only the alt text needs translating. */
const FEATURE_MEDIA = [
  { src: "/screenshots/02-formula-panel.png", width: 2720, height: 1720 },
  { src: "/screenshots/04-ai-assistant.png", width: 2720, height: 1720 },
  { src: "/screenshots/10-picker-table.png", width: 1360, height: 860 },
  { src: "/screenshots/06-format-filter.png", width: 1280, height: 800 },
];

function Shot({ src, width, height, alt, priority }: { src: string; width: number; height: number; alt: string; priority?: boolean }) {
  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt={alt}
      priority={priority}
      sizes="(max-width: 768px) 100vw, 640px"
      className="h-auto w-full rounded-xl border border-zinc-200 shadow-lg shadow-zinc-900/5"
    />
  );
}

export default function Landing() {
  useHydrateLocaleStore();
  const t = useT();

  return (
    <main className="flex-1 bg-white text-zinc-800">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 text-lg font-bold text-emerald-700">
            <Table2 size={20} className="text-emerald-600" />
            {t.app.brand}
          </span>
          <div className="flex-1" />
          <LanguageToggle />
          <Link
            href="/app"
            className="rounded-md bg-emerald-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            {t.landing.backToApp}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-zinc-200 bg-gradient-to-b from-emerald-50/60 to-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t.landing.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-5xl">
            {t.landing.headline}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg">{t.landing.subheadline}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-[15px] font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              {t.landing.ctaPrimary} <ArrowRight size={17} />
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-5 py-3 text-[15px] font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <Code2 size={17} /> {t.landing.ctaSecondary}
            </a>
          </div>
          <p className="mt-3 text-xs text-zinc-500">{t.landing.ctaNote}</p>

          <div className="mt-10">
            <Image
              src="/screenshots/01-overview.png"
              width={2720}
              height={1720}
              alt={t.landing.screenshotAlt}
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="h-auto w-full rounded-xl border border-zinc-200 shadow-xl shadow-zinc-900/10"
            />
          </div>
        </div>
      </section>

      {/* Problems */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{t.landing.problemTitle}</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {t.landing.problems.map((p) => (
            <div key={p.title} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-5">
              <h3 className="text-base font-semibold text-zinc-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-zinc-200 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{t.landing.featuresTitle}</h2>
          <p className="mt-2 text-sm text-zinc-500">{t.landing.featuresSubtitle}</p>

          <div className="mt-10 flex flex-col gap-14">
            {t.landing.features.map((f, i) => {
              const media = FEATURE_MEDIA[i];
              return (
                <div key={f.title} className="grid items-center gap-7 md:grid-cols-2">
                  {/* Alternate which side the screenshot sits on, but only once there are two columns. */}
                  <div className={i % 2 === 1 ? "md:order-2" : undefined}>
                    <h3 className="text-xl font-semibold text-zinc-900">{f.title}</h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-zinc-600">{f.body}</p>
                    <ul className="mt-4 flex flex-col gap-2">
                      {f.points.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-sm text-zinc-700">
                          <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {media && <Shot src={media.src} width={media.width} height={media.height} alt={f.alt} />}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{t.landing.statsTitle}</h2>
        <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {t.landing.stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-200 p-5 text-center">
              <div className="text-3xl font-bold text-emerald-700">{s.value}</div>
              <div className="mt-1 text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-zinc-200 bg-gradient-to-b from-white to-emerald-50/70">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{t.landing.closingTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-600">{t.landing.closingBody}</p>
          <Link
            href="/app"
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            {t.landing.ctaPrimary} <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-xs text-zinc-500 sm:px-6">
          {/* The licence only compels attribution inside the source tree, which nobody using the
              app ever opens. This is the line a person actually reads. */}
          <span>
            {t.landing.builtBy}{" "}
            <a href={AUTHOR_URL} target="_blank" rel="noreferrer" className="font-medium text-zinc-700 underline-offset-2 hover:text-emerald-700 hover:underline">
              {t.landing.authorName}
            </a>
          </span>
          <span className="text-zinc-300">·</span>
          <span>{t.landing.footerNote}</span>
          <div className="flex-1" />
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-zinc-800">
            <Code2 size={14} /> GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
