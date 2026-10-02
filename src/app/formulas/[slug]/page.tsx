// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { th } from "@/i18n/th";
import { getFormulaById } from "@/lib/formulaCatalog";
import { computeLesson, lessonBySlug, lessonColumns, lessonForId, lessonFormula, lessonPath } from "@/lib/lessons";
import { breadcrumbJsonLd, formulasTrail, jsonLdScript, lessonMetadata } from "@/lib/seo";
import FormulasShell from "@/features/lessons/FormulasShell";
import LessonTable from "@/features/lessons/LessonTable";

/**
 * One formula, taught (#149): what it does in a sentence, its shape, an example worked out by the
 * app's own engine, the mistakes people make with it — each shown with what the engine really gives
 * — and a button that opens the example in the sheet.
 *
 * Rendered on the server, so a crawler and a slow phone get the whole page without JavaScript.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const lesson = lessonBySlug((await params).slug);
  return lesson ? lessonMetadata(lesson) : {};
}

/** The argument names as the syntax writes them — `sum_range`, `[exact]` — in order. */
function syntaxArgs(syntax: string): string[] {
  const inside = syntax.slice(syntax.indexOf("(") + 1, syntax.lastIndexOf(")"));
  return inside.split(",").map((a) => a.trim());
}

export default async function FormulaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = lessonBySlug(slug);
  if (!lesson) {
    // A typed-in /formulas/SUMIF is the same page: send it to the one address it lives at (308), so
    // a link someone wrote by hand keeps working and search engines see one URL, not two.
    const lower = lessonBySlug(slug.toLowerCase());
    if (lower) permanentRedirect(lessonPath(lower));
    notFound();
  }

  const def = getFormulaById(th, lesson.id)!;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const formula = lessonFormula(lesson);
  const right = computeLesson(lesson);
  const args = syntaxArgs(def.syntax);
  const related = lesson.related.map((id) => lessonForId(id)).filter((l) => l !== undefined);

  return (
    <FormulasShell trail={[{ name: "หน้าแรก", href: "/" }, { name: "สูตร Excel", href: "/formulas" }, { name: lesson.id }]}>
      <script
        type="application/ld+json"
        nonce={nonce}
        // Our own constant data, serialised with `<` escaped (see jsonLdScript).
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(formulasTrail(lesson))) }}
      />
      <p className="font-mono text-[11.5px] text-ledger">{th.categories[def.categoryKey]}</p>
      <h1 className="mt-2 text-[1.9rem] font-semibold leading-[1.25] tracking-[-0.02em] sm:text-[2.4rem]">สูตร {lesson.id}</h1>
      <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-ink/85">{lesson.lead}</p>

      <section aria-labelledby="shape" className="mt-9">
        <h2 id="shape" className="text-[1.15rem] font-semibold">
          รูปแบบ
        </h2>
        <p className="mt-3 border border-rule bg-white px-4 py-3 font-mono text-[14px] leading-relaxed [overflow-wrap:anywhere]">={def.syntax}</p>
        <dl className="mt-3 divide-y divide-rule border-y border-rule">
          {def.params.map((p, i) => (
            <div key={p.key} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
              <dt className="font-mono text-[13px] text-ledger-ink">{args[i] ?? p.key}</dt>
              <dd className="text-[14px] leading-relaxed text-ink/85">
                {p.label}
                {p.placeholder && <span className="text-ash"> · {p.placeholder}</span>}
                {p.optional && <span className="text-ash"> · ไม่บังคับ</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="example" className="mt-10">
        <h2 id="example" className="text-[1.15rem] font-semibold">
          ตัวอย่าง: {lesson.example.caption}
        </h2>
        <div className="mt-4">
          <LessonTable
            columns={lessonColumns(lesson)}
            computed={right}
            result={lesson.example.result}
            picked={lesson.example.picked}
            caption={lesson.example.caption}
            formula={formula}
          />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[14px] [overflow-wrap:anywhere]">
            <span className="text-ash">{lesson.example.result}</span> {formula}
            <span className="font-sans text-ash"> → </span>
            <span data-lesson-result className="font-sans font-semibold">
              {right.result}
            </span>
          </p>
          <Link
            href={`/app?lesson=${lesson.slug}`}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 bg-ledger px-5 text-[14.5px] font-medium text-white hover:bg-ledger-ink sm:w-auto"
          >
            ลองในตาราง<span aria-hidden className="font-mono">→</span>
          </Link>
        </div>
        <p className="mt-4 max-w-[62ch] border-l-2 border-ledger pl-3.5 text-[14.5px] leading-relaxed text-ink/85">{lesson.example.explain}</p>
      </section>

      <section aria-labelledby="mistakes" className="mt-12">
        <h2 id="mistakes" className="text-[1.15rem] font-semibold">
          ข้อผิดพลาดที่เจอบ่อย
        </h2>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {lesson.mistakes.map((m) => {
            const wrong = computeLesson(lesson, m);
            return (
              <li key={m.title} className="py-4">
                <h3 className="text-[15.5px] font-semibold">{m.title}</h3>
                <p className="mt-2 font-mono text-[13.5px] [overflow-wrap:anywhere]">
                  {m.cells &&
                    Object.entries(m.cells).map(([ref, raw]) => (
                      <span key={ref} className="mr-3 inline-block">
                        <span className="text-ash">{ref}</span> &quot;{raw}&quot;
                      </span>
                    ))}
                  {m.formula && (
                    <span className="inline-block">
                      <span className="text-ash">{lesson.example.result}</span> {m.formula}
                    </span>
                  )}
                </p>
                <p className="mt-1.5 text-[14px]">
                  ได้ <span className={`font-semibold ${wrong.isError ? "text-ref" : ""}`}>{wrong.result}</span>
                  <span className="text-ash"> แทนที่จะเป็น {right.result}</span>
                </p>
                <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-ink/80">{m.why}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {related.length > 0 && (
        <nav aria-labelledby="related" className="mt-12">
          <h2 id="related" className="text-[1.15rem] font-semibold">
            สูตรที่ใช้คู่กันบ่อย
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {related.map((l) => (
              <li key={l.slug}>
                <Link
                  href={lessonPath(l)}
                  className="inline-flex min-h-11 items-center border border-rule bg-white px-4 font-mono text-[13.5px] text-ledger-ink hover:border-ink/40"
                >
                  {l.id}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </FormulasShell>
  );
}
