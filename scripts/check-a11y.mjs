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
 *
 * A third pass opens things before checking them, for the same reason there are two widths: a page
 * as it first loads is not the only page there is. The shortcut dialog was written, the gate stayed
 * green, and running axe against it by hand found two serious violations inside it — group headings
 * at 2.62:1, and a scrolling list no keyboard could reach. Neither could ever have been caught by
 * looking at `/app` as it loads, because neither exists until someone presses a button.
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
/**
 * States that only exist once someone opens them.
 *
 * `open` does whatever it takes to get there and returns a name for the report. Keep these to
 * things a first-time visitor reaches in one press — the point is covering what the load-time scan
 * structurally cannot, not re-testing the app through a second harness.
 */
/** Opens a side panel from the button that carries this exact accessible name, then waits for it. */
const panel = (name, opener) => ({
  name,
  path: "/app",
  async open(page) {
    // These buttons toggle. On a wide screen one panel is already open — the formula palette is
    // the store's default — so a single click on it *closes* the sidebar instead of opening
    // anything. That is not hypothetical: "formula palette @1280" reported itself unopenable on
    // the first run while the same state passed at 390px, where the panel starts closed.
    const aside = page.locator("aside");
    await page.locator(opener).first().click();
    if (!(await aside.first().isVisible().catch(() => false))) {
      await page.locator(opener).first().click();
    }
    // Every panel lives in that one <aside>; waiting for a heading inside it means waiting for the
    // panel's own content rather than for the box it arrives in.
    await page.locator("aside h2, aside h3").first().waitFor({ state: "visible", timeout: 10_000 });
  },
});

const OPENED_STATES = [
  {
    name: "shortcuts dialog",
    path: "/app",
    async open(page) {
      await page.getByRole("button", { name: /^(คีย์ลัด|Keyboard shortcuts)$/ }).first().click();
      await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
    },
  },
  // Selected by the `title`/`aria-label` the button actually carries, rather than by its visible
  // text: below 640px the text is hidden and the attribute is the whole accessible name, so this
  // is the one selector that means the same thing at both widths the gate runs at.
  panel("formula palette", 'button[aria-label="สูตร"]'),
  panel("AI assistant panel", 'button[aria-label="ถาม AI"]'),
  panel("live data panel", 'button[aria-label="ข้อมูล"]'),
  panel("conditional formatting panel", 'button[title="จัดรูปแบบตามเงื่อนไข"]'),
  panel("chart panel", 'button[title="กราฟ"]'),
  panel("pivot panel", 'button[title="สรุปข้อมูล (Pivot)"]'),
  // The cloud panel — and the live-editing panel that sits inside it — is deliberately absent
  // unless a Supabase backend is configured, which it is not here and is not by default. So there
  // is no button to press and nothing to scan, and listing either would be a check that fails for
  // the wrong reason. Both are scanned when someone runs the gate against their own configured
  // instance.
  {
    name: "find and replace",
    path: "/app",
    async open(page) {
      // No button opens this one — it is a shortcut, which is also the only way a keyboard user
      // reaches it, so pressing the keys is the honest way to get there.
      await page.locator('td[data-row="0"][data-col="0"]').click();
      await page.keyboard.press("Control+f");
      await page.locator('input[type="search"], [role="dialog"], aside').first().waitFor({ state: "visible", timeout: 10_000 });
    },
  },
];
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

  for (const state of OPENED_STATES) {
    for (const width of AXE_WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + state.path, { waitUntil: "networkidle" });
      let violations = [];
      try {
        await state.open(page);
        ({ violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze());
        note(violations.length === 0, `axe ${state.name} @${width}: ${violations.length} violations`);
      } catch (err) {
        // A state that cannot be opened is a failure, not a skip: silently checking nothing is how
        // a gate goes green over a thing it stopped looking at.
        note(false, `axe ${state.name} @${width}: could not open it — ${String(err.message).split("\n")[0]}`);
      }
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
const total = PAGES.length * (AXE_WIDTHS.length + OVERFLOW_WIDTHS.length) + OPENED_STATES.length * AXE_WIDTHS.length;
console.log(`\ncheck:a11y — ${total} checks passed`);
