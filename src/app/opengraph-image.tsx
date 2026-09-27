// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { ImageResponse } from "next/og";

/**
 * The link preview a recruiter sees before they ever open the repo — in a résumé, a LinkedIn post,
 * a Slack paste. Generated rather than a committed PNG so it stays in step with the landing page's
 * ledger look and its counts, and so there is no binary to drift out of date.
 *
 * Text is English only on purpose: `next/og` ships no Thai-capable font, and loading one here would
 * mean fetching font bytes at build time. The preview is branding, not content, so Latin is enough;
 * the app itself is fully bilingual.
 */
export const alt = "ExcelToGo — describe what you want, get an Excel formula that works";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#fbfaf7";
const INK = "#16181d";
const ASH = "#6b6f76";
const RULE = "#e3e1da";
const LEDGER = "#0b6b4f";

export default function OgImage() {
  // Held to the real figures by `check:readme`, which parses this array. It said "505 automated
  // tests" for months while the suite grew past 600 — a card nobody re-reads is exactly where a
  // stale number survives longest.
  const stats = [
    ["64", "engine functions"],
    ["37", "palette formulas"],
    ["1399", "automated tests"],
    ["269", "of them security"],
    ["0", "formula libraries"],
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: PAPER,
          color: INK,
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Eyebrow, ledger green with a filled square — the landing page's own motif */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: LEDGER, fontSize: 26 }}>
          <div style={{ width: 18, height: 18, background: LEDGER }} />
          <div style={{ letterSpacing: 1 }}>ExcelToGo · a side project</div>
        </div>

        <div
          style={{
            fontSize: 70,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: -2,
            marginTop: 34,
            maxWidth: 1040,
          }}
        >
          Describe what you want. Get an Excel formula that works
        </div>

        <div style={{ fontSize: 28, color: ASH, marginTop: 22, maxWidth: 940, lineHeight: 1.4 }}>
          No syntax to memorise. No sign-up, and the file never leaves your browser.
        </div>

        <div style={{ flex: 1 }} />

        {/* Stat row on a heavy top rule, mono figures — the "under the hood" band, flattened */}
        <div style={{ display: "flex", borderTop: `2px solid ${INK}`, paddingTop: 28 }}>
          {stats.map(([value, label], i) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                paddingLeft: i === 0 ? 0 : 22,
                borderLeft: i === 0 ? "none" : `1px solid ${RULE}`,
              }}
            >
              <div style={{ fontSize: 52, fontWeight: 600, color: LEDGER }}>{value}</div>
              <div style={{ fontSize: 21, color: ASH, marginTop: 6 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
