# Code Health Audit — ExcelToGo (pass 2)
**Scope:** the whole app on `main` @ `a7e0c5a`. This pass covers what pass 1 did not: dependency and version health, **measured** performance, and a functional QA survey of every README feature in a real browser. Architecture and tech debt were already filed as #33–#35 and are not repeated here.
**Baseline:** lint ✓ · check:readme ✓ · check:screens ✓ (88 images) · check:deps ✓ (2 advisories, both written down) · **1,399 tests** ✓ · mutants ✓ · build ✓ · a11y and e2e ✓ (pass 1, with `CHROME_PATH` set).
**Date:** 2026-09-27 · **Functional bug list:** `bug-report-2026-09-27.md` (64 bugs) · **PO plan:** `po-handoff-2026-09-27.md` · Security findings, if any, go through private vulnerability reporting per AGENTS.md and are never in this folder.

> **Status after this audit.** Sprint A (`4fbac05`) and #23 (`0baa2c5`) merged into main after the build tested here. They closed pass-1 issues #20, #21, #22, #23, #24, #26, #27, #28 and #31, and added a "Text" number format with one `literalValue` (leading zeros, 12+ digits and a leading apostrophe stay text). The findings below still describe `a7e0c5a`. Pass-2 issues #40–#77 were filed against it and are still open. The Sprint A fixes are not re-verified by QA yet.

## Executive summary

**The engine and the page shell are in very good shape.**
- The first page loads fast: LCP 224–284 ms, 271 KB of JS.
- The formula engine checks out by hand, and the README's performance numbers hold at the sizes it measured.
- 1,399 tests and the mutation gate are unusually strong.

**The weak point is the layer that holds the data between the user and the engine** (the store, the clipboard, import/export, autosave). All 8 Critical bugs live there, all are silent data loss, and none is covered by a test. The suite is dense around the pure engine and thin at the seams where state moves: undo, cut/paste, a second tab, a structural edit next to a live block, reading a real Excel file.

Three things matter most:
1. **Fix the 8 Critical bugs** (C1–C8), each with a store or integration test that pins it.
2. **Import fidelity.** Row sizing, shared formulas, dates, merged cells and named ranges make a real Excel file come back wrong. Import is the app's front door.
3. **Large-sheet performance** (F1–F3). A 10k-row sheet freezes for 9–17 s on every reload, and a mid-sheet edit can take 4 s.

Also in this pass: the runtime the app declares, Node 20, has been **past EOL** since 2026-04-30.

**Scores:** Architecture 3 · Cleanliness 4 · Design 3 · State management 2 · Tests 3 · Error handling 3 · Performance 3 · Dependencies 3 · Standards 4

## Scores

| Dimension | Score | Why |
|---|---|---|
| Architecture & boundaries | 3/5 | The engine and model are cleanly separated from React. The store is a god-object (#34), and `lib` depends on `store` (#33) |
| Code cleanliness | 4/5 | 0 TODO/FIXME, lint and tsc clean, comments explain *why*. The files are large (2,031 / 1,072 lines) |
| Design (SOLID / coupling) | 3/5 | Side structures (live blocks, comments, validation, the clipboard's source sheet) don't follow structural edits, so each new structure needs every action touched (shotgun surgery). The cause of C7, H1, H4 and M6 |
| State management | **2/5** | The undo slice omits `activeSheetId` (C1). persist writes the whole workbook on *every* `set()`, including arrow keys (F3). No coordination between tabs (C8). Nearly every Critical bug is a state bug |
| Tests | 3/5 | Excellent for the engine (property tests, mutation gate), but **none of the 8 Critical paths has a test**. Store and integration seams are under-tested (the test pyramid is skewed toward the engine) |
| Error handling | 3/5 | The save-refused path is exemplary. Several paths still **drop data silently**: import sizing (C4), pivot size (H9), export that throws and is swallowed (H7), conditional-format rules dropped (L9) |
| Performance | 3/5 | Page load and scrolling are excellent. Big sheets: quadratic incremental recompute (F1), the first render lays out every row (F2), and autosave runs on every keystroke (F3) |
| Dependencies | 3/5 | Dependabot, CodeQL and a dated advisory gate are in place. Node 20 is EOL but still declared and tested. CI actions still run on node20. exceljs is dormant |
| Standards & consistency | 4/5 | Strong self-imposed gates and bilingual docs. A few claims have drifted from the code (see the README-claims section) |

---

## Findings — ordered by impact

### [H-A] Data-holding layer: silent loss in everyday editing — Critical ×5
- **Type:** state management / correctness
- **Location:** `src/store/sheetStore.ts`, `FormulaBar.tsx`
- **Bugs:** C1 (undo + activeSheetId), C2 (cut across sheets), C3 (stale formula bar), C7 (live blocks after an insert or delete), C8 (two tabs)
- **Root cause:** state that belongs together is updated in different places. The undo slice holds sheets but not the active tab. The clipboard holds cells but not their source sheet. A live block's anchor doesn't move with the rows. Each tab writes the whole workbook blind.
- **Fix:**
  - Fix each bug.
  - Add a **store-level test for each** (undo → edit, cut → switch sheet → paste, insert row → refresh), since the suite covers none of these.
  - Longer term (#34): a single "structural edit" pipeline that every side structure (live blocks, comments, validation, merges, CF, names) registers with, so a new structure can't be forgotten.
- **Effort:** M per bug · **Standard:** single source of truth; test pyramid.

### [H-B] Import fidelity — Critical ×3, High ×4
- **Type:** correctness / import
- **Location:** `src/lib/excelIO.ts` (`importWorksheet`, `cellValueToRaw`, `readDefinedNames`), `cellFormat.ts`
- **Bugs:** C4 (rows dropped), C5 (shared formulas), C6 (dates), H6 (percent and currency), H8 (merged values), H13 (names), M10 (booleans), M12 (theme colours)
- **Root cause:** `cellValueToRaw` flattens every ExcelJS value to a string, and the sheet is sized from a count instead of an index. Much of this follows from the missing **cell type** in the model (text / number / date / boolean), which is also behind #23 (since fixed for leading zeros and long ids by `0baa2c5`) and H5.
- **Fix:**
  - Short term: fix sizing, shared formulas, merged cells and names (each S), and add a round-trip test on a real multi-feature fixture.
  - Structural: introduce a cell type (or a text marker plus a date format) that survives input → compute → export.
- **Effort:** S×4 plus L for the type · **Standard:** data integrity; round-trip fidelity.

### [H-C] Cross-sheet formulas lose their resolver outside the grid — High
- **Location:** `sheetStore.ts:397, 1668, 1686, 1705, 1882`, `PivotPanel.tsx:39`
- **Problem:** the grid computes with `createWorkbookResolver(sheets)` (:1807). Export, pivot, sort, filter and the pivot-staleness check call `computeSheet(sheet)` without it. The same formula therefore shows 142 on screen and `#REF!` in the CSV and PDF (H11).
- **Fix:** one helper, `computeTab(tab, sheets)`, used everywhere, plus a lint or test that forbids calling bare `computeSheet` from the store.
- **Effort:** S · **Standard:** DRY (one way to compute).

### Performance findings (measured)

Median of ≥3 runs on a shared 4-core box, judged by ratios, per AGENTS.md. The measurement scripts were kept by QA outside the repo; each issue (#66, #67, #72, #77) describes the shape so it can be re-created.

#### [F1] One edit costs time proportional to rows² when a sheet has a chain and range formulas — High
| Rows | Full compute | Edit mid-sheet | Edit ÷ full |
|---|---|---|---|
| 1k | 90 ms | 57 ms | 0.6× |
| 3k | 98 ms | **496 ms** | 5× |
| 10k | ~400 ms | **6,010 ms** | 15× |
| 30k | ~1.2 s | **83 s** (1 run) | 70× |

- **Shape:** row SUM + running balance `=E(r-1)+D(r)` + VLOOKUP. In the browser, a 10k×10 import with these formulas takes **4.2 s per edit**. The QA lead re-measured 1k and 3k independently: 57 → 496 ms.
- **Cause:** `src/lib/sheetCompute.ts:557`. For every dirty key, `incrementalCompute` loops over **all** `rangeReaders`, so the cost is dirty cells × range formulas. The dirty-fraction bail-out (40%) never fires, because the chain is one column in ten.
- **Fix:** index range readers by column (or an interval tree), and add a work counter that falls back to `fullCompute` once it exceeds the cell count, so an edit can never cost more than a full pass.
- **Effort:** M.

#### [F2] The first render after an import or reload lays out every row — High
- **Numbers:**
  - Import: 10k×10 .xlsx **10.1 s**, 10k×20 18.6 s, 50k×10 CSV **62 s**, each as one blocking task.
  - Every reload with a big autosaved sheet: **8.9 s / 17.3 s**.
  - The library work is only ~1 s. The trace shows one Layout pass over **430,010 objects**.
- **Cause:** the viewport starts at `{top:0, height:0}` (`SpreadsheetGrid.tsx:85`), and `rowWindow.ts:79` then falls back to the height of the **whole sheet**. The comment there says "render from the top", not "render every row".
- **Fix:** bound the fallback (e.g. `window.innerHeight`, or ~40 rows), or measure before the first virtualized render. Optionally parse in a Web Worker so the busy indicator can animate.
- **Effort:** S (fallback) / M (worker).

#### [F3] Autosave serialises the whole workbook synchronously on every state change, including arrow keys — Medium
- **Numbers:**
  - 10k×20: one commit takes 376 ms, of which ~90% is autosave (`packSheet` 183 + `JSON.stringify` 154 + `setItem` 31 ms), and it runs twice per commit.
  - An arrow key: 184 ms.
  - 50k×10: the 7.9 MB save is refused (documented), yet the app still packs and stringifies on every key (504 ms per arrow).
- **Fix:**
  - Skip the save when `sheets`/`activeSheetId` are unchanged by reference (removes the arrow-key cost).
  - Cache packed sheets in a WeakMap.
  - Debounce to idle, and flush on `pagehide`.
  - Back off after a quota refusal.
- **Effort:** S–M.

#### [F4] Even a small edit scales with sheet size — Low
82 ms at 30k rows against 7 ms at 3k, from copying `dependents`/`programs`/`rangeReaders` and allocating `Uint8Array(rows*cols)` on every edit. Fix: copy-on-write, or mutate in place with an undo log. M.

#### [F5] Exporting 50k×10 blocks the page for 2.5 s (ExcelJS) — Low
Busy flag shown; edge size only.

**Passes:**

| Check | Result |
|---|---|
| LCP (`/`) | 224 ms |
| LCP (`/app`) | 284 ms; throttled to Slow 4G ×4 CPU, ≤1.3 s |
| JS before the first usable cell | 271 KB over the wire |
| Scrolling 10k rows | p95 16.8 ms, ≤592 `<td>` |
| Typing in the editor | 16–32 ms per key |
| CSV parse, 50k rows | 69 ms |
| CSV export | fast |
| Lazy chunks | ExcelJS and Supabase stay out of page load |
| Incremental vs full recompute | 0 mismatches |

**README claims:** the published recalculation numbers (1k / 3k / running total) **hold**. Two claims are only true in part:
- "the cost stopped following the size of the sheet" — not beyond 3k rows (F4).
- "a ten-thousand-row sheet does not render ten thousand rows" — true after the page settles, but not on the first render after an import or reload (F2).

---

## Dependency & version health

Checked live on 2026-09-27 against the npm registry and the official Node release schedule. endoflife.date and nextjs.org were blocked by this environment's egress policy, so Next and React support status comes from release activity only.

**Runtime:** Node 20 — **EOL since 2026-04-30**, still in `engines` (`^20.19.0 || >=22.12.0`) and the CI matrix. **Framework:** Next 16.3.4 (16.3.6 available), React 19.2.8 (19.3.0 available). Both lines are active.

| Item | Current | Latest | Status | Verdict | Effort | Why |
|---|---|---|---|---|---|---|
| Node 20 (`engines`, CI 20.19, READMEs) | 20.19 | — | **past EOL 2026-04-30** | **Update now** | S | No security fixes. `@supabase/supabase-js` (a production dependency) already requires `>=22`. Move to `>=22.12`, `@types/node ^22`, drop 20.19 from CI, update both READMEs |
| `actions/cache` (ci.yml) | v4 | v6 | two majors, node20 action | Update now | S | Its action runtime is EOL. Dependabot bumped checkout and setup-node but not this |
| `github/codeql-action` | v3 | v4 | v3 deprecated Dec 2026 | Update now | S | Two months left |
| checkout/setup-node in license-check.yml | v4 | v7 | three majors | Update now | S | Inconsistent with ci.yml (v7) |
| next + eslint-config-next | 16.3.4 | 16.3.6 | patch | Update now | S | Move together |
| react / react-dom | 19.2.8 | 19.3.0 | minor | Plan | S–M | Test on its own |
| vitest (dev) | 3.2.7 | 5.0.2 | two majors | Plan | M | 4.x first (fine on Node 20). 5.x needs Node ≥22.12, so after the Node row |
| typescript (dev) | 5.9.3 | 7.0.2 | two majors | Plan 6.0 / **Hold 7** | M | 7 is blocked: typescript-eslint requires `<6.1` |
| eslint (dev) | 9.39.5 | 10.11.0 | one major | **Hold** | S | Blocked: the plugins in eslint-config-next don't support 10 yet |
| exceljs (critical path) | 4.4.0 | 4.4.0 | **dormant** (last release 2023-10-19, 809 open issues) | **Hold (accepted) — write it down with a review date** | L to replace | The documented choice (README.en.md:1899). Staying means parser bugs in user files won't be fixed upstream; record the trigger for replacing it |
| @anthropic-ai/sdk | 0.124.0 | 0.128.0 | four 0.x minors | Plan | S | 0.x minors can break |
| `.github/dependabot.yml` grouping | by type only | — | config | Update now | S | PR #4 bundled four majors and failed on every Node version. Group minor and patch only, and ignore TS 7 / ESLint 10 while they're blocked |
| supabase-js, lucide-react, jszip, @types/react* | — | — | patch/minor | Update now (via Dependabot) | S | Routine |

**Upgrade order:**
1. Patches and minors.
2. CI actions and the Dependabot grouping.
3. Drop Node 20.
4. Vitest 4.
5. React 19.3.
6. TypeScript 6.0, then Vitest 5.
7. Hold ESLint 10 and TS 7 until their blockers clear.

**Checked and fine:**
- jspdf, jspdf-autotable, mysql2, pg, zustand, tailwind, playwright and axe are current and healthy.
- zundo is slowing but small and compatible.
- No repo is archived.
- Dependency placement is correct: pg and mysql2 are server-only, playwright and axe are scripts-only.
- Nothing is removable.
- Automation (Dependabot, CodeQL, the dated advisory gate) is in place.

---

## Tech-debt register (additions from this pass)

| Item | Interest | Principal | Risk | Priority | Action |
|---|---|---|---|---|---|
| No cell type (text/number/date/bool) in the model | High (touches H5, C6, M10, #38; #23 fixed in `0baa2c5`) | L | High (silent data change) | **1** | Build on #23's `literalValue` and "Text" format: dates, booleans, grouped numbers |
| Side structures don't follow structural edits | High (C7, H1, H4, M6, M20) | M | High | **2** | A structural-edit pipeline (fold into #34) |
| Bare `computeSheet` outside the grid | Medium | S | Medium | 3 | `computeTab` helper plus a guard |
| Store/integration seams untested | High | M | High | 3 | One store test per Critical bug; e2e flow for undo/cut/import |
| Persist on every `set()` | Medium | S | Low–Medium | 4 | Reference-equality skip, debounce |
| Node 20 declared and tested | Low now, rising | S | Medium | 4 | Drop it |
| exceljs dormant | Low now | L | Medium | 5 | Written hold with a review date and a trigger |

## What's already good
- Engine correctness and its test culture (property tests, the mutation gate, the rule that timing tests assert ratios).
- Page load: 271 KB before first use, heavy libraries lazy-loaded, LCP well under target.
- Scrolling and virtualization once the page has settled.
- The storage-refused path, crash rescue, offline mode and the CSP were all verified working.
- BYOK: the key never leaves `sessionStorage` or reaches the page or console.
- Bilingual UI: no untranslated strings found in either language, no overflow at 390 or 1280.
- Documentation discipline: the README's own performance claims were re-measured and hold where they were measured.

## Recommended plan
1. **Now:** C1–C8, each with a pinned test · F2 (S fix, removes a 9–17 s freeze on every reload) · drop Node 20.
2. **Next:** H11 (resolver, S) · C4/C5/H8/H13 (import, S each) · H1–H4 (sort, filter, cut) · F1 · F3.
3. **Plan:** cell-type design, building on #23's fix (unblocks H5, C6, M10, #38) · AI matcher rules (H15–H17) · the rest of the Highs.
4. **Opportunistic:** Mediums and Lows, grouped by area.

**Explicitly accepted as-is:** ESLint 10 and TS 7 on hold (blocked); exceljs kept, with a written review.
