/**
 * The accessibility gate: axe on both pages, at a phone width and a desktop one.
 *
 * This exists because of a bug it would have caught. Every toolbar button pairs an icon with a
 * label hidden under `sm:`, so below 640px each one is a bare glyph — and eight of them carried no
 * `aria-label`, which axe rates critical: a screen reader announced "button, button, button" for
 * import, both exports, add row, add column, formulas, ask AI and data. It survived an audit that
 * had reported zero violations, because that audit ran at one desktop width, where the labels are
 * visible and the markup is fine. A responsive app has to be checked at the widths it changes at.
 *
 * Two widths, both pages, and the WCAG 2.2 tag as well as 2.0/2.1 — 2.2 is where `target-size`
 * lives, and a 23px button is a real miss on a phone even though it passes every 2.1 rule.
 *
 * Horizontal overflow is checked separately because no axe rule covers it: a page that scrolls
 * sideways on a phone is not a WCAG violation, it is just broken, and it is the failure mode that
 * a fixed-width table in a responsive layout produces first.
 *
 * The server is started and stopped here rather than by the caller, so `npm run check:a11y` is one
 * command with no setup around it. It needs a production build to exist — CI builds first, and so
 * does `npm run verify`.
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const PORT = Number(process.env.A11Y_PORT || 3123);
const ORIGIN = `http://localhost:${PORT}`;
const PAGES = ["/", "/app"];
/** The phone width the labels vanish at, and a desktop width where they don't. */
const AXE_WIDTHS = [390, 1280];
/** Narrowest phone still worth supporting, two tablet-ish sizes, two desktops. */
const OVERFLOW_WIDTHS = [360, 390, 820, 1280, 1440];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const failures = [];
const note = (ok, text) => {
  console.log(`  ${ok ? "ok " : "FAIL"}  ${text}`);
  if (!ok) failures.push(text);
};

/** Waits for the server to answer, rather than guessing how long a cold start takes. */
async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(ORIGIN + "/app");
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await delay(500);
  }
  throw new Error(`server did not answer on ${ORIGIN} within ${timeoutMs}ms`);
}

const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "production" },
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

let browser;
try {
  await waitForServer().catch((err) => {
    console.error(serverLog);
    throw err;
  });

  browser = await chromium.launch({
    // Set CHROME_PATH where Playwright's own download isn't the browser to use; CI installs one
    // and leaves this unset.
    executablePath: process.env.CHROME_PATH || undefined,
  });

  for (const path of PAGES) {
    for (const width of AXE_WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + path, { waitUntil: "networkidle" });
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      note(violations.length === 0, `axe ${path} @${width}: ${violations.length} violations`);
      for (const v of violations) {
        console.log(`        [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node(s))`);
        for (const n of v.nodes.slice(0, 3)) console.log(`          ${n.html.slice(0, 120)}`);
      }
      await ctx.close();
    }
  }

  for (const path of PAGES) {
    for (const width of OVERFLOW_WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + path, { waitUntil: "networkidle" });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      note(scrollWidth <= width, `no sideways scroll on ${path} @${width} (scrollWidth ${scrollWidth})`);
      await ctx.close();
    }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

if (failures.length > 0) {
  console.error(`\ncheck:a11y — ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\ncheck:a11y — ${PAGES.length * (AXE_WIDTHS.length + OVERFLOW_WIDTHS.length)} checks passed`);
