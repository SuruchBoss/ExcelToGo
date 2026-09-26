// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { ImageResponse } from "next/og";

/**
 * The favicon, generated from the same mark the landing page header uses: a small sheet whose
 * bottom-right cell — where a total lands — is filled ledger-green. Drawn in code so it matches the
 * wordmark exactly and there is no .ico binary to keep in sync.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#fbfaf7",
          display: "flex",
          position: "relative",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 18 18">
          <rect x="0.5" y="0.5" width="17" height="17" fill="none" stroke="#16181d" strokeOpacity="0.5" />
          <path d="M6.5 0.5V17.5M12 0.5V17.5M0.5 6.5H17.5M0.5 12H17.5" stroke="#16181d" strokeOpacity="0.3" />
          <rect x="12" y="12" width="5.5" height="5.5" fill="#0b6b4f" />
        </svg>
      </div>
    ),
    size
  );
}
