// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { th } from "@/i18n/th";
import { CATEGORY_KEYS, getFormulaCatalog } from "@/lib/formulaCatalog";
import { LESSONS, lessonPath } from "@/lib/lessons";
import { breadcrumbJsonLd, formulasIndexMetadata, formulasTrail, jsonLdScript } from "@/lib/seo";
import FormulasShell from "@/features/lessons/FormulasShell";

export const metadata: Metadata = formulasIndexMetadata();

/**
 * Every formula that has a page (#149), grouped the way the app's palette groups them, and a line
 * saying how many more the palette explains. That number is counted from the palette, not typed.
 */
export default async function FormulasIndex() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const catalog = getFormulaCatalog(th);
  const byId = new Map(catalog.map((f) => [f.id, f]));
  const groups = CATEGORY_KEYS.map((key) => ({
    key,
    lessons: LESSONS.filter((l) => byId.get(l.id)?.categoryKey === key),
  })).filter((g) => g.lessons.length > 0);
  const more = catalog.length - LESSONS.length;

  return (
    <FormulasShell trail={[{ name: "หน้าแรก", href: "/" }, { name: "สูตร Excel" }]}>
      <script
        type="application/ld+json"
        nonce={nonce}
        // Our own constant data, serialised with `<` escaped (see jsonLdScript).
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(formulasTrail())) }}
      />
      <h1 className="text-[1.9rem] font-semibold leading-[1.25] tracking-[-0.02em] sm:text-[2.4rem]">สูตร Excel ที่ใช้บ่อย</h1>
      <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-ink/85">
        อธิบายทีละสูตรเป็นภาษาไทย แต่ละหน้ามีตัวอย่างที่แอปคำนวณจริง ข้อผิดพลาดที่เจอบ่อย และปุ่มเปิดตัวอย่างในตาราง
      </p>

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`cat-${g.key}`} className="mt-10">
          <h2 id={`cat-${g.key}`} className="border-b border-ink pb-2 text-[1.15rem] font-semibold">
            {th.categories[g.key]}
          </h2>
          <ul className="divide-y divide-rule">
            {g.lessons.map((l) => (
              <li key={l.slug}>
                <Link href={lessonPath(l)} className="group grid gap-1 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                  <span className="font-mono text-[15px] font-semibold text-ledger-ink group-hover:underline">{l.id}</span>
                  <span className="text-[14.5px] leading-relaxed text-ink/85">{l.lead}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-10 max-w-[62ch] border-l-2 border-ledger pl-3.5 text-[14.5px] leading-relaxed text-ink/85">
        สูตรอีก {more} แบบมีคำอธิบายอยู่ในแถบสูตรของแอป{" "}
        <Link href="/app" className="font-medium text-ledger-ink underline underline-offset-2 hover:text-ink">
          เปิดตาราง
        </Link>
      </p>
    </FormulasShell>
  );
}
