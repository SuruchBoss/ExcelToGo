// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRescue } from "@/features/crash/useRescue";
import { buildReport, sendReport } from "@/lib/errorReport";

/**
 * What the person sees when a render throws.
 *
 * Before this existed they got Next's bare crash page: no explanation, no way back, and — the part
 * that actually matters in a spreadsheet — no sign of whether the work was gone. It was not gone,
 * every time. The whole sheet lives in `localStorage` and a render crash never touched it, but
 * nothing on the screen said so, which is indistinguishable from having lost it.
 *
 * So this page does three things, in the order the person cares about them: says the data is safe,
 * offers it as files they can keep right now, and only then offers to try again.
 *
 * It is written in both languages at once rather than through `useT`. The language store is a
 * plausible thing to have just crashed, and a fallback that depends on the app working is not a
 * fallback. Two short lines are cheaper than that risk.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { files, download } = useRescue();

  useEffect(() => {
    console.error("ExcelToGo crashed while rendering:", error);
    // And, if this deployment configured somewhere to send it, a scrubbed report — so a bug that
    // only fires on one imported file is not something the operator finds out about never. Nothing
    // is sent unless `NEXT_PUBLIC_ERROR_REPORT_URL` is set, which no default deployment does; see
    // `lib/errorReport.ts` for the fixed list of what a report may contain.
    sendReport(
      buildReport(error, {
        path: typeof window === "undefined" ? "" : window.location.pathname,
        userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
      })
    );
  }, [error]);

  return (
    <main className="min-h-dvh bg-paper px-4 py-16 text-ink sm:px-8 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <p aria-hidden className="font-mono text-[11px] tracking-[0.14em] text-ash">ERROR</p>
        <h1 className="mt-3 text-[1.6rem] font-semibold leading-[1.3] tracking-[-0.015em] sm:text-[2.1rem]">
          มีบางอย่างพัง แต่ตารางของคุณยังอยู่
        </h1>
        <p lang="en" className="mt-2 text-[1.05rem] font-medium leading-snug text-ash">
          Something broke. Your sheet is still here.
        </p>

        <p className="mt-6 border-l-2 border-rule pl-4 text-[14.5px] leading-relaxed text-ash">
          ไฟล์ของคุณถูกเก็บไว้ในเบราว์เซอร์เครื่องนี้ ไม่เคยถูกส่งขึ้นเซิร์ฟเวอร์ที่ไหน สิ่งที่พังคือหน้าจอ ไม่ใช่ข้อมูล
          <br />
          <span lang="en">
            Your file is saved in this browser and was never uploaded anywhere. What broke is the screen, not the data.
          </span>
        </p>

        {files.length > 0 && (
          <section className="mt-10 border-t border-ink pt-6">
            <h2 className="text-[15.5px] font-semibold">
              เอาไฟล์ออกไปก่อนก็ได้ <span lang="en" className="font-normal text-ash">· Take it with you now</span>
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ash">
              ดาวน์โหลดเป็น CSV ได้เลยโดยไม่ต้องรอให้แอปกลับมา — สูตรจะออกไปเป็นข้อความอย่างที่พิมพ์ไว้
              <span lang="en"> · Downloads as CSV without waiting for the app to come back; formulas come out as the text you typed.</span>
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {files.map((file) => (
                <li key={file.filename}>
                  <button
                    onClick={() => download(file)}
                    className="min-h-11 border border-rule bg-white px-4 text-[13.5px] font-medium transition-colors hover:border-ink/40 hover:bg-band/50"
                  >
                    ↓ {file.name}
                    <span className="ml-2 font-mono text-[11px] text-ash">.csv</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <button
            onClick={() => retry()}
            className="min-h-11 bg-ledger px-5 text-[14px] font-medium text-white transition-colors hover:bg-ledger-ink"
          >
            ลองอีกครั้ง <span lang="en" className="font-normal opacity-80">· Try again</span>
          </button>
          <Link
            href="/"
            className="flex min-h-11 items-center border border-rule px-5 text-[14px] font-medium transition-colors hover:border-ink/40"
          >
            กลับหน้าแรก <span lang="en" className="ml-1.5 font-normal text-ash">· Home</span>
          </Link>
        </div>

        {error.digest && (
          // The only thing worth quoting in a bug report: React's own hash of the error, which is
          // all a production build discloses about it.
          <p className="mt-10 font-mono text-[11.5px] text-ash">
            digest: <span className="select-all">{error.digest}</span>
          </p>
        )}
      </div>
    </main>
  );
}
