#!/usr/bin/env node
// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Every advisory `npm audit` reports is either fixed or written down — with a reason and a date.
 *
 * `npm audit` on its own is not a gate. Run it and you get a number that nobody owns: too noisy to
 * block a build, too quiet to act on, and after a week everyone has learned to scroll past it. The
 * useful question is not "are there advisories" but "has anyone looked at *this* one, and would
 * they still say the same thing today".
 *
 * So each known advisory needs an entry below saying why it is being lived with and when that
 * decision expires. An advisory with no entry fails the build. An entry past its date fails the
 * build too, which is the part that matters: an accepted risk with no expiry is not a decision, it
 * is a habit.
 *
 * Offline-friendly on purpose: `npm audit` needs the registry, and a gate that turns red because a
 * network was unavailable teaches people to ignore it. No registry, no verdict — and it says so.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Advisories looked at, and what was decided.
 *
 * `production` says whether the package reaches a browser. It is the difference between a bug in
 * something the user runs and a bug in something that only ever ran on a build machine — related
 * risks, but not the same one, and worth stating rather than blurring.
 */
const ACCEPTED = [
  {
    id: "GHSA-82fw-gwwq-j7x9",
    package: "@vitest/mocker",
    production: false,
    why:
      "Path traversal through Vitest's mock redirect. Reachable only by a test file that asks for " +
      "it, which is to say by code already running as the developer. The fix is Vitest 5, a major " +
      "version whose migration is worth doing deliberately rather than under a red build.",
    reviewBy: "2026-12-31",
  },
  {
    id: "GHSA-w5hq-g745-h8pq",
    package: "uuid",
    production: true,
    why:
      "Missing bounds check in uuid v3/v5/v6 when the caller passes its own buffer. ExcelJS pulls " +
      "uuid in and uses v4 without a buffer, so the vulnerable path is not reached from here. The " +
      "fix is ExcelJS 3.4, which is a downgrade — this project needs 4.x for the styling and chart " +
      "parts of the export.",
    reviewBy: "2026-12-31",
  },
  {
    id: "GHSA-vfj7-8cjw-p6xm",
    package: "braces",
    production: false,
    why:
      "Stack exhaustion on deeply nested brace patterns. braces arrives only through lint: " +
      "eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces, all under " +
      "devDependencies, so none of it is in the bundle a visitor loads. The patterns it expands come " +
      "from the lint config in this repository, never from outside input. No fixed braces exists yet " +
      "(every version up to 3.0.3, the latest, is affected), and npm's only offer is eslint-config-next " +
      "14, which this Next 16 project cannot use. Review sooner if braces ships a fix: the entry then " +
      "goes stale and fails the gate on its own.",
    reviewBy: "2026-11-30",
  },
];

/**
 * Dependencies kept where they are on purpose, written down the same way (#73).
 *
 * An advisory is not the only reason to look at a package again. A dormant library the export
 * depends on, or a major version blocked by something upstream, is a decision too — and without a
 * date it stops being one. Each hold names what would change the answer (`trigger`) and when to
 * look again even if nothing has (`reviewBy`). Past its date the gate fails, whatever the network
 * is doing: this part needs no registry. And if the installed version no longer matches `range`,
 * the entry describes a package this project does not have any more, and it fails too.
 */
const HELD = [
  {
    package: "exceljs",
    range: /^4\./,
    why:
      "Dormant: last release 4.4.0 (2023-10-19), last commit 2025-01, ~800 open issues, not " +
      "archived. It reads and writes every .xlsx the app touches — cells, styles, merges, " +
      "validation, the chart parts the export splices in — and it works. Replacing it is a large " +
      "change to import and export, with nothing broken today to pay for it.",
    trigger:
      "Replace it when a new advisory lands on its parse path (opening an untrusted .xlsx), when a " +
      "file Excel writes stops opening, or when the repository is archived.",
    reviewBy: "2027-03-31",
  },
  {
    package: "typescript",
    range: /^5\./,
    why:
      "TypeScript 7 is held: typescript-eslint, through eslint-config-next, requires < 6.1. 6.0 is " +
      "a planned upgrade of its own, not part of the pause. Dependabot ignores >= 7 (dependabot.yml).",
    trigger: "Lift the hold when eslint-config-next's typescript-eslint accepts the new major.",
    reviewBy: "2027-03-31",
  },
  {
    package: "eslint",
    range: /^9\./,
    why:
      "ESLint 10 is held: the React, import and jsx-a11y plugins eslint-config-next brings do not " +
      "support it yet, and it needs Node >= 22.13. Dependabot ignores >= 10 (dependabot.yml).",
    trigger: "Lift the hold when eslint-config-next supports ESLint 10.",
    reviewBy: "2027-03-31",
  },
];

/** The version actually installed, from its own package.json — what a hold is about. */
function installed(name) {
  try {
    return JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8")).version;
  } catch {
    return null;
  }
}

const holdFailures = [];
const holdToday = new Date().toISOString().slice(0, 10);
console.log("check:deps — dependencies held on purpose\n");
for (const hold of HELD) {
  const version = installed(hold.package);
  if (version && !hold.range.test(version)) {
    holdFailures.push(`stale hold: ${hold.package} is ${version} now; update or delete its entry in HELD`);
    console.log(`  stale    ${hold.package} ${version} — the hold was written for ${hold.range}`);
  } else if (hold.reviewBy < holdToday) {
    holdFailures.push(`expired hold: ${hold.package} was held until ${hold.reviewBy}; decide again (${hold.trigger})`);
    console.log(`  EXPIRED  ${hold.package} — held until ${hold.reviewBy}`);
  } else {
    console.log(`  held     ${hold.package} ${version ?? "(not installed)"} — review by ${hold.reviewBy}`);
  }
}
console.log("");

function audit() {
  try {
    const out = execFileSync("npm", ["audit", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return JSON.parse(out);
  } catch (e) {
    // `npm audit` exits non-zero when it finds anything, and still prints the report.
    const text = e.stdout?.toString() ?? "";
    if (text.trim().startsWith("{")) return JSON.parse(text);
    console.log("check:deps — could not reach the registry, so nothing was checked.");
    console.log(`  ${(e.stderr?.toString() ?? e.message).split("\n")[0]}`);
    // The holds needed no registry, so what they found still counts.
    for (const f of holdFailures) console.log(`  ✗ ${f}`);
    process.exit(holdFailures.length > 0 ? 1 : 0);
  }
}

const report = audit();
const today = new Date().toISOString().slice(0, 10);
const byId = new Map(ACCEPTED.map((a) => [a.id, a]));

/** Advisory ids as npm reports them, flattened out of the per-package tree. */
const found = new Map();
for (const [name, entry] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of entry.via ?? []) {
    if (typeof via === "string") continue;
    const id = via.url?.split("/").pop();
    if (!id) continue;
    found.set(id, { id, package: via.name ?? name, severity: via.severity, title: via.title, url: via.url });
  }
}

const failures = [...holdFailures];
console.log(`check:deps — ${found.size} advisor${found.size === 1 ? "y" : "ies"} in the tree\n`);

for (const advisory of found.values()) {
  const accepted = byId.get(advisory.id);
  if (!accepted) {
    failures.push(`unreviewed: ${advisory.package} ${advisory.severity} ${advisory.id} — ${advisory.title}`);
    console.log(`  NEW      ${advisory.package} (${advisory.severity}) ${advisory.id}`);
    continue;
  }
  if (accepted.reviewBy < today) {
    failures.push(`expired: ${advisory.id} was accepted until ${accepted.reviewBy}; look at it again`);
    console.log(`  EXPIRED  ${advisory.package} ${advisory.id} — accepted until ${accepted.reviewBy}`);
    continue;
  }
  console.log(`  accepted ${advisory.package} (${advisory.severity}) ${advisory.id} — review by ${accepted.reviewBy}`);
}

// An entry for something that is no longer reported is dead weight, and dead weight in a list like
// this is how the list stops being read.
for (const accepted of ACCEPTED) {
  if (!found.has(accepted.id)) {
    console.log(`  stale    ${accepted.package} ${accepted.id} is no longer reported — remove its entry`);
    failures.push(`stale entry: ${accepted.id} is fixed or gone; delete it from ACCEPTED`);
  }
}

if (failures.length > 0) {
  console.log("\ncheck:deps failed:");
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log("\nFix it, or add an entry to ACCEPTED (or HELD) in scripts/check-deps.mjs with a reason and a date.");
  process.exit(1);
}
console.log("\ncheck:deps — every advisory is either fixed or accounted for.");
