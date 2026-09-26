// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect } from "react";
import { buildReport, sendReport } from "@/lib/errorReport";
import { useRescue } from "@/features/crash/useRescue";

/**
 * The same rescue, one level further out: this replaces the root layout, so it catches what
 * `error.tsx` cannot — a throw in the layout itself.
 *
 * Next renders it as its own document, which means **the app's stylesheet is not loaded**: no
 * Tailwind classes, no Plex fonts, no colour tokens. Everything here is therefore inline and in a
 * system font stack. That is not a shortcut — a fallback that depends on a stylesheet loading is
 * one more thing that can fail at the moment everything else already has.
 *
 * The behaviour is shared with `error.tsx` through `useRescue`, so the two screens can look
 * nothing alike without drifting apart in what they actually do.
 */
const INK = "#16181d";
const ASH = "#6b6f76";
const RULE = "#e3e1da";
const LEDGER = "#0b6b4f";
const FONTS = 'system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif';

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { files, download } = useRescue();

  useEffect(() => {
    console.error("ExcelToGo crashed below the root layout:", error);
    // Same reporting as `error.tsx`, and the same silence by default. This boundary catches the
    // crashes the other one cannot, which are exactly the ones worth hearing about.
    sendReport(
      buildReport(error, {
        path: typeof window === "undefined" ? "" : window.location.pathname,
        userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
      })
    );
  }, [error]);

  return (
    // global-error renders its own document, so the html and body tags are required here.
    <html lang="th">
      <body style={{ margin: 0, background: "#fbfaf7", color: INK, fontFamily: FONTS }}>
        <title>ExcelToGo — มีบางอย่างพัง</title>
        <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "4rem 1.25rem" }}>
          <p aria-hidden style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.14em", color: ASH }}>
            ERROR
          </p>
          <h1 style={{ margin: "0.75rem 0 0", fontSize: "1.7rem", lineHeight: 1.3 }}>
            มีบางอย่างพัง แต่ตารางของคุณยังอยู่
          </h1>
          <p lang="en" style={{ margin: "0.5rem 0 0", fontSize: "1.05rem", fontWeight: 500, color: ASH }}>
            Something broke. Your sheet is still here.
          </p>

          <p style={{ margin: "1.5rem 0 0", borderLeft: `2px solid ${RULE}`, padding: "0 0 0 1rem", fontSize: 14.5, lineHeight: 1.7, color: ASH }}>
            ไฟล์ของคุณถูกเก็บไว้ในเบราว์เซอร์เครื่องนี้ ไม่เคยถูกส่งขึ้นเซิร์ฟเวอร์ที่ไหน
            <br />
            <span lang="en">Your file is saved in this browser and was never uploaded anywhere.</span>
          </p>

          {files.length > 0 && (
            <section style={{ marginTop: "2.5rem", borderTop: `1px solid ${INK}`, paddingTop: "1.5rem" }}>
              <h2 style={{ margin: 0, fontSize: 15.5 }}>
                เอาไฟล์ออกไปก่อนก็ได้ <span lang="en" style={{ fontWeight: 400, color: ASH }}>· Take it with you now</span>
              </h2>
              <ul style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "1rem 0 0", padding: 0, listStyle: "none" }}>
                {files.map((file) => (
                  <li key={file.filename}>
                    <button
                      onClick={() => download(file)}
                      style={{ minHeight: 44, border: `1px solid ${RULE}`, background: "#fff", color: INK, padding: "0 1rem", fontSize: 13.5, fontFamily: FONTS, cursor: "pointer" }}
                    >
                      ↓ {file.name}.csv
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "2.5rem" }}>
            <button
              onClick={() => retry()}
              style={{ minHeight: 44, border: "none", background: LEDGER, color: "#fff", padding: "0 1.25rem", fontSize: 14, fontFamily: FONTS, cursor: "pointer" }}
            >
              ลองอีกครั้ง · Try again
            </button>
            {/* A plain anchor, not next/link, and the rule is disabled on purpose: a soft
                navigation would re-render the very root layout that just threw. Only a full
                document load rebuilds it. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ display: "flex", alignItems: "center", minHeight: 44, border: `1px solid ${RULE}`, padding: "0 1.25rem", fontSize: 14, color: INK, textDecoration: "none" }}
            >
              กลับหน้าแรก · Home
            </a>
          </div>

          {error.digest && (
            <p style={{ marginTop: "2.5rem", fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: ASH }}>
              digest: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
