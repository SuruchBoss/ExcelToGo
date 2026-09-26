// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import type { MetadataRoute } from "next";

/**
 * What a browser needs to put this on a home screen.
 *
 * Worth having for a reason beyond the icon: an app whose whole pitch is "it runs in your browser,
 * nothing is uploaded" was, until the service worker beside this, unable to open without a
 * network. That is a fair thing for someone to notice and hold against it.
 *
 * `display: standalone` rather than `fullscreen`: a spreadsheet is not a game, and taking the
 * status bar away on a phone hides the clock from somebody doing month-end.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExcelToGo — พิมพ์เป็นภาษาไทย แล้วได้สูตร Excel",
    short_name: "ExcelToGo",
    description:
      "สเปรดชีตที่ทำงานในเบราว์เซอร์ ไม่ต้องสมัคร ไม่อัปโหลดไฟล์ — พิมพ์สิ่งที่อยากได้เป็นภาษาไทยแล้วได้สูตรกลับมา",
    // Straight into the app. Somebody who installed this has already read the landing page.
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#0b6b4f",
    lang: "th",
    dir: "ltr",
    categories: ["productivity", "business", "utilities"],
    icons: [
      { src: "/pwa-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
