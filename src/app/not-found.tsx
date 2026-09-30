// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import Link from "next/link";

// Next already sends 404 with `noindex`; the title is for the tab of whoever followed a bad link.
export const metadata: Metadata = {
  title: { absolute: "ไม่พบหน้านี้ · Page not found · ExcelToGo" },
};

/**
 * A mistyped or stale link on a Thai site used to land on Next's English default, "This page could
 * not be found.", with nowhere to go (#148). Now it says so in both languages and offers the two
 * places a visitor most likely wanted.
 *
 * Both languages at once rather than through `useT`, like `error.tsx`: this is a server page with no
 * language store behind it, and two short lines cost less than a client bundle for a dead end.
 */
export default function NotFound() {
  return (
    <main id="main-content" className="min-h-dvh bg-paper px-4 py-16 text-ink sm:px-8 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <p aria-hidden className="font-mono text-[11px] tracking-[0.14em] text-ash">
          404
        </p>
        <h1 className="mt-3 text-[1.6rem] font-semibold leading-[1.3] tracking-[-0.015em] sm:text-[2.1rem]">ไม่พบหน้านี้</h1>
        <p lang="en" className="mt-2 text-[1.05rem] font-medium leading-snug text-ash">
          This page could not be found.
        </p>
        <p className="mt-6 border-l-2 border-rule pl-4 text-[14.5px] leading-relaxed text-ash">
          ลิงก์อาจพิมพ์ผิดหรือเก่าแล้ว งานในตารางของคุณไม่ได้หายไปไหน ยังอยู่ในเบราว์เซอร์เครื่องนี้
          <br />
          <span lang="en">The link may be mistyped or out of date. Your sheet is untouched; it is still in this browser.</span>
        </p>
        <nav aria-label="ไปต่อ · Go on" className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center bg-ink px-5 text-[14.5px] font-medium text-paper hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            เปิดตาราง<span lang="en" className="ml-1.5 text-paper/75">· Open the sheet</span>
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center border border-ink px-5 text-[14.5px] font-medium text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            หน้าแรก<span lang="en" className="ml-1.5 text-ash">· Home</span>
          </Link>
        </nav>
      </div>
    </main>
  );
}
