// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

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
const ALL_AXE_WIDTHS = [390, 1280];
/** Narrowest phone still worth supporting, two tablet-ish sizes, two desktops. */
const ALL_OVERFLOW_WIDTHS = [360, 390, 820, 1280, 1440];

/**
 * Optionally, half the work — because this gate is the longest thing in CI.
 *
 * Every other job finishes while this one is still scanning, so the whole run waits on it and on
 * nothing else. Almost all of that is the opened states: each one is a fresh page, a click and a
 * full axe pass, once per axe width. Splitting by axe width halves the critical path, and because
 * the two halves run as separate jobs a red cross also says which width broke without opening the
 * log — the same reason `e2e` is not a step in this job.
 *
 * `A11Y_WIDTH` picks a half. Unset — which is what `npm run verify` does — runs everything, so a
 * person running the gate by hand gets the whole gate rather than a quiet fraction of it.
 */
const SHARDS = {
  390: [360, 390, 820],
  1280: [1280, 1440],
};

const requested = process.env.A11Y_WIDTH?.trim();
if (requested && !(requested in SHARDS)) {
  // Loudly: a typo here would otherwise be a gate that passes by scanning nothing.
  console.error(`check:a11y — A11Y_WIDTH=${requested} is not a shard. Use one of ${Object.keys(SHARDS).join(", ")}.`);
  process.exit(1);
}

/**
 * The shards together must still be the whole gate.
 *
 * Checked rather than trusted: the failure mode of a split gate is somebody adding a width to one
 * list and not to the other, which loses coverage silently and looks exactly like a pass.
 */
{
  const covered = Object.values(SHARDS).flat();
  const missing = ALL_OVERFLOW_WIDTHS.filter((w) => !covered.includes(w));
  const extra = covered.filter((w) => !ALL_OVERFLOW_WIDTHS.includes(w));
  const unsharded = ALL_AXE_WIDTHS.filter((w) => !(w in SHARDS));
  if (missing.length || extra.length || unsharded.length) {
    console.error(
      `check:a11y — the shards do not add up to the gate:` +
        (missing.length ? ` overflow widths in no shard: ${missing.join(", ")}.` : "") +
        (extra.length ? ` shard widths that are not overflow widths: ${extra.join(", ")}.` : "") +
        (unsharded.length ? ` axe widths with no shard: ${unsharded.join(", ")}.` : "")
    );
    process.exit(1);
  }
}

const AXE_WIDTHS = requested ? [Number(requested)] : ALL_AXE_WIDTHS;
const OVERFLOW_WIDTHS = requested ? SHARDS[requested] : ALL_OVERFLOW_WIDTHS;
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
    // Not an <aside> panel, so it cannot use `panel()`: it is a popover pinned to the button that
    // opened it, living inside the format bar — which is itself collapsed on a narrow screen.
    // Both of those are reasons it is easy to leave unscanned, which is the reason it is here.
    name: "validation popover",
    path: "/app",
    async open(page) {
      const bar = page.locator('button[title="จำกัดสิ่งที่กรอกได้ในช่องที่เลือก"]');
      if (!(await bar.first().isVisible().catch(() => false))) {
        await page.locator('button[title="แสดงแถบรูปแบบ"]').first().click();
      }
      await bar.first().click();
      await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 10_000 });
    },
  },
  {
    // Only ever shown when the browser refuses a save — a workbook past the storage quota — so it
    // is exactly the kind of state a scan of the page as it loads never sees. Any state change
    // saves, so selecting a cell is enough to raise it once saves are refused.
    name: "save refused alert",
    path: "/app",
    async open(page) {
      await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === "exceltogo-sheet-v2") throw new DOMException("quota", "QuotaExceededError");
          return original.call(this, key, value);
        };
      });
      await page.locator('td[data-row="1"][data-col="1"]').click();
      // Filtered: Next.js keeps a `role="alert"` route announcer of its own on every page.
      await page
        .getByRole("alert")
        .filter({ has: page.getByRole("button", { name: /^(ส่งออก Excel|Export Excel)$/ }) })
        .waitFor({ state: "visible", timeout: 10_000 });
    },
  },
  {
    name: "names popover",
    path: "/app",
    async open(page) {
      const bar = page.locator('button[title="ตั้งชื่อให้ช่วงที่เลือก"]');
      if (!(await bar.first().isVisible().catch(() => false))) {
        await page.locator('button[title="แสดงแถบรูปแบบ"]').first().click();
      }
      await bar.first().click();
      await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 10_000 });
    },
  },
  {
    name: "cell comment popover",
    path: "/app",
    async open(page) {
      // The comment box needs one cell selected, which is the app's own starting state; clicking
      // one first is what a person does and what keeps this from depending on that default.
      await page.locator('td[data-row="0"][data-col="0"]').click();
      const button = page.locator('button[title="คอมเมนต์ในเซลล์"]');
      if (!(await button.first().isVisible().catch(() => false))) {
        await page.locator('button[title="แสดงแถบรูปแบบ"]').first().click();
      }
      await button.first().click();
      await page.locator("textarea").first().waitFor({ state: "visible", timeout: 10_000 });
    },
  },
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
// Says which half it was, so "36 checks passed" and "22 checks passed" are not confusable.
const scope = requested ? ` at ${requested}px` : "";
console.log(`\ncheck:a11y — ${total} checks passed${scope}`);
