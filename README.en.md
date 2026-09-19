# 📊 ExcelToGo — describe what you want, get an Excel formula that works

**Language:** [ไทย](README.md) · English

### ▶ [Try it — nothing to install](https://excel-to-go.vercel.app)

Runs in your browser; your data stays on your machine.
(On the public demo, live data is readable from three built-in sources — [why only three](SECURITY.md).)

> **Type "total sales for the northern branch" and get an Excel formula back**, with a sentence
> saying what it does — one click puts it in the cell. No remembering which argument SUMIF takes
> first. Or skip the typing: **pick from 32 ready-made formulas** and drag across the cells instead
> of typing addresses. It works out of the box with nothing to configure (a local keyword matcher,
> free), or paste your own Anthropic API key and the question goes to the real Claude — from your
> browser straight to Anthropic, never through this app's server.
>
> All of that happens on a `.xlsx` that **still looks like itself when it opens** (colour bands,
> merged cells, borders, row heights), computed by a **hand-written formula engine** (no
> third-party library), entirely in your browser — the data never leaves your machine, and there
> is no account to create.
>
> Four things build on that: **[your own API or database feeding the cells](#-live-data-from-an-api--csv-prototype)**, with no script to write, keeping
> cells current on its own (following paginated APIs and backing off when rate-limited),
> **[imported files keeping their look](#-it-looks-like-the-file-you-opened)** (colour bands, large type,
> borders, merged cells), **[templates read straight out of an Excel file](#-templates-from-an-excel-file)**
> that already know which cells are yours to fill in, and **[Pivot summaries](#-pivot-summarise-a-range)**
> that group a range and write the result out as a new sheet.
>
> Charts exported with the `.xlsx` are **real charts you can keep editing in Excel**, not pictures —
> the OOXML chart part is written by hand, because ExcelJS cannot write one.

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Zustand" src="https://img.shields.io/badge/Zustand-5-443E38">
  <a href="https://excel-to-go.vercel.app"><img alt="Live demo" src="https://img.shields.io/badge/▶_try_it-live_demo-2F9E44"></a>
  <img alt="Vitest" src="https://img.shields.io/badge/tests-948%20passing-2F9E44?logo=vitest&logoColor=white">
  <img alt="CI" src="https://github.com/SuruchBoss/ExcelToGo/actions/workflows/ci.yml/badge.svg">
</p>

Describe what you want in plain Thai or English and get a working Excel formula back, with a sentence
explaining it; one click puts it in the cell. Out of the box that runs on a local keyword matcher — free,
nothing to configure — and pasting your own Anthropic API key sends the question to the real Claude, from your
browser straight to Anthropic, never through this app's server.

Beyond the assistant, a Next.js web app that turns an Excel-style grid into a friendlier UI: drag-and-drop ready-made formulas instead
of memorizing syntax, an AI assistant that suggests formulas from a natural-language question (Thai or English),
and a hand-written formula engine (tokenizer → parser → evaluator, no third-party formula library) supporting
cell/range references, relative & structural reference adjustment, circular-reference detection, multi-sheet
workbooks, conditional formatting that re-colours cells from their current values, pivot summaries over a
selected range, and full-fidelity Excel/PDF export — where a chart exported to `.xlsx` is a real, editable chart
bound to its cells, because the OOXML chart parts are written by hand (ExcelJS writes none). Plus optional
bring-your-own-backend cloud save. Bilingual UI (Thai/English), 948 automated tests.

---

## ⏱️ Try it in 60 seconds

<p align="center"><img src="public/screenshots/demo.gif" width="900" alt="The three steps: change a price and the totals move, build a pivot, and the summary flags its source as stale"></p>

<p align="center"><sub>The three steps below, recorded from the running app — no edits</sub></p>

If you only have a minute — [**open the app**](https://excel-to-go.vercel.app/app) and do these three
things in order. Nothing to install, no sign-up, and nine rows of sample data are already there.

The app always opens on those nine rows: an empty grid teaches a first-time visitor nothing when they
press Pivot or Chart, and every total in the sample is a **formula**, not a number. A green bar at the
top says so — the first person to look at it fresh asked why the app had data left over — with a
**Start from a blank sheet** button beside it. It retires itself the moment anything is touched, which
is the same moment the sentence stops being true.

| | Do this | What you'll see |
|---|---|---|
| **1** | Click **C2** (the latte's price), type a different number, press Enter | The **Total** column and the **Grand total** row move with it — every total is a real formula, not a number somebody typed once |
| **2** | Select **A1:E10**, press **Summarise (Pivot)** → group by *Category* → value *Total* → **Build summary sheet** | A new sheet summarising by category. Go back and change a price, then watch the **"the source data has changed"** notice appear on the summary |
| **3** | Select **A1:E10** again and press **Export Excel** | Open it in real Excel — the formulas are still formulas, not baked-in values. Add a chart first and it exports as **a real chart you can keep editing** |

Want the harder parts: [embedding a Thai font in the PDF, with stacked tone marks](#-export) ·
[hand-written OOXML chart parts](#-charts-from-the-sheet) · [an accessibility gate in CI](#-testing) ·
[the formula engine](#-formula-engine)

> Every section explains the decision behind it, including **what it still can't do** — see
> [What's next](#-whats-next).

## 📸 Screenshots

<p align="center"><img src="public/screenshots/01-overview.png" width="900"></p>
<p align="center"><sub><b>Main screen</b> — the data grid with the drag-and-drop formula panel on the right</sub></p>

> The rest of the screenshots live in [**Features**](#-features) below, each one next to the feature it shows.
> Every shot is from a production build, not a mockup.

---

---

### 🧪 What 948 passing tests could not catch

Every test of the assistant **mocks the model** — it returns what I imagined it would. Put a real
API key behind it, ask fourteen ordinary questions, and **six answers used functions this engine
does not have** (`TEXTJOIN`, `FIND`, `RANK.EQ`, `SUMPRODUCT`, `CEILING`, `CHAR`). All valid Excel;
all `#NAME?` in the cell, right after pressing a button labelled "insert".

Then **the first fix made it worse.** The rule started as "give the closest formula the list
allows", so _"join all the names into one line"_ came back as `=SUM(A2:A20)` — `0` in the cell, no
error, nothing to notice. **A visible `#NAME?` traded for an invisible wrong number.**

**And it happened again, in a different place.** With every gate green — 948 tests, `axe` clean on
both pages at two widths — an hour of clicking through the public build the way a first-time visitor
would found three things no gate can see:

- Half-insert a formula from the palette and **all six sidebar buttons went dead.** They still set
  the mode in the store; a `pending ? … : mode` render just outranked it. Escape did nothing either,
  so the press arrived later, attached to whichever click finally cancelled the formula.
- The keyword matcher — which on the public demo is not a fallback but the *only* thing anyone sees
  — answered _"add up all the sales"_ with `=SUM(E2)`, the total of one cell, and _"join the product
  name and the category"_ with `=SUM(E2)` again. The system prompt has forbidden the model from
  substituting like that since the fix above. Nothing had ever told the matcher.
- `axe` passed the grid at four viewport/page combinations while it was, to a screen reader, an
  ordinary table you could not drive: no `role="grid"`, no `aria-selected`, no `scope` on the
  headers, every cell tabbable, and **the browser's focus stayed on A1 while Ctrl+↓ moved the cursor
  to A10** — the sheet moved in silence. axe was right to pass. A `<table>` with `<th>` *is* a valid
  table. It just was not what this is.

All four are fixed. The lesson each time is the same one: a green suite says the code does what the
tests say, and nothing whatever about whether that is the right thing.

→ [The whole story, and the fix](#-ask-ai-for-a-formula) · repeatable with `npm run check:ai`

## 📋 Table of Contents

- [Try it in 60 seconds](#️-try-it-in-60-seconds)
- [Screenshots](#-screenshots)
- [Why this project](#-why-this-project)
- [Getting started](#-getting-started)
- [Features](#-features)
  - [Ask AI for a formula](#-ask-ai-for-a-formula)
  - [Bring your own API key (BYOK)](#-bring-your-own-api-key-byok)
  - [Live data from an API / CSV (prototype)](#-live-data-from-an-api--csv-prototype)
  - [Spreadsheet grid](#-spreadsheet-grid)
  - [Autosave + Undo/Redo](#-autosave--undoredo)
  - [The app can break and you still get your file out](#-the-app-can-break-and-you-still-get-your-file-out)
  - [Copy / Cut / Paste](#️-copy--cut--paste)
  - [Cell formatting](#-cell-formatting)
  - [Charts from the sheet](#-charts-from-the-sheet)
  - [Conditional formatting](#-conditional-formatting)
  - [Cell comments](#-cell-comments)
  - [Cloud save (bring your own backend)](#️-cloud-save-bring-your-own-backend)
  - [The Excel keyboard](#️-the-excel-keyboard)
  - [Formulas across sheets](#-formulas-across-sheets)
  - [The fill handle](#️-the-fill-handle)
  - [Find and replace](#-find-and-replace)
  - [Works on a phone](#-works-on-a-phone)
  - [Insert/delete rows & columns](#-insertdelete-rows--columns)
  - [Merging cells](#-merging-cells)
  - [Sort and filter](#-sort-and-filter)
  - [Pivot (summarise a range)](#-pivot-summarise-a-range)
  - [Multiple sheets in one file](#-multiple-sheets-in-one-file)
  - [Import an existing Excel file](#-import-an-existing-excel-file)
  - [Drag-and-drop formulas](#-drag-and-drop-formulas)
  - [Export](#-export)
  - [CSV in and out](#-csv-in-and-out)
  - [It looks like the file you opened](#-it-looks-like-the-file-you-opened)
  - [Templates from an Excel file](#-templates-from-an-excel-file)
  - [A landing page that explains the app](#-a-landing-page-that-explains-the-app)
  - [Bilingual (Thai / English)](#-bilingual-thai--english)
- [Tech stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project structure](#-project-structure)
- [Formula engine](#-formula-engine)
- [Bilingual UI (i18n)](#-bilingual-ui-i18n)
- [Security — what was actually tested](#-security--what-was-actually-tested)
- [Lighthouse](#-lighthouse)
- [Testing](#-testing)
- [What's next](#-whats-next)

---

## 🎯 Why this project

The starting point was a real pain point using Excel: **hard to fill in on desktop/online, an unfriendly UI,
formulas nobody remembers, and getting lost scrolling a big sheet.** This project sets out to fix that directly
rather than build a generic "calculator app," which means dealing with more subtlety than it first looks:

- Users should be able to type formulas themselves **or** drag one in without knowing any syntax — both paths
  have to work equally well.
- Formulas must shift references correctly both when copied/filled down a column (relative) **and** when a row
  or column is inserted/deleted (structural) — two genuinely different algorithms. Get either wrong and the
  sheet silently computes the wrong number.
- Formulas can reference each other in a circle; that has to be detected, not hang the app.
- Every edit (typing a value, inserting a formula, formatting) needs undo/redo, but moving the selection or
  switching sheet tabs must **not** count as history — otherwise one Ctrl+Z would just undo where the cursor
  was, not the actual content change.
- Importing/exporting Excel files has to preserve **the original formulas and formatting** (bold/color/alignment),
  not just the computed numbers.
- It should work for both Thai and English speakers without needing locale-based routing (`/en/...`), since the
  app is entirely client-rendered.

The project's focus is therefore **correctness of the calculation logic + an architecture that's maintainable**,
rather than a long feature list with shallow depth — see [Formula engine](#-formula-engine) for the deep dive.

---

## 🚀 Getting started

> About 2 minutes · no database or separate backend needed — everything runs in one Next.js app

### Step 0 — Get the code

```bash
git clone https://github.com/SuruchBoss/ExcelToGo.git
cd ExcelToGo
```

### Step 1 — Install and run

**Requires:** [Node.js](https://nodejs.org) **20.19+ or 22.12+** (22 or 24 recommended) and npm. That floor
comes from Vite 7, which the test suite runs on: it needs `require(esm)`, which lands in exactly those two
versions — higher than Next 16's own `>=20.9`. It's declared in `package.json`'s `engines`, and CI runs both
floors for real

```bash
npm install
npm run dev
```

Open **http://localhost:3000** and you land on a page explaining what the app does. Click
**"Open the app"** to get to the real thing, or go straight to **http://localhost:3000/app**.

| Route | What it is |
|---|---|
| `/` | The landing page — features with screenshots from the running app, bilingual like the app itself |
| `/app` | The app itself, opening on a sample sheet with nothing to configure |

(The sample data is a coffee/bread/milk receipt with real total formulas. Click **ExcelToGo** in the
app's top-left corner to get back to the landing page.)


Other available commands:

| Command | What it does |
|---|---|
| `npm run dev` | Development mode (hot reload) |
| `npm run build` | Build a production bundle |
| `npm run start` | Run the production build (run `npm run build` first) |
| `npm run lint` | Check code quality with ESLint |
| `npm test` | Run the 948-case Vitest suite |
| `npm run check:readme` | Check the READMEs still match the code (links/images/test count/new modules/both languages) |
| `npm run check:a11y` | axe on both pages at 390px and 1280px, plus sideways-scroll checks (needs a build) |
| `npm run check:e2e` | Drives the real app through 5 flows: formulas, `.xlsx` round trip, keyboard only, undo, announcements (needs a build) |
| `npm run check:ai` | Asks the real Claude with your own key and checks the formulas against what this engine can evaluate — not in `verify`, because it needs a key and costs money |
| `npm run verify` | Everything, before a push: lint → check:readme → test → build → check:a11y → check:e2e |
| `npm run build:social` | Re-render `public/social-preview.png` (1280×640), counting the card's figures from source |

### Step 2 — Connect the AI assistant to real Claude (optional)

By default the AI assistant suggests formulas via **local keyword matching** (works immediately, no setup, but
understands a limited range of phrasing). To let it understand natural-language questions more flexibly,
connect it to the Claude API:

```bash
cp .env.example .env.local
```

Open `.env.local` and set:

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
```

(get a key at [console.anthropic.com](https://console.anthropic.com)) then restart `npm run dev` — the app
switches to Claude automatically once this is set, no code changes needed.

### Step 3 — Deploy for real

This is a standard Next.js app, so it deploys to any platform that supports Next.js:

- **[Vercel](https://vercel.com)** (recommended, easiest): connect this repo to Vercel and deploy. For real
  AI, add an `ANTHROPIC_API_KEY` environment variable under Project Settings → Environment Variables.
  (On a public demo, also set `NEXT_PUBLIC_DEMO_MODE=1` and the key goes unused — see the note below.)
- Self-host with Docker/any Node server: `npm run build` then `npm run start`.

> [!IMPORTANT]
> **Deploying a public demo? Set `NEXT_PUBLIC_DEMO_MODE=1` as well.**
>
> It switches the live-data feature off on both sides: every `/api/sources*` route answers 403, and the
> UI stops offering the "Data" button. That API now requires an operator token and refuses to fetch
> private addresses (see [`SECURITY.md`](SECURITY.md)), but switching it off outright still matches
> what a demo is for: there is nothing to unlock, and everything left runs in the browser.
>
> It also matches reality on a serverless host: sources are persisted to `data/sources.json`, and
> Vercel's filesystem is read-only, so the feature could not work there anyway.
>
> **`ANTHROPIC_API_KEY` and public demos.** `/api/ai/formula` takes no authentication by design —
> the assistant is part of the app, and making a visitor log in to ask a question would be absurd.
> It is capped at **20 calls a minute per IP**, which stops a script in a loop, but the counters live
> in the process's memory: separate instances count separately and a serverless cold start forgets
> them. **That guards against casual abuse, it is not a billing control.**
>
> The billing control is the same switch as above: **`NEXT_PUBLIC_DEMO_MODE=1` makes this route skip
> Anthropic entirely**, even with a key configured, and fall back to local keyword matching — free,
> and still useful. [`route.test.ts`](src/app/api/ai/formula/route.test.ts) holds that rule in place.
> Even so, **not setting the key on a public deployment is still the safest thing to do** — two
> layers beat one.

### 🔧 Troubleshooting

<details>
<summary><b>Click to expand</b></summary>

| Symptom | Cause | Fix |
|---|---|---|
| `Error: listen EADDRINUSE :::3000` | Something else is using port 3000 | Run on another port: `PORT=3001 npm run dev` |
| Importing an Excel file errors out | Corrupted file, password-protected, or a very old `.xls` | Open it in Excel and "Save As" `.xlsx` first, then import that |
| AI assistant only gives basic suggestions that don't match the question | `ANTHROPIC_API_KEY` isn't set yet (using the keyword heuristic instead) | Set the API key per [Step 2](#step-2--connect-the-ai-assistant-to-real-claude-optional) |
| A cell shows `#CIRCULAR!` after inserting a formula | The formula indirectly references itself (e.g. A1 references B1, B1 references A1) | Rewrite the formula so it doesn't loop back on itself |
| Data disappears after a refresh or on another device | Data autosaves to that browser/device's `localStorage` only — it doesn't sync across devices | Click **"Export Excel"** to get a file you can keep, then re-import it elsewhere |
| Ctrl+Z does nothing | Focus is still inside a text field (editing a cell, or the AI question box) | Press Enter/Escape to leave the field first, or use the ↶ toolbar button instead |

</details>

---

## ✨ Features

### 🤖 Ask AI for a formula

Type what you want as a plain sentence, in Thai or English — e.g. _"I want to total all sales in this column."_
The app sends your question plus the currently selected range to the AI and gets back a suggested formula with
a short explanation. One click inserts it into the selected cell.

<p align="center"><img src="public/screenshots/04-ai-assistant.png" width="820"></p>

**What only a real key could show.** Every test of this feature mocks Anthropic — which means it
returns whatever the test author imagined it would. Put a real API key behind it and ask fourteen
ordinary questions, and **six answers used functions this engine does not have** (`TEXTJOIN`,
`FIND`, `RANK.EQ`, `SUMPRODUCT`, `CEILING`, `CHAR`). All valid Excel; all `#NAME?` in the cell,
after the user pressed a button labelled "insert". **43% of the feature the landing page leads
with.**

Fixed on both sides:

1. **The ten missing functions are in the engine now**, because real questions reached for them —
   see [supported functions](#supported-functions).
2. **The model is told what exists here**, from a list generated out of `FUNCTIONS` rather than
   written by hand: a second copy is the one that goes stale, and here the stale copy would be the
   one telling the model what it may use.

**The first attempt at that made things worse**, which is the part worth keeping. The rule started
as "give the closest formula the list allows", so _"join all the names into one line"_ came back as
`=SUM(A2:A20)` — `0` in the cell, no error, nothing to notice. **A visible `#NAME?` had been traded
for an invisible wrong number.** The rule now forbids substituting an unrelated function and asks
for a warning instead.

**Then the same mistake turned up in the matcher that answers when there is no key** — which, on the
public demo, is not a fallback but the only thing anyone ever sees. Two failures, both found by
using the demo rather than by testing it:

- Every unmatched question fell through to `SUM`. _"Join the product name and the category"_ came
  back as `=SUM(E2)`. The prompt had forbidden the model from doing this; nobody had told the code.
  It now returns **no formula at all** and says so in an amber card with no Insert button. A
  question it cannot answer is a better outcome than an answer it cannot justify.
- The range was whatever cell you had highlighted, so _"add up all the sales"_ with one cell
  selected meant `=SUM(E2)` — the total of one number. `aiRange.ts` now works out what the cursor is
  *pointing at*, the way AutoSum has since 1985: the run of filled cells it stands in or sits under,
  minus a text header on top of numbers. On this app's own sample sheet that turns the same question
  into `=SUM(E2:E10)`, which is 7,495. The headers go along with it too — the API route had accepted
  a `headers` field since the feature shipped and no caller had ever filled it in.

One subtlety worth its own note: the widening reads the **computed** sheet, not the raw one. Column E
of the sample is nine `=C2*D2` formulas, so reading the raw cells made every number in it look like
text, the header rule never fired, and the range came back as `E1:E10` with the word "รวม" inside.
`SUM` ignores text, so the *total was right and the range was wrong* — the kind of bug that survives
because the number on screen looks fine.

Repeatable with `npm run check:ai` (needs your own key; not part of `npm run verify`, because it
costs money).

### 🔑 Bring your own API key (BYOK)

The assistant answers one of three ways, and the landing page says plainly which one the demo uses:

| Path | When | Answer comes from | Who pays |
|---|---|---|---|
| Local keyword matcher | The default | `aiHeuristic.ts` — matches words; **declines when nothing matches** | Nobody |
| **The real Claude (BYOK)** | The visitor pastes their own API key | `api.anthropic.com`, straight from the browser | **The visitor's own account** |
| The real Claude (server-side) | The operator sets `ANTHROPIC_API_KEY` | `/api/ai/formula` | Whoever runs the server |

<p align="center"><img src="public/screenshots/33-byok.png" width="560"></p>

**The key never passes through this app's server.** The request goes from the browser straight to
`api.anthropic.com` — that is what the SDK's `dangerouslyAllowBrowser` unlocks (it adds the
`anthropic-dangerous-direct-browser-access` header Anthropic's CORS policy requires). A key POSTed to
our own route would sit in that process's memory and in whatever the host logs; this way there is
nothing to leak, because there is nothing here to leak.

**`sessionStorage`, not `localStorage`.** Closing the tab discards it. A key left in `localStorage`
on a shared or library machine outlives the person who typed it, and this is a tool people are told
to open without signing up — assuming the machine is theirs alone would be the wrong default. The
cost is retyping it in a new tab, which is the right trade for a secret.

**Verified by running it, not by reading it.** A Playwright run intercepts
`https://api.anthropic.com/**` and `**/api/ai/formula` at the same time and asks a real question. The
second is never called (`hit our own /api/ai/formula: false`); the first arrives with
`anthropic-dangerous-direct-browser-access: true` and its formula is what the panel displays.

> The question, the selected range and the column headers go to Anthropic only when the button is
> pressed — **the file itself is never sent**, and if nobody presses it, nothing leaves the machine.

### 🔌 Live data from an API / CSV (prototype)

<p align="center"><img src="public/screenshots/34-live-data.gif" width="820" alt="Picking a live source, pressing it into the sheet, and the cell changing on its own every five seconds"></p>

<sub>Recorded against a real public demo build (`NEXT_PUBLIC_DEMO_MODE=1`) — the three sources in it are the ones anyone can try.</sub>

<p align="center"><img src="public/screenshots/08-live-data.png" width="820"></p>

Split into two roles so the end user touches as little technology as possible:

**1) Tech sets it up once** — "Connect new data" in the **Data** panel: enter a REST API URL or a CSV/Google
Sheets link, an auth header if needed, and a refresh interval, then "Test connection" to see how many rows and
columns come back before saving. Config and credentials live on the server (`data/sources.json`, gitignored)
and never reach the user's browser; the server does the fetching, so CORS isn't the user's problem.

<p align="center"><img src="public/screenshots/09-source-setup.png" width="700"></p>

**2) Everyday users: three clicks, no jargon** — no JSON, no API keys, no aggregate function names.

| Step | What the user sees |
|---|---|
| 1. Select the target cell, click **"Insert into sheet"** | One primary button per source — nothing else to decide yet |
| 2. Choose **"Whole table"** or **"A single summary number"** | A full-width preview table, or cards showing the **actual live numbers** (e.g. `9,510 · Sum of total`) — no need to know what "sum" means in the abstract |
| 3. Confirm the target cell and click **"Insert into sheet"** | It states up front how many rows × columns it will use, and warns if that would overwrite existing content |

<table>
<tr>
<td align="center"><b>Whole table — preview before placing</b><br>
<img src="public/screenshots/10-picker-table.png" width="410"></td>
<td align="center"><b>Single value — real numbers to pick from</b><br>
<img src="public/screenshots/12-picker-values.png" width="410"></td>
</tr>
</table>

**Once placed**, the grid scrolls to show the whole block and the side panel closes itself — left open, it sat
over the very columns the table just landed in. Clicking the block brings up a toolbar beside it showing which
source it came from and how often it updates, with **Refresh / Change / Remove** — no trip back to the panel.

<p align="center"><img src="public/screenshots/11-block-toolbar.png" width="820"></p>

**The feature is locked until you unlock it** — it tells the *server* to fetch a URL for you, which
is a capability that needs an owner. With `SOURCES_ADMIN_TOKEN` unset the API answers 403 to
everything rather than being left open to whoever loads the page.

<p align="center"><img src="public/screenshots/24-sources-locked.png" width="820"></p>

Three guards:

| | |
|---|---|
| **A token is required** | Unset means off, not open (403) · compared in constant time · held in `sessionStorage`, so closing the browser asks again |
| **It cannot reach your private network** | **Every address DNS returns** is checked, and re-checked after **every redirect** — loopback, RFC 1918, `169.254.169.254` (metadata on AWS/GCP/Azure), IPv6 link-local and unique-local, and IPv4 embedded in IPv6 in **every spelling** |
| **Credentials are encrypted at rest** | AES-256-GCM under `SOURCES_SECRET_KEY` · with no key it refuses to store a credential rather than writing one in the clear |

The easy one to get wrong, found by testing rather than reasoning: `new URL("http://[::ffff:169.254.169.254]/")`
rewrites the host as `::ffff:a9fe:a9fe`, so a filter that only knew the dotted form waves the
metadata service straight through. The address is now unpacked and checked in every spelling.

**Not fully closed:** the address is checked and then the connection is made, and in between the
name could be re-resolved to something else. Closing that needs the connection pinned to the checked
address, which Node's `fetch` does not expose — `SECURITY.md` says so plainly rather than claiming
the guard is airtight.

**Paginated APIs** — most APIs hand back one page at a time, so a single fetch gets the user the
first 25 rows and leaves them believing that's all the data. Following pages are therefore fetched
automatically, with **nothing extra to configure** — the signals APIs already send are read in this
order:

| Signal | Example | Who sends it |
|---|---|---|
| `Link` header with `rel="next"` | `Link: <…?page=2>; rel="next"` | GitHub, GitLab |
| A next-page URL field in the body | `next`, `next_page_url`, `links.next`, `_links.next.href`, `@odata.nextLink` | Laravel, HAL, OData |
| A cursor / token | `next_cursor`, `nextPageToken`, `scroll_id` → sent back as a query param | Slack, Google APIs |
| A param the URL already carries | tech wrote `?page=1` or `?offset=0` → it gets incremented | APIs that signal nothing |

That last row matters: `?page=2` is never **invented** for a URL that doesn't already have the
param, because an API that doesn't support it would just return page 1 forever. Writing the param
into the URL is how tech opts in.

Tech sees a single field for all of this: **"Fetch up to [1000] rows"** (0 = first response only).
The rest is guard rails — at most 20 requests per refresh, a 45-second total budget, a stop when a
next link points back at a page already fetched, an empty page ends it, and if a page partway
through fails, **the rows already collected are still returned** rather than the whole refresh
being thrown away.

<p align="center"><img src="public/screenshots/13-partial-data.png" width="820"></p>

**And when the data is incomplete, it says so.** A silently partial table is more dangerous than a
small one the user knows about: a "Sum" card computed from the first 40 rows of a 120-row source
reads exactly like a real total and isn't one. So the warning appears in the **side panel**, in the
**picker** before the user commits to a summary value, and in the tech-side **connection test**.

**When an API says "too many requests"** — the problem isn't only that `HTTP 429` means nothing to a
non-technical user. It's that the poller keeps firing on its normal interval, which is the one
response guaranteed to keep the source broken. So:

- **The wait is read from the response**: `Retry-After` (both the seconds form and the HTTP-date
  form), falling back to the `X-RateLimit-Reset` family — which is maddeningly inconsistent (epoch
  seconds, epoch milliseconds, or seconds-from-now), so it's told apart by magnitude rather than by
  trusting any one convention. With nothing to go on, 60 seconds; capped at 15 minutes.
- **429 is separated from an ordinary 403** — a 403 counts as rate limiting only when a header says
  the remaining quota is zero (GitHub answers that way). Treating every 403 as a rate limit would
  turn a permission error into "try again later" and leave the user waiting on something that will
  never fix itself.
- **Polling actually stops during the wait**, not just the message changes — verified by a test that
  counts requests on the API side: a source on a 5s interval, 429'd with a 40s wait, received
  **0 further requests** over the next 16 seconds. Unaffected sources keep refreshing throughout.
- **A rate limit partway through pagination** still returns the rows already collected, with the
  wait attached — no data lost, and the next poll doesn't walk back into the same wall.
- **Ordinary failures back off too** (exponential from the source's own interval, capped at 15
  minutes), so a source that is simply down stops being polled every few seconds forever.
- The user sees plain language with a live countdown and a **"Try now"** button to override it — a
  manual refresh always goes through, because a person clicking is a deliberate act, not the poller.

<p align="center"><img src="public/screenshots/14-rate-limited.png" width="820"></p>

Behind the scenes:

- The app converts JSON into a table on its own (finds the largest array of records in the response, flattens
  nested objects into `customer › name` columns). A single-row KPI object is broken out into individual values
  you can pick field by field.
- Linked cells are tinted green with a border around the block and a bold header row, are read-only, and
  **refresh themselves on the source's schedule** (polling). Regular formulas (`=A10*2`, `SUM`, `VLOOKUP`) and
  Excel/PDF export work on live data immediately, because the app writes real values into the cells.
- Refreshes **never enter the undo history** (zundo is paused during the write) — one Ctrl+Z undoes the whole
  placed block, and "Change" (clear the old block + place the new one) counts as a single step too.
- **Drag and drop still works** for people who prefer it, it's just no longer the primary path.
- The side panel keeps a "Live data in this sheet" list showing what is placed where, each with its own remove
  button.
- Three demo sources are seeded so it works out of the box: `/api/demo/sales` (a table whose numbers drift
  every 5s), `/api/demo/summary` (a KPI-style object), and `/api/demo/orders` (**paginated**, 25 rows a page
  over 120 rows, for exercising the pagination path).

> Database sources (Postgres/MySQL) are the next phase — the option is visible in the form but disabled for now.

### 📐 Spreadsheet grid

- Click to select a cell, **double-click**/**F2** to edit, or just start typing to overwrite it directly.
- An always-visible **formula bar** shows the selected cell's address and raw content, just like Excel — edit
  from there directly.
- Move with arrow keys/Enter/Tab, clear content with Delete/Backspace (formatting is preserved).
- Select a range by dragging or Shift+click; click a row/column header to select the whole row/column.
- Row/column headers are sticky and highlighted for the current selection — fixes the "scrolled and now I'm
  lost which row I'm on" problem.

### 💾 Autosave + Undo/Redo

- Every edit (typing a value, inserting a formula, formatting, importing a file) autosaves to `localStorage`
  immediately — closing the tab or refreshing keeps your data (tied to that browser/device only, no cross-device
  sync).
- **Ctrl+Z** / **Ctrl+Y** (or Ctrl+Shift+Z) undo/redo content edits only — moving the selection or switching
  sheet tabs doesn't count as history.

### 🩹 The app can break and you still get your file out

When a render throws, what you used to get was Next's bare crash page: no explanation, no way back,
and — the part that actually matters in a spreadsheet — no sign of whether the work was gone. **It was
never gone.** The sheet lives in `localStorage` and a render crash never touched it, but nothing on the
screen said so, which from the outside is indistinguishable from having lost it.

So this screen does three things, in the order a person cares about them: says the data is safe, offers
it as one downloadable CSV per tab right now, and only then offers to try again.

<p align="center"><img src="public/screenshots/39-crash-rescue.png" width="760"></p>

The rescue (`crashRescue.ts`) **touches no store, no model and no formula engine** — those three are the
prime suspects for whatever just threw. It reads the raw JSON out of `localStorage` with the same posture
it would read a file someone uploaded: every field may be missing or the wrong type (there are tests for
each of those states, and none of them throws). Formulas come out as the text you typed rather than as
values, because nothing on this path evaluates anything, deliberately.

There are two layers: `error.tsx` catches a throw inside the page, `global-error.tsx` a throw inside the
layout. The second is rendered as its own document, **which means the app's stylesheet is not loaded** —
so it is styled inline in a system font. A fallback that still depends on a stylesheet loading is one
more thing that can fail at the moment everything else already has. The behaviour is shared through one
hook, so the two screens may look different but cannot act differently.

### ✂️ Copy / Cut / Paste

- **Ctrl+C / Ctrl+X / Ctrl+V** with a dashed highlight showing status (blue = copied, orange = cut).
- Pasting a copied formula adjusts relative references automatically, just like Excel.
- Paste text from elsewhere too (e.g. real Excel or Google Sheets) — splits into columns/rows by tabs/newlines
  automatically, and grows the sheet if the pasted block is bigger than the current table.

### 🎨 Cell formatting

Bold, text alignment (left/center/right), text color, number format (general / 2 decimal places / percent /
currency ฿) — travels with the cell on copy/paste and survives Excel export too.

<p align="center"><img src="public/screenshots/06-format-filter.png" width="820"></p>

The formatting row **folds away** (the brush button at the end of the formula bar). On a 1366×768 laptop the
three stacked bars ate 150px before a single grid row appeared; folded, that's 107px.

### 📊 Charts from the sheet

Select a range, hit **Charts** in the format bar, and pick **bar, line or pie**. The chart lands on
the grid just under the range it reads: **drag the bar at its top to move it, the bottom-right
corner to resize it**, and switch its type or delete it from the chart itself.

![Charts](public/screenshots/20-charts.png)

**A second chart steps clear of the first.** Both are built from the same range, so both land in the
same place. The old step was one column — 112px against a chart 300px wide — which left the new chart
covering nearly two thirds of the old one: a pile you only find by dragging the top one off. It now
steps past the chart's real width, summing actual column widths rather than dividing, and cascades
downwards instead once it runs out of room on the right.

**A chart stores which cells it reads, never the numbers**, so it redraws from the computed values
on every render: edit a cell and the bars move on the same frame. That also keeps it right after a
sort, an insert or a formula change, none of which it has to know about.

**Headers and labels are worked out for you** — select the whole of `A1:D6`. Which columns actually
carry numbers decides the rest: a first row counts as series names only where those columns hold
text instead of a number, and a first column of text beside them becomes the category labels.

Deliberate details:

- **The value axis always includes zero**, so a bar's length means what it looks like instead of
  making a 2% difference look like double.
- **A non-numeric cell leaves a gap** rather than letting the line run straight through it, which
  would invent readings that were never taken.
- **A column with nothing numeric in it is skipped** (a "notes" column, say) instead of being drawn
  as a flat line at zero.
- Charts live in the sheet, so they sit in the **undo/redo history** and **shift with inserted or
  deleted rows and columns**.
- **A whole drag is one undo step**, not one per pixel the mouse moved — otherwise a chart dragged
  across the sheet buries the last real edit under a hundred entries nobody can ctrl-Z back through.
- **A chart can't be dragged off the sheet**: it is clamped to the area the grid scrolls to, because
  something you cannot scroll back to is simply gone.
- **Resizing stops at a size that can still be read**, and a chart dragged wider gets more room to
  draw in rather than the same picture floating in more white space.
- **A second chart built from the same range steps clear of the first** instead of landing on top of
  it and looking like one chart that changed type.
- **A chart's position is pinned to a cell, not to pixels** — insert a column to its left and the
  chart travels with the data instead of staying put over a different set of numbers.
- **The legend names whatever suits the kind** — series for a bar or line, categories for a pie,
  since a pie colours one series slice by slice and naming the series there labels the wrong thing.

**Drawn as hand-written SVG, with no charting library** — a bar, line and pie between them are a few
dozen lines of geometry, against a dependency that would outweigh the whole feature.

**A pie picks which series it draws** — a pie can only show one, so a range with several gets a
chooser under the chart rather than being handed "whichever was leftmost". If the chosen series later
goes away, it falls back to the first rather than drawing an empty circle.

**Charts go into both exports** — into the `.xlsx` at the cell they are anchored to, and into the PDF
in order under the table, each captioned with the range it reads. Under the table rather than where
they sit on screen: a paginated table has already moved the cells somewhere else, so "the same place"
means nothing on a page.

**A chart in the exported `.xlsx` is a real chart, not a picture.** Open it in Excel, change a
number, and the chart follows — it holds *references to the cells* rather than an image of them.
ExcelJS writes no chart XML at all (`addImage` is its entire drawing API), so the OOXML chart parts
are written by hand and spliced into the finished package; see `xlsxChartXml.ts` and
`xlsxCharts.ts`. If that splice ever fails the export falls back to embedding pictures, because a
package with a dangling relationship is one Excel calls corrupt and refuses to open — a much worse
outcome than a chart that has stopped updating.

**Not supported:** charts in the PDF are still pictures (jsPDF has no chart primitive). A pie still
draws one series at a time. The chart parts carry no colour or theme styling, so whichever app opens
the file applies its own defaults.

### ☁️ Cloud save (bring your own backend)

**Off by default, deliberately.** ExcelToGo is an open-source project, **not a hosted service**.
Running one database for everyone who uses the app would make the maintainer a data controller with
the obligations that carries, and would reverse the property the rest of the app is built on: your
spreadsheet never leaves your browser.

If you want it, **bring your own Supabase project**. Set two variables and the button appears:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

![Cloud save](public/screenshots/23-cloud-save.png)

Run [`supabase/migrations/0001_workbooks.sql`](supabase/migrations/0001_workbooks.sql) against your
project once first — it creates the table and the **row-level security** policies that keep one
account's workbooks away from another's.

- **The browser talks to your Supabase directly**, never through this app's server, so whoever
  deploys it never sees their users' spreadsheets.
- **Sign in with an emailed link** — no password for this app to store or check.
- **A save that would overwrite a newer one asks first.** Two devices on one account is the ordinary
  case, and last-write-wins with no warning loses work silently.
- **A workbook written by a newer version is refused rather than half-read**, because half-reading
  it drops whatever the newer format added and the user finds out by noticing work missing.

**Leave it unset** — the default, and what the public demo does — and the button doesn't exist, the
cloud code is unreachable, and the ~250KB Supabase client **is never downloaded**. That was checked
by counting the chunks the browser actually requests, not assumed.

**Not supported:** automatic sync (you press save), simultaneous editing, version history, or
sharing a workbook with someone else.

### 💬 Cell comments

Select a cell, hit **Comment** in the format bar, and write a note. A commented cell gets an **amber
corner**; hover to read it.

![A note on a cell](public/screenshots/22-cell-comment.png)

**One cell at a time**, because a note is something said about *a* cell. Allowing a block would mean
either fanning it out into a note per cell or inventing a note about a rectangle, and neither is the
thing anybody meant.

**Emptying the text deletes the note** rather than keeping an empty one: an amber corner on a cell
with nothing behind it promises information that isn't there.

**Notes follow edits.** Insert a row above and the note moves down with its cell; **delete the row a
note is on and the note goes with it**. That is deliberately the opposite of what a chart's anchor
does — a chart is placed *near* cells, a note is written *about* one, so re-pointing it at whatever
slid into the gap would attach an explanation to data it never described.

**They export as real Excel notes** (`cell.note`), so they open as ordinary comments in Excel or
Google Sheets, and notes are read back out of imported files — including ones Excel wrote as rich
text rather than as a plain string.

**Not supported:** an author name or timestamp (the text is all that's kept); threaded replies as in
Google Sheets; and **a note on an empty cell is lost when the file is read back in** — the file
itself is correct and Excel shows the note, but ExcelJS attaches notes only to cells present in its
sheet model, and a cell with no value isn't. The loss is in the reader, not the writer.

### 🌡 Conditional formatting

Colours that follow the numbers, instead of being painted on once and going stale the moment a
value changes. Select a range, hit **Conditional formatting** in the format bar, and add one of
five rules:

| Rule | What it does |
|---|---|
| **Compare to a number** | `>`, `<`, `≥`, `≤`, `=`, `≠`, between — highlights the cells that qualify |
| **Text contains** | Substring search, case-insensitive, Thai included |
| **Top / bottom N** | Ranks within the selected range; ties are all included rather than cut off arbitrarily |
| **Colour scale** | Two or three stops across the range's spread — a whole column readable at a glance |
| **Data bar** | A bar inside the cell, always measured from zero so negatives stay on the scale |

![Conditional formatting](public/screenshots/18-conditional-format.png)

Rules are re-evaluated from the computed values on every render rather than stored as colours, so
editing a number repaints it on the same frame. Because the rules live in the sheet, they sit in
the **undo/redo history** and **shift with inserted or deleted rows and columns**.

They're written into `.xlsx` as genuine Excel conditional formatting (`cellIs`, `containsText`,
`top10`, `colorScale`, `dataBar`) and read back on import, so a file that already had rules opens
here showing what it shows in Excel.

**Deliberate limits:** Excel's icon sets, above-average and time-period rules aren't supported —
on import they're skipped rather than converted into something they aren't. Rule colours **don't
reach the PDF export** (neither do fills or bold, which it doesn't carry either). And where
several rules hit one cell, **the lower rule wins** — the opposite of Excel's top-priority-wins
order. That's chosen so a rule you just added visibly does something instead of silently nothing.

### ⌨️ The Excel keyboard

Somebody who opens a spreadsheet moves their hands before they read anything — `Ctrl+Down` comes
before the first word of the page. A grid that answers by moving one row has told them it is a
mock-up.

| Key | What it does |
|---|---|
| `Ctrl`/`Cmd` + arrow | Jump to the edge of the data: run to the end of the block if the next cell has something in it, skip the gap to the next filled cell if it does not |
| `Shift` + arrow | Drag the far corner of the selection with you (the corner opposite the anchor is the one that moves) |
| `Ctrl` + `Shift` + arrow | Extend all the way to the edge of the data in one press |
| `Home` / `Ctrl+Home` | Start of the row / back to A1 |
| `End` / `Ctrl+End` | Last filled cell in the row / the corner of everything used |
| `PageUp` / `PageDown` | A screen at a time, **measured in pixels rather than a row count**, because an imported file's rows are not all the same height |
| `Ctrl+A` | The table you are standing in; press again for the whole sheet, the way Excel does |
| `Tab` / `Shift+Tab` · `Enter` / `Shift+Enter` | Right/left · down/up |
| `F2` · `Delete` · `Escape` | Edit in place · clear the selection · cancel |

The view **follows the cursor in both axes**, which is not a nicety here: `Ctrl+Down` can move five
thousand rows in one press, and a row outside the window is not in the DOM at all, so it cannot be
asked to scroll itself into view — the position has to be worked out.

> **The bug found while building this, and why the key handler is not on the cells:** `onKeyDown`
> used to sit on each `<td>`. `Ctrl+Down` scrolls, the windowing unmounts the very cell holding
> focus, focus falls to `<body>`, and every key after that is the browser's own scrolling rather
> than the grid's — the app looks frozen while the values underneath are still correct. The handler
> now lives on the scroller, with an effect that takes focus back **only from `<body>`**, never
> from the formula bar or a panel that legitimately has it.

**And then nothing on screen said any of it existed.** Every key above worked, and a run through
the public build the way a first-time visitor would found no help button, no shortcut list, and no
mention of `Ctrl+` anywhere outside the undo and redo tooltips. A feature only its author knows
about is not a feature. `Ctrl`/`Cmd`+`/` or `F1` opens the sheet, as does the keyboard button at the
end of the sheet-tab strip:

<p align="center"><img src="public/screenshots/35-shortcuts.png" width="760"></p>

Not `?`, which is what most web apps use: the grid starts editing a cell on any printable character,
so `?` with the sheet focused — which is nearly always — would put a question mark in a cell instead
of opening anything.

**The list is a second copy of what the handlers do**, which is the shape of every stale claim this
project has shipped. So a test reads the handler's source and compares: a key handled and not listed
fails, a key listed and handled nowhere fails, and if the extraction itself ever stops matching, a
third test catches that too — otherwise both of the others would pass by finding nothing. All three
were confirmed by breaking the code on purpose and watching them go red.

Two more things the gates could not have told me, both found by looking:

- The button went in the toolbar first. At 1360px that row fitted its thirteen buttons with nothing
  to spare, and one more pushed 42px past the edge, clipping the language toggle on every laptop
  under 1440. It lives at the end of the sheet-tab strip instead, which had the room.
- `npm run check:a11y` was green the whole time, because axe only ever saw `/app` as it loads and
  this dialog does not exist until you press something. Run against it open, axe found two serious
  violations inside it — headings at 2.62:1, and a scrolling list no keyboard could reach. Both are
  fixed, and **the gate now opens the dialog and checks it too**, so the next one gets caught by CI
  rather than by me remembering to look.

### 🔗 Formulas across sheets

`=Sheet2!A1` used to be `#SYNTAX!`. The app has had tabs, and a pivot that reads its source sheet,
since early on — but every sheet was an island as far as a formula was concerned, and a real `.xlsx`
with a cross-sheet formula in it imported as an error.

```
=ยอดขาย!A1 + ยอดขาย!A2          unquoted Thai names
='ยอดขาย Q1'!A1:B5              quoted, for a name with a space
=SUM(Sheet2!A1:A10)             a range, matched however either side capitalised it
```

The reference travels the whole way — tokenizer, AST, parser, evaluator, dependency graph,
structural shifts and rename — and three parts of that were harder than they look:

**Order in the tokenizer.** `Sheet2` on its own matches the identifier rule and would be read as a
function name; `A1` in `A1!B2` matches the cell rule. Both would be wrong and **neither would fail
loudly** — the formula would simply mean something else. The qualified form is matched first and
emitted as one token, prefix included.

**Staleness, where a test found the bug.** A sheet whose own cells are untouched is still out of
date when a sheet it reads has moved, and the identity cache is exactly where that goes unnoticed —
the object is the same. The first version recorded which foreign *sheet* it had read, which catches
one level and stops: with C reading B and B reading A, editing A leaves B's source untouched and C
hands back a stale number. It now records the foreign *computed result*, which is a fresh object
whenever it was really recomputed and whose retrieval re-runs that sheet's own staleness check
first — one comparison carries the whole chain.

**Cycles that span sheets** end in `#CIRCULAR!` rather than an infinite descent. Within a sheet the
evaluator already catches re-entry per cell; Sheet1 → Sheet2 → Sheet1 recurses a level above that,
so the resolver holds the set of sheets currently being computed.

Renaming a tab rewrites the formulas that named it, quoting or unquoting as the new name needs.
Inserting a row in one sheet moves `Sheet2!A5` everywhere and leaves every bare `A5` alone, because
those name the sheet they are written on. A sheet that does not exist is `#REF!`, and comes back to
life if someone creates one by that name.

### 🖱️ The fill handle

The first thing anyone does to a spreadsheet is drag the corner. This app had the corner grip —
touch uses it to pull a selection out — and nothing behind it on a mouse.

<p align="center"><img src="public/screenshots/37-fill-handle.png" width="820"></p>

```
5, 10        → 15, 20, 25        a constant gap
10, 8        → 6, 4, 2           downwards
1, 4, 9      → 1, 4, 9           repeated, not extrapolated
0.1, 0.2     → 0.3, 0.4          not 0.30000000000000004
จ, อ         → พ, พฤ, ศ
พ.ย., ธ.ค.   → ม.ค., ก.พ.        wrapping the year
Q3           → Q4, Q1, Q2
Item 08      → Item 09, Item 10  keeping the padding
=A1*2        → =A2*2, =A3*2      moved, never extended
```

Thai lists come first in that table because this app does. `จ อ พ` is a week to the people who will
use it, and continuing `Mon Tue` but not `จ อ` would be building for somebody else.

**Two deliberate refusals.** A run whose gap is not constant is repeated rather than extrapolated —
Excel fits a trend line to 1, 4, 9, and a wrong guess in a spreadsheet is a number nobody questions.
And a drag that wanders diagonally picks one axis, because filling both would overwrite a rectangle
nobody asked for.

`Ctrl+D` and `Ctrl+R` do the same thing from the keyboard, taking the selection's first row or
column as the source — and they are the only way to reach any of this without a pointer, which
matters after the accessibility work. The shortcut sheet's drift test caught them the moment they
were added, which is what it is for.

The grip is split by pointer type rather than shown to everyone: a finger cannot sweep a range any
other way, so touch keeps it for selecting. And the fill commits on release rather than filling
live, which matters for undo as much as for nerves — one drag is one step back, not one per cell.

### 🔎 Find and replace

`Ctrl+F` is reflex, and it did nothing here — which became *more* conspicuous, not less, the moment
a shortcut sheet went in advertising "the same keys as Excel".

<p align="center"><img src="public/screenshots/36-find-replace.png" width="820"></p>

It searches the **raw text, not the displayed result**, and the panel says so rather than leaving
you to find out. That is the decision everything else follows from: what you are looking for in a
spreadsheet is usually what you typed, and what you mean to replace is always what you typed —
rewriting a formula's result would mean writing a number over the formula that produced it. So
`=SUM(B1:B9)` is found by searching `SUM`. The cost, stated in the panel, is that searching `1250`
does not find a cell showing `1,250` that a formula produced.

Match case, whole cell, and all sheets. `Enter` and `Shift+Enter` step forwards and back, wrapping,
and Find Next walks the sheet in reading order rather than nearest-first — pressing it ten times
should go where your eye would, and a list that reorders itself around the cursor makes the tenth
press a surprise. **Replace all is one undo step**, because a hundred entries in the history for one
button press means pressing Ctrl+Z a hundred times to find out what it did.

It deliberately preempts the browser's own find bar, which searches the DOM — and the DOM holds the
forty rows the grid has decided to render, so on a five-thousand-row sheet it would report "not
found" for text that is plainly there.

### 📱 Works on a phone

Opening this on a phone used to show **not one cell of the spreadsheet** — the 320px side panel
squeezed the grid down to its row numbers, and the toolbar wrapped into three rows that ate 380px
of an 844px screen before the grid began. All three are fixed:

| Thing | What it does on a phone |
|---|---|
| **Formula / AI / data panels** | Cover the screen with a close button instead of competing with the grid, and **start closed** so the sheet is what you see first |
| **Toolbar** | Icons only, labels hidden, and **one horizontally scrolling row** rather than a wrapping one |
| **Editing a cell** | **Tap to select, tap again to edit** — it previously needed a double-click, which a phone cannot do, so nothing could be typed at all |
| **Tap targets** | 44×44 everywhere, in both bars (up from 28px — and five format-bar buttons were still only 32px wide until a later measurement caught them) |
| **Selecting a range** | A **grip on the selection's bottom-right corner**, dragged to pull the range out |
| **Hover-revealed buttons** | Shown permanently where nothing hovers — otherwise the column filter and the delete-sheet button are invisible |

![On a phone](public/screenshots/19-mobile.png)

**Dragging out a range with a finger** — a mouse sweeps a range by holding the button down and
moving, but on a phone dragging a finger across the grid is how you scroll it, and taking that over
would trade one ordinary gesture for another. So touch gets what every mobile spreadsheet gives it:
a **grip on the corner of the selection**. Only the grip takes the drag, so the rest of the sheet
still scrolls normally, and **dragging to the edge scrolls the sheet to meet the finger** — without
that a range could never be bigger than the screen, which on a phone is a handful of columns.

<p align="center"><img src="public/screenshots/21-touch-select.png" width="320"></p>

The grip appears only where `(pointer: coarse)` matches. On a mouse it would sit under the cursor
looking like Excel's fill handle while doing something else entirely.

Desktop behaviour is **unchanged**: the panel still sits beside the grid, and clicking an already
selected cell still does *not* start editing — you double-click, as in Excel. The tap-again rule is
tied to `pointerType === "touch"` rather than guessed from screen width.

**Measured** at 360×780: the toolbar used to wrap onto three rows, putting the first cell **51% of the
way down the screen**. As one scrolling row that is **38%** — 12 visible data rows up to 15 — while desktop
stays where it was, at 24%.

**Hiding a button until hover is a bug on a phone.** The column-filter button and the delete-sheet button
used `opacity-0 group-hover:opacity-100`, and a touch screen has no hover: they were **permanently
invisible** — still clickable, but with nothing to say they existed. `pointer-coarse:opacity-100` now shows
them wherever hovering doesn't exist, and leaves them quiet on a mouse.

**Not supported yet:** the row/column context menu needs a long press, which some mobile browsers
answer with their own menu.

### ➕ Insert/delete rows & columns

Right-click a row/column header to insert or delete. The app **automatically rewrites every formula in the
sheet to reference the new correct positions**; a formula that referenced the exact row/column that got deleted
turns into `#REF!`, exactly like Excel.

<p align="center"><img src="public/screenshots/26-insert-row.png" width="820"></p>
<p align="center"><sub>Insert a row at 3 and <code>=SUM(C2:C4)</code> becomes <code>=SUM(C2:C5)</code> by itself — no chasing formulas by hand</sub></p>

### 🔗 Merging cells

A report title spanning the width of a table is almost always a merged cell. This app already **read**
merges out of an imported file and wrote them back on export — it just couldn't make one. Select a range
and press **Merge** in the format bar.

<p align="center"><img src="public/screenshots/30-merge-cells.png" width="900"></p>

**One button, both directions.** A selection touching a merge turns the button into **Split**; one that
doesn't leaves it as **Merge**. Two separate buttons would mean one of them is always the wrong one to
press. It's disabled on a single cell, because one cell isn't a merge.

The button sits **next to the number format**, not at the end of the bar — merging is cell formatting, so it
belongs with bold, alignment and number format. It was first placed last, after the charts button, which on a
phone meant scrolling almost the whole bar to reach it (measured at 645px into a 725px bar).

**Selecting half of an existing merge swallows the whole thing.** Half a merge is not a thing that exists,
so the new range grows until it contains every merge it touches — and grows again if swallowing one brings
it against another. That's what Excel does. Splitting is the mirror image: touch any part of a merge and
the whole merge goes.

**Only the top-left value survives**, which is the one genuinely destructive thing here, so it **asks
first — but only when there is something to lose.** If the other cells are already empty it just merges.
A confirm dialog that fires every time is a dialog that teaches people to click through without reading.
(And undo is still there if you do.)

Merges already follow inserted and deleted rows and columns, and they **reach the exported `.xlsx` as real
`<mergeCell>` elements** — checked by unzipping the export and reading the XML directly rather than
through our own reader.

**Not supported yet:** vertical centring inside a merged cell, and dragging a selection out from a merged
cell still measures from its top-left corner.

### 🔤 Sort and filter

- **Sort** (A-Z/Z-A): selecting a single cell auto-detects the surrounding table bounds, and skips the header
  row automatically if it detects text sitting above numeric data.
- **Filter**: the funnel icon on each column header lets you check/uncheck which values to show, hiding rows instantly.

### 🧮 Pivot (summarise a range)

Select a range whose first row is the header, press **"Summarise (Pivot)"**, then choose which columns to
group by (more than one is fine), which column to fan out across the top, and what to summarise — sum, count,
average, min or max. The field buttons are named from **the first row of the range you actually selected**,
not A/B/C, so nobody has to translate column letters into headings in their head.

<p align="center"><img src="public/screenshots/28-pivot-panel.png" width="820"></p>

The result is a **new sheet**, not a special object you can't touch: sort it, filter it, chart it or export it
like any other data. The header and the grand-total row are bolded, because those are the two rows a reader
scans for first.

<p align="center"><img src="public/screenshots/29-pivot-result.png" width="820"></p>

Details that were worth getting right:

- **The totals row re-aggregates the raw values instead of adding up the cells above it.** An average of
  averages is not the average; summing what's on screen would print a number wrong in a way nobody questions.
- **A group with no numbers gives a blank, not 0.** "Nothing here" and "adds up to nothing" are different
  answers.
- **Groups sort numerically when the labels are numbers**, otherwise by locale — so Thai sorts as Thai rather
  than by code point — and blank groups always sink to the bottom.
- **A row that is blank in the grouping column but carries a number** still counts, as a `(blank)` group,
  rather than being dropped silently.

**A summary remembers where it came from, and says when the source moves.** The sheet keeps the range it
read, the fields that were picked, and a fingerprint of the values at the time. Change the source and a
notice appears on that sheet with a **Refresh** button — one press, instead of going back, re-selecting the
range and re-picking every field.

<p align="center"><img src="public/screenshots/31-pivot-refresh.png" width="900"></p>

**Deliberately not live.** The result is an ordinary sheet you can sort, chart and edit; one that rewrote
itself whenever a source cell changed would throw that away, and throw it away inside someone else's undo
history. Excel refreshes pivots on request for the same reason. Nothing is shown while it is up to date —
a banner that is always there is a banner nobody reads.

If the source sheet has since been deleted, the notice says it can't be refreshed rather than offering a
button that does nothing.

**Not supported yet:** refreshing is manual, not automatic; a refresh overwrites anything typed into the
summary sheet; one column field at a time; and the summary sheet has no filters of its own.

### 📑 Multiple sheets in one file

Switch/add/rename/delete sheets from the tab bar below the grid. Each sheet has independent data, formulas, and
formatting, but **undo/redo and autosave cover every sheet together**.

<p align="center"><img src="public/screenshots/05-sheet-tabs.png" width="820"></p>

### 📥 Import an existing Excel file

Reads every cell's value plus its **original formulas** into the grid and recomputes everything immediately; a
multi-sheet file imports as separate tabs. The file's **look** comes too — colour bands, font sizes, borders,
row heights, merged cells — see [It looks like the file you opened](#-it-looks-like-the-file-you-opened), and
if the file was built as a form, [Templates from an Excel file](#-templates-from-an-excel-file).

### 🧩 Drag-and-drop formulas

Search/filter by category (Math / Statistics / Logic / Text / Date / Lookup), then **drag** or **click** a
formula card to open the parameter panel, complete with a crosshair button to click/drag-select cells from the
grid instead of typing an address by hand. Choose to apply it to **this cell only / the whole row / the whole
column / the current selection** — relative references adjust automatically like Excel's fill handle (absolute
references with `$` stay put).

<table>
<tr>
<td width="50%" align="center"><b>Parameter panel</b><br><sub>Pick range C2:C4 straight from the grid instead of typing the address</sub><br><br>
<img src="public/screenshots/02-formula-panel.png" width="400"></td>
<td width="50%" align="center"><b>Result the moment you confirm</b><br><sub><code>SUM(C2:C4)</code> computes to 100</sub><br><br>
<img src="public/screenshots/03-after-insert.png" width="400"></td>
</tr>
</table>

### 📤 Export

- **Excel**: a single `.xlsx` with **every sheet** included — original formulas, formatting (fills, font sizes,
  borders, row heights, column widths, merged cells) and a template's locking all intact, so it opens in
  Excel/Google Sheets as the file it was rather than as computed numbers.
- **CSV**: the currently open sheet, as computed values, with the BOM Excel needs to read Thai
  (see [CSV in and out](#-csv-in-and-out)).
- **PDF**: the currently open sheet only, showing computed values with row/column headers, with the
  charts following underneath.

  **Thai reads, because the font goes with it.** jsPDF ships only the standard PDF fonts, and not
  one of them contains a Thai vowel or tone mark — so every Thai label used to come out as
  unrelated Latin glyphs. **Noto Sans Thai** (OFL, ~45KB) is now embedded, fetched from
  `public/fonts/` at export time rather than bundled: nobody who never presses Export PDF downloads
  it at all. If the fetch fails it falls back to the built-in font instead of failing the export.

  **Stacked tone marks now land correctly** (ที่, นี่, ดื่ม, ซื้อ). jsPDF applies no OpenType mark
  positioning, so a tone mark and the upper vowel under it were drawn at the same spot and merged —
  `ที่` came out as `ที`. `thaiMarks.ts` finds the marks that follow an upper vowel and
  `pdfExport.ts` draws each one again 0.19em higher. That figure was measured, not guessed: the same
  words rendered in a browser (which shapes them properly) leave a 0.047em gap, and the rise that
  reproduces it is 0.19em. A mark over a *lower* vowel (`ผู้`) or straight on a consonant (`ป่า`)
  is left where it was.

  > **Not supported:** the rest of Thai shaping — the lowered marks that tall consonants (ป ฟ ฬ)
  > want, the narrowed forms after ญ and ฐ. One rule that fixes what was actually unreadable beats
  > half a shaping engine.

### 🔀 CSV in and out

CSV is the format every other tool speaks — a bank statement, a POS export, the file a colleague mails you.
Opening one here used to mean opening it in Excel first and saving it as `.xlsx`, which made this app the long
way round for the most common file there is. The **Import file** button now takes `.csv` directly, and
**Export CSV** sits beside the other two exports.

Three details decide whether this works on real files rather than only on the ones we write:

| Thing | What it does, and why |
|---|---|
| **The delimiter isn't always a comma** | Excel writes the list separator of the machine's locale, so a file saved in Thailand or most of Europe is semicolon-separated. Guessing comma doesn't fail loudly — it loads the whole row into column A, which looks like a broken app rather than a wrong guess. Candidates are counted **outside quotes** and the winner wins (`,`, `;` and tab). |
| **A BOM is what makes Thai readable in Excel** | Without one, Excel on Windows guesses a legacy code page and every Thai file opens as mojibake. It's stripped on the way in and written on the way out — three bytes between a usable export and a bug report. |
| **Quoting is the format** | A field holding the delimiter, a quote or a newline has to be quoted with inner quotes doubled. A parser that splits on the delimiter is wrong the first time an address or a Thai note contains one. |

**Computed values on export, not formulas and not formatted text.** CSV has no formulas, so writing `=C2*D2`
hands the next reader a text field that means nothing. Numbers go out as `1234` rather than `฿1,234.00`:
on screen the thousands separator helps, but in the file it is a second delimiter that makes the column
unparseable.

**The active sheet only**, named after its tab — a CSV holds one table, and both stacking three sheets into
one file and splitting them into three are surprises.

**CSV injection is neutralised.** A value beginning `=`, `+`, `-`, `@`, a tab or a newline is written with
a leading apostrophe, which every spreadsheet reads as "the rest is text" — **and numbers are never touched**.
Prefixing every field that starts with `-` would mangle every negative number in every export, which is how
this mitigation usually gets reverted a week after it ships. On import the apostrophe this app added comes
off again, so a file exported from here and read straight back is unchanged.

**Not supported yet:** files that aren't UTF-8 (TIS-620 out of an older system, say) come in as mojibake —
there's no encoding detection. And a field that genuinely began with an apostrophe and an `=` in someone
else's file is indistinguishable from one this app escaped, so it loses that apostrophe on the way in. CSV
has no way to say "text that happens to look like a formula", so something has to give.

### 🎨 It looks like the file you opened

<p align="center"><img src="public/screenshots/17-styled-import.png" width="820"></p>

Real Excel files lean on **coloured header bands, large type, rules and row banding**. Import that
as bare numbers and people don't recognise their own file. The screenshot above is an imported
`.xlsx` with no formatting applied inside the app at all.

| From the file | Read in |
|---|---|
| Background fills (colour bands) | ✅ including alternate-row banding |
| Font size | ✅ large or small, as the file has it |
| Bold / italic / underline | ✅ |
| Font colour | ✅ |
| Borders (top/right/bottom/left) | ✅ with their colour — a rule from the file wins over the grid's own faint line |
| Vertical alignment | ✅ top / middle / bottom |
| Row heights · column widths | ✅ |
| **Merged cells** | ✅ a heading spanning several columns stays one band instead of breaking apart |
| Number formats (currency/%) | ✅ (already supported) |
| Original formulas | ✅ (already supported) recomputed immediately |

All of it **exports back to `.xlsx`**, so the file opens in Excel as the file it was.

> **Not supported:** images and charts in the sheet, specific font families
> (the system font is used), and arrowing into a cell a merge has swallowed — that cell no longer
> exists in the DOM, though the merged band itself clicks normally.

### 📋 Templates from an Excel file

<p align="center"><img src="public/screenshots/15-template.png" width="820"></p>

A form someone already built in Excel — a quote, a requisition, a data-entry sheet — **already says
which cells are meant to be filled in**. Excel locks every cell by default, and whoever built the
form deliberately unlocked the fields. That gets read straight back, so **nothing has to be marked
up again**.

| In the file | In the app |
|---|---|
| The sheet is protected | Template mode, with an amber bar saying how many fields there are |
| An unlocked cell | A field — amber outline, editable |
| A locked cell | The template's structure — dimmed, read-only |
| A data-validation list | Click and choose, rather than a blank text box |
| Column widths | Applied, so the form still looks like the form |
| Formulas in the form | Compute over what was typed (`=B5*B6` feeding `=B7*1.07`) |

<p align="center"><img src="public/screenshots/16-template-dropdown.png" width="820"></p>

**Every route in is guarded**, not just typing: Delete, paste, sorting, and adding or removing
rows and columns are all refused *with a reason* — silently doing nothing reads as the app being
broken rather than the template doing its job.

**But you're not trapped in it** — "Unlock the sheet" makes every cell editable like an ordinary
sheet, and Ctrl+Z brings the template back (the template state lives inside `sheets`, so it sits
under undo and autosave like any other content).

**Export puts the template back together**: the exported .xlsx is protected again, with the same
cells unlocked, the dropdowns re-attached and the column widths intact — open it in Excel and it's
still a form.

> **Not supported:** *authoring* a template inside the app — this reads templates from files that
> already are one. (Merged cells and conditional formatting were both on this list once; both have
> since shipped.)

### 🏠 A landing page that explains the app

`localhost:3000` now opens on a page describing what the app does, with an **"Open the app"** button through
to `/app` — where before you landed straight in a bare grid with nothing telling you how to use it. Every
screenshot on it comes from the running app rather than a mockup, and it goes through the same message
dictionary as the app, so the language you choose there carries through with you.

**The table in the hero is not a screenshot — it is the engine.** `LiveSheet` imports the same
`parseFormula` and `evaluate` the app runs on, so double-clicking a price recomputes `=B2*C2` and
`=SUM(D2:D5)` in the visitor's browser. A spreadsheet product whose front page shows a *picture* of a
spreadsheet is asking to be taken on trust; this asks for ten seconds instead. It also keeps itself
honest: if the engine regresses, the front page visibly breaks.

<p align="center"><img src="public/screenshots/25-landing.png" width="820"></p>

**The old pitch said nothing.** "Open Excel and keep working in the browser" is what Google Sheets and Office on
the web already do, for free, for millions of people. The page now answers that objection directly, right under
the hero, instead of hoping a visitor reads far enough to find the difference themselves. Every row is a
checkable fact — and **the row this app loses is in the table too**, because a comparison the author wins
outright is one nobody believes.

<p align="center"><img src="public/screenshots/32-landing-compare.png" width="900"></p>

**The first section stopped being a feature list.** It used to read "formula syntax you can't recall",
"mistyped cell addresses", "data stuck in another system" — capabilities dressed up as problems, and
nobody reads one of those and thinks *that is me*. It is now four situations told as situations, each
with the same three lines under it: **what goes wrong** (what actually happens) · **what happens here**
(what the app does instead) · **what you get for moving** (the only line a visitor came for). That last
line is set darker than the other two, because after one pass a reader skips straight to it.

<p align="center"><img src="public/screenshots/38-landing-problems.png" width="900"></p>

The page is laid out as **ledger paper** rather than as a stack of rounded cards: hairline rules instead
of boxes, square corners, the alternating pale-green row bands of accounting paper, monospace with tabular
figures for every number, formula and cell address against a sans for prose, and one inverted band through
the middle as a spine. There is not a single gradient on it.

The whole app moved to **IBM Plex Sans Thai** with **IBM Plex Mono**. It had declared Geist, but
`globals.css` overrode that with `Arial` anyway — and Geist carries no Thai glyphs at all, so every
Thai character fell back to whatever the OS offered and the same page looked different on Windows
and macOS. Plex Mono has no Thai either, so the `font-mono` stack names Plex Sans Thai after it:
figures and formulas still line up in columns in Plex Mono, while Thai words on the same line are
set in the same family as the body text rather than in the system's default monospace face.

<p align="center"><img src="public/screenshots/27-landing-stats.png" width="820"></p>
<p align="center"><sub>The inverted "Under the hood" band and the <b>Where this stops on purpose</b> section — the front page says where the app stops, and sends the rest of the limits here.</sub></p>

### 🌐 Bilingual (Thai / English)

Click **EN**/**ไทย** in the top-right corner to switch the entire UI instantly — menus, buttons, all 32 formula
names/descriptions, alert text, and AI replies (both the keyword heuristic and real Claude) all follow the
selected language. The choice is remembered per browser. See [Bilingual UI (i18n)](#-bilingual-ui-i18n) for the
architecture behind it.

<p align="center"><img src="public/screenshots/07-english-ui.png" width="820"></p>

---

## 🛠 Tech stack

### Framework / language

| Technology | Version | Used for |
|---|---|---|
| [Next.js](https://nextjs.org) | 16 (App Router) | The main framework — every page is a client component, plus one API route (`/api/ai/formula`) |
| [React](https://react.dev) | 19 | UI library |
| [TypeScript](https://www.typescriptlang.org) | 5 (strict) | Type safety across the project, including the formula engine and the i18n dictionary's key parity |
| [Tailwind CSS](https://tailwindcss.com) | 4 | All styling, utility-class based |

### Core libraries

| Library | Used for |
|---|---|
| `zustand` | Central state (`sheetStore` — grid/selection/formula panel, `localeStore` — language) with a `persist` middleware autosaving to `localStorage` |
| `zundo` | Built on zustand to keep an edit history for undo/redo (sheet content only, never selection or transient UI) |
| `exceljs` | Reads/writes `.xlsx` files, preserving original formulas and formatting (chosen over `xlsx`/SheetJS, whose published npm version has unpatched security advisories) |
| `jspdf` + `jspdf-autotable` | Builds PDF exports from the computed sheet |
| `@supabase/supabase-js` | Optional cloud save — dynamically imported, so it never loads unless configured |
| `@anthropic-ai/sdk` | Connects to the Claude API for the AI assistant |
| `lucide-react` | UI icons |
| `clsx` | Conditional className composition |
| `vitest` | Unit tests for the formula engine, sort logic, JSON-to-table conversion, pagination, rate limiting, templates, file fidelity, conditional formatting and live blocks (948 cases) |

> **Note:** No off-the-shelf formula library (e.g. HyperFormula) is used — the **formula engine is hand-written**
> (tokenizer, parser, evaluator, and functions) to keep full control over its behavior. See
> [Formula engine](#-formula-engine) for details.

### Tooling

- **Node.js 20.19+ or 22.12+** (22 or 24 recommended) and npm — the floor the test suite's Vite 7 needs
- **ESLint 9** (`eslint-config-next`), including React 19-specific rules (`react-hooks/set-state-in-effect`, `react-hooks/refs`)
- **Vitest 3** for unit tests
- No database or separate backend — everything runs in one Next.js app

---

## 🏛 Architecture

### System overview

The app is **entirely client-rendered** (every page is `"use client"`) and all sheet data lives in the browser —
there's no server-side database. The server is used for exactly two things that can't (or shouldn't) happen in
the browser:

1. **Asking AI for a formula** — the Claude API key must never reach the user's side.
2. **Fetching live data from an external API/CSV** — credentials belong on the server, and fetching server-side
   means CORS is never the user's problem.

```mermaid
flowchart LR
    subgraph browser["User's browser"]
        UI["Web page (React, client components only)"]
        Store["Zustand stores<br/>sheetStore + localeStore"]
        LS[("localStorage<br/>sheet data + language")]
        Engine["Formula Engine<br/>all computation happens locally"]
    end

    subgraph server["Next.js Server"]
        API["/api/ai/formula"]
        SRC["/api/sources/*<br/>CRUD + test + :id/data"]
        Repo[("data/sources.json<br/>config + credentials<br/>— gitignored")]
    end

    Claude[("Claude API")]
    Ext[("External<br/>REST API / CSV")]

    UI <--> Store
    Store <--> LS
    UI --> Engine
    UI -->|"POST question + selection + locale"| API
    API -->|"ANTHROPIC_API_KEY set"| Claude
    API -->|"no key"| Heuristic["local keyword matching (heuristic)"]
    Claude --> API
    Heuristic --> API
    API -->|"formula + explanation"| UI

    UI -->|"polls on each source's interval"| SRC
    SRC <--> Repo
    SRC -->|"fetch + auth header"| Ext
    Ext -->|"raw JSON / CSV"| SRC
    SRC -->|"normalized TableData<br/>(no credentials attached)"| UI
```

### State management

`sheetStore` is the single source of truth for the whole app, wrapped in two middleware layers: `persist`
(autosave) wraps `temporal` from `zundo` (undo/redo) — each layer only "sees" part of the state, so selection or
transient UI never leaks into the undo history or the saved file:

```mermaid
flowchart TB
    Components["Components (features/*)<br/>read/write state via useSheetStore directly"]

    subgraph sheetStore["sheetStore"]
        direction TB
        Full["full state: sheets, activeSheetId,<br/>selectionBySheetId, filtersBySheetId,<br/>pending, clipboard, sidebarMode,<br/>dataPicker, busy"]
        Temporal["temporal (zundo) only sees: sheets<br/>→ undo/redo history"]
        Persist["persist only sees: sheets, activeSheetId<br/>→ autosave"]
    end

    Components --> Full
    Full -.->|partialize| Temporal
    Full -.->|partialize| Persist
    Temporal --> History[("undo/redo history<br/>in memory")]
    Persist --> LS[("localStorage:<br/>exceltogo-sheet-v2")]

    LocaleStore["localeStore (separate)<br/>persist only, no undo"] --> LS2[("localStorage:<br/>exceltogo-locale")]
```

**Why split it this way:** at one point during development, `selection` lived directly inside `sheets`. The
result: **merely clicking to select a cell counted as an undo-history entry** (zundo saw the state change).
Fixed by moving `selectionBySheetId`/`filtersBySheetId` out into their own top-level fields, so both `temporal`'s
and `persist`'s `partialize` only ever see `sheets` (plus `activeSheetId` for persist).

**How live data fits in:** `liveBlocks` (which block came from which source, where it sits, how much space it
takes) is stored **inside `sheets`**, because it genuinely is sheet content — placing, changing or removing a
block is undoable with Ctrl+Z and autosaved like anything else. `dataPicker` (which picker dialog is open) is
transient UI, so it stays outside `sheets`.

That creates a problem: **refreshes write into `sheets` too.** Left alone, every 5 seconds would push a new
undo entry, and Ctrl+Z would only step back through old values of the same number. `applyLiveData` therefore
wraps its writes in `temporal.pause()` / `temporal.resume()` — data still updates, the history never sees it.
The "Change" button (`replaceLiveBlock`) does "clear the old + place the new" inside a single action, so it
counts as one undo step rather than two.

### Colour system

Colours mean fixed things rather than whatever each screen reached for. There used to be four accents
(blue/violet/emerald/amber) split by *when the code was written*, which left three adjacent toolbar buttons
lighting up in three different colours.

| Colour | Means | Where |
|---|---|---|
| **Emerald** | Brand, primary actions, the open sidebar, live data | Every primary action in the app |
| **Blue** | **Where you are**, and nothing else | Selected cell, selected headers, the edit box, copy marching-ants |
| **Amber** | **Warnings**, and nothing else | Partial data, rate-limited |
| **Red** | Errors | Failed connection, `#REF!` |
| **Zinc** | Everything else | Including a template's read-only structure |

Blue stays separate deliberately: the selection has to stay legible over every background, live-data green
included, and it's the colour both Excel and Google Sheets use for the same job. Template input cells **no
longer use amber** — a form with twenty fields read as twenty alerts. They follow paper instead: the printed
parts are grey, the blanks are white.

Every piece of text clears WCAG AA: primary buttons are `emerald-700` (white on it is 5.48:1 — `emerald-600`
managed only 3.77 and failed), and hint text is `zinc-500` (4.83:1, where `zinc-400` was 2.56).

### Clean layering of `src/lib/`

Code with no React/UI dependency is fully separated, so it can be tested without a browser at all:

```
sheetStore.ts (Zustand actions)
      │
      ▼
sheet.ts / sheetClipboard.ts / sheetSort.ts   ← sheet data model + whole-sheet computation
      │
      ▼
formulaEngine/ (tokenizer → parser → evaluator → functions)
```

`sheet.ts` used to be one file covering the model, clipboard, TSV, and sorting all at once — it's now split into
3 focused files (`sheetClipboard.ts`, `sheetSort.ts`), with `sheet.ts` re-exporting both so every existing
`@/lib/sheet` import keeps working unchanged, with no need to touch import paths across the project.

---

## 📁 Project structure

```
src/
  app/
    page.tsx                 # The landing page at / — features, screenshots, and the button into the app
    app/page.tsx             # The app itself at /app — assembles components from store state (holds none)
    api/ai/formula/route.ts  # API endpoint suggesting formulas (Claude, or a heuristic fallback)
    api/sources/             # Source CRUD, /test (run without saving), /[id]/data (fetch as a table)
                              # errorResponse.ts: failures → responses; a rate limit keeps a real 429 + its wait
    api/demo/                # Self-drifting demo endpoints so live data can be tried without a real API
                              # (sales, summary, and orders — paginated at 25 rows a page)
  store/
    sheetStore.ts            # Main Zustand store — sheets (incl. liveBlocks), activeSheetId, per-sheet
                              # selection/filters, the formula panel being filled in, which sidebar is open,
                              # which data picker is raised, plus every action —
                              # wrapped in persist (autosave) + zundo (undo/redo) covering all sheets together
    dataSourceStore.ts       # Live-data store — the source list, each source's latest table, errors, and a
                              # per-source backoff (rate-limited, or repeatedly failing → stop calling for a
                              # while). Neither persisted nor undoable: live data can always be re-fetched
    localeStore.ts           # Separate Zustand store for the selected UI language (th/en) — persisted the
                              # same way, but not tied to the sheet's undo/redo
  i18n/                      # All UI text, split by language (no off-the-shelf i18n library)
    types.ts                 # The central `Messages` type — TypeScript enforces th.ts/en.ts key parity
    th.ts, en.ts              # The actual text dictionaries (buttons/labels/formula names+descriptions/alerts)
    messages.ts               # Just a plain locale -> Messages map, usable from both client and server (API route)
    index.ts                  # useT()/useLocale() (hooks for components) + getMessages() (used in the store)
  features/
    grid/SpreadsheetGrid.tsx        # The main grid (cell selection/editing, sticky headers, right-click
                                     # insert/delete row-column, hides filtered rows, accepts formula and
                                     # live-data drops, draws live-block borders + the selected block's toolbar)
    grid/useHeaderContextMenu.ts    # Hook: state + open/close for the row/column header right-click menu
    grid/useColumnFilterPopoverState.ts # Hook: state + open/close/toggle for the column filter popover
    grid/useClickAway.ts            # Shared hook: closes a popover/menu on an outside click or scroll
    grid/FormulaBar.tsx             # The formula bar above the grid
    grid/SheetTabs.tsx              # The sheet tab bar below the grid
    grid/TemplateBar.tsx            # Says the sheet is a template, how many fields, and offers the unlock
    grid/ColumnFilterPopover.tsx    # The per-column filter popover
    grid/ChartOverlay.tsx           # Charts floating over the cells: drag, resize, switch kind, delete
    grid/ChartPanel.tsx             # The "Charts" panel: build one from the selection + this sheet's list
    grid/ChartView.tsx              # The SVG drawing itself (bar/line/pie), sized to the box it is given
    grid/SelectionHandle.tsx        # The corner grip that extends a selection with a finger on touch
    grid/CommentPopover.tsx         # The box that writes or clears the selected cell's note
    landing/LiveSheet.tsx           # The real grid in the hero — imports the app's own parser/evaluator,
                                     # so it is not a screenshot: edits recompute in the visitor's browser
    cloud/CloudPanel.tsx            # The cloud panel: sign in, save, and open from the user's own Supabase
    grid/ConditionalFormatPanel.tsx # The conditional-formatting panel: writing rules + this sheet's list
    grid/StorageNotice.tsx          # The dismissible bar saying the data lives only in this browser
    formulas/FormulaPalette.tsx     # The formula list panel — search/category filter/drag
    formulas/FormulaParamPanel.tsx  # The parameter-entry panel — pick a range from the grid + choose a scope
    ai/AIAssistantPanel.tsx         # The "ask AI" chat panel
    data/DataSourcePanel.tsx        # The "Data" panel: source list + blocks placed in this sheet
    data/SourceRow.tsx              # One compact source row: live status, ⋮ menu, primary "Insert into sheet" (also draggable)
    data/DataPicker.tsx             # Raises the picker from store state, so the panel and a block both can open it
    data/DataPickerDialog.tsx       # The picker: whole table / single value + preview + target cell + overwrite warning
    data/LiveBlockToolbar.tsx       # Toolbar floating above the selected block: refresh / change / remove
    data/valueLabel.ts              # Turns (column, sum/avg/count) into readable text in the selected language
    data/SourceSetupDialog.tsx      # Tech-side setup form + "test connection"
    data/useLiveDataPolling.ts      # Root hook: loads sources + polls each on its own interval
                                     # (a tick landing inside a backoff makes no request at all)
    toolbar/Toolbar.tsx             # The top toolbar
    toolbar/FormatBar.tsx           # The cell-formatting bar + sort buttons
    toolbar/LanguageToggle.tsx      # The UI language switch button
  lib/                       # Core domain logic, no React/UI coupling — editable/testable independently
    formulaEngine/           # The hand-written formula engine — tokenizer.ts, parser.ts, ast.ts, evaluator.ts,
                              # functions.ts, coerce.ts, address.ts, shift.ts, structuralShift.ts,
                              # formulaProgram.ts (AST cache + what each formula reads),
                              # each with a matching *.test.ts run by Vitest
    formulaCatalog.ts        # The ready-made formula catalog's structure (id/params/how to build it) — the
                              # actual displayed name/description/labels come from src/i18n/th.ts,en.ts
    cellFormat.ts            # Cell formatting (bold/italic/underline/color/fill/font size/borders/alignment/
                              # number format) + pt↔px conversion and to/from Excel numFmt
    aiHeuristic.ts           # Keyword-based formula suggestion logic (used with no ANTHROPIC_API_KEY), bilingual
    aiPrompt.ts              # The prompt and reply parsing, shared by the server route and the browser (BYOK)
    aiRange.ts               # Which cells a question is about, from where the cursor is (AutoSum) + the headers sent along
    keyboardShortcuts.ts     # Every shortcut in one list; a test reads the handlers' source and fails if the two disagree
    sheetFilter.ts           # Which rows a filter hides — shared by the grid and by the spoken row count
    fillSeries.ts            # What dragging the corner continues into — numbers, Thai days and months, quarters, formulas
    sheetSearch.ts           # Find and replace over the raw text rather than the displayed result
    workbookRefs.ts          # The formula rewrites that are not a fact about one sheet: cross-sheet shifts, renames
    byok.ts                  # The visitor's own API key: this tab only, masked when shown
    sheet.ts                 # The core sheet data model, whole-sheet computation, applying a formula by scope,
                              # inserting/deleting rows-columns
    sheetClipboard.ts        # Copy/cut/paste, converting to/from TSV (for cross-app pasting)
    sheetSort.ts             # Detecting the range to sort + the actual sort
    sheetMerges.ts           # Merged cells: which cell renders, which are swallowed, shifting on edits (tested)
    sheetRange.ts            # A range of cells and how it follows an insert/delete — shared by charts
                              # and conditional formatting, which need identical behaviour
    cellComments.ts          # Notes attached to cells, and how they follow an insert/delete (tested)
    csv.ts                   # CSV read/write: delimiter sniffing, BOM, RFC 4180 quoting
    download.ts              # Handing a Blob to the browser as a file — its own module because the
                              # crash screen needs it and must not pull ExcelJS into that path
    crashRescue.ts           # Rescues the sheet out of localStorage when a render throws and offers it
                              # as one CSV per tab — touches no store, model or engine, since any of
                              # those may be what broke (tested)
    charts.ts                # Charts: reading a range into series and labels, the axis, the frame a chart
                              # is moved and resized by, its cell anchor, a pie's series, the legend
                              # per kind, shifting (tested)
    chartGeometry.ts         # A chart reduced to plain shapes, shared by the on-screen and exported
                              # drawings so the two cannot drift apart (tested)
    chartImage.ts            # A chart as a picture (SVG → PNG) for the .xlsx and the PDF (tested)
    gridGeometry.ts          # Row/column positions in pixels + where a new chart lands — shared with the
                              # grid so the two agree on exactly the same sizes (tested)
    sheetCompute.ts          # Works out every cell's value, and works out the next one without redoing
                              # the rest — keeps a dependency graph (tested, with a benchmark)
    rowWindow.ts             # Which rows a scrolled grid actually has to put in the DOM, so a
                              # ten-thousand-row sheet does not render ten thousand rows (tested)
    gridNavigation.ts        # Excel's cursor rules — Ctrl+arrow to the edge of the data, Ctrl+End,
                              # Ctrl+A around a block, Page keys measured in pixels (tested)
    demoMode.ts              # Switch that turns the live-data feature off for a public demo
    site.ts                  # The one canonical public URL shared by metadata, sitemap and robots
    thaiMarks.ts             # Finds tone marks stacked on an upper vowel that must be redrawn higher (tested)
    pivot.ts                 # The group-and-summarise engine — pure functions, no sheet or UI (tested)
    xlsxChartXml.ts          # Builds the chart OOXML (chart part + drawing anchor) as pure strings (tested)
    xlsxCharts.ts            # Splices chart parts into the finished .xlsx and wires the rels (tested)
    dataSources/sourcesToken.ts  # The operator token on the browser side (kept in sessionStorage)
    server/rateLimiter.ts    # Per-IP ceiling on /api/ai/formula (in-memory fixed window) (tested)
    server/urlGuard.ts       # SSRF guard: checks resolved addresses and every redirect (tested)
    server/sourcesAuth.ts    # The gate on the live-data API — no token means off (tested)
    server/secretBox.ts      # Encrypts a source's credential with AES-256-GCM (tested)
    cloud/config.ts          # Whether a cloud backend is attached at all (off unless set) (tested)
    cloud/workbook.ts        # The stored workbook shape, reading it back, and the conflict rule (tested)
    cloud/client.ts          # The Supabase client (dynamically imported), auth and workbook CRUD
    conditionalFormat.ts     # Conditional formatting rules: compare/text/rank/colour scale/data bar, the
                              # per-cell styling they produce, and range shifting on edits (tested)
    sheetTemplate.ts         # Templates from a file: which cells are fields, dropdown options, width units (tested)
    liveBlocks.ts            # Writes a source's table into cells, tracks extent to clear shrinking data, sum/avg/count (tested)
    dataSources/             # Types + jsonToTable.ts (turns any JSON/CSV into a table) + paginate.ts
                              # (finds the next page from a Link header/next field/cursor/URL param) +
                              # rateLimit.ts (reads the wait out of headers + backoff maths) — all tested
    server/                  # Server-only: sourceRepo.ts (config + credentials in data/sources.json),
                              # executeSource.ts (does the actual fetch)
    excelIO.ts                # Importing/exporting a multi-sheet workbook (.xlsx) via exceljs, with cell formatting
    pdfExport.ts              # PDF export via jspdf + jspdf-autotable (the table, then the charts)
                              # Both are dynamically imported from sheetStore, so exceljs and jspdf
                              # load on the button press rather than in the app's first chunk (~433KB)
    pdfFont.ts                # The Thai font embedded into exported PDFs, fetched on export (tested)
  types/
    sheet-ui.ts               # Types for the grid's selection state
.github/workflows/
  ci.yml                     # CI: lint → check:readme → test → build on every push/PR, Node 20.19/22.12/24
                             #     plus an accessibility job: axe at two widths in a real browser
scripts/
  check-readme.mjs           # Pre-push README check (dependency-free) — see AGENTS.md for the rule
  check-a11y.mjs             # axe at two widths plus sideways-scroll checks, against a production build
  make-social-preview.mjs    # Renders GitHub's 1280x640 card, counting its figures from source
public/
  screenshots/               # Screenshots from the running app — used by both the landing page and this README
  social-preview.png         # What GitHub shows when the repo is pasted — uploaded in Settings, not read from here
```

Every component under `features/` reads/writes state via `useSheetStore` directly (never through props passed
down from `page.tsx`), so there's no prop drilling, and new features (undo/redo, autosave, etc.) can be added in
one place: `store/sheetStore.ts`.

---

## 🧮 Formula engine

The most deliberately-built part of the project, because it's the one place a mistake fails silently — a wrong
number, with no error shown.

### Pipeline

```mermaid
flowchart LR
    Raw["Raw formula text<br/>e.g. =SUM(A1:A10)*2"] --> Tok["tokenizer.ts<br/>splits into tokens"]
    Tok --> Par["parser.ts<br/>builds an AST (recursive descent)"]
    Par --> Eval["evaluator.ts<br/>walks the AST to compute a result"]
    Eval -->|"calls"| Fn["functions.ts<br/>59 functions"]
    Eval -->|"getCell(row, col)"| Sheet[("other cells' values/formulas<br/>in the sheet")]
    Sheet -.-> Eval
    Eval --> Result["a number/text value,<br/>or a FormulaError"]
```

- **Tokenizer** splits the formula string into tokens (numbers, strings, cell refs `A1`, range refs `A1:B10`,
  functions, operators), supporting absolute references (`$A$1`) and the literal `#REF!` token.
- **Parser** is a plain recursive-descent parser that gets operator precedence right (`^` before `* /` before
  `+ -` before comparisons), with `^` as right-associative.
- **Evaluator** walks the AST to compute a result, distinguishing a scalar result from a range result (so
  functions like `VLOOKUP`/`SUMIF` know which argument is a range), and detects **circular references** with a
  `Set` of cells currently being computed — looping back to a cell already in progress returns `#CIRCULAR!`
  instead of overflowing the call stack.

### Recalculating only what changed

Every keystroke used to recompute the whole sheet and **re-parse every formula in it**. Measured on
the development machine, three formulas per row with one running-total column:

| Sheet size | Cost of one keystroke |
|---|---|
| 200 rows (600 cells hold formulas) | 11.9 ms |
| 1,000 rows (3,000 cells hold formulas) | 139.2 ms |
| 3,000 rows (9,000 cells hold formulas) | **1,244.9 ms** |

Past a thousand rows the grid is visibly behind the typing. At three thousand it is unusable.

**Two things changed:**

1. **Formulas compile once.** `formulaEngine/formulaProgram.ts` caches by formula text, so filling
   `=A1*B1` down three thousand rows parses one formula, not three thousand per keystroke.
2. **There is a dependency graph.** Each formula's precedents — cells and ranges — are read off its
   syntax tree, so an edit recomputes the transitive closure of whatever reads it and nothing else.

The second is only sound **because this language has no `INDIRECT` and no `OFFSET`**: every
reference is a node already sitting in the tree, so walking it gives the complete set. Adding
either function means the graph has to learn about references discovered at evaluation time, and
the code says so where it matters.

`TODAY()` and `NOW()` are marked **volatile** and recomputed every pass, because nothing in the
sheet changes to say they went stale. A cache that did not know this would freeze `=TODAY()` at the
moment it was first typed.

**After** (`sheetCompute.bench.test.ts` measures this on every run, so the numbers are not memory):

| | First compute | One edit |
|---|---|---|
| 1,000 rows (3,000 cells hold formulas) | 75 ms | **6.7 ms** |
| 3,000 rows (9,000 cells hold formulas) | 124 ms | **7.7 ms** |
| 3,000 rows + a running total | — | **8.5 ms** (edit near the end) |

These come from one `npm run verify` on the development machine and move by roughly a factor of
two between runs, so the test asserts on a *ratio* — one edit must cost at most a quarter of a full
recompute — and on loose ceilings, rather than on figures a busy CI runner would fail.

**The limit that is still there, and is not hidden:** editing the cell that all three thousand
running totals read — row 1 — still costs somewhere around 1,000–1,200 ms. That is a real fan-out; three thousand
sums genuinely have to be re-added, and the graph is right to say so. It is not a cache miss. The
benchmark measures that case too rather than leaving it to the prose.

**Proof it does not compute the wrong answer:** `sheetCompute.test.ts` makes 120 random edits and
compares the result against a from-scratch recompute after every one, plus a second run that stacks
200 edits before comparing. The tests also **assert how often the fast path actually ran** —
without that, an implementation that quietly fell back to a full recompute every time would pass
them all while doing none of the work.

### A ten-thousand-row sheet does not render ten thousand rows

The grid put every row in the DOM. At thirty rows that is right; at five thousand it is five
thousand `<tr>` elements the browser lays out and hit-tests on every render, of which fewer than
forty are on screen.

`rowWindow.ts` works out which band is visible and stands two spacer rows in for the rest, so the
scrollbar still measures exactly the same height. Checked in a browser by importing a 5,000-row
CSV: **41 `<tr>` in the DOM**, 160,064px of scroll height, and row 5,001 still reachable.

Two things it is easy to get wrong, both pinned by tests: **a filtered row must take no height at
all**, or charts drift away from the data they sit next to; and **a merge that crosses the edge of
the window** — the `rowSpan` lives on the top-left cell, so if that cell is above the window the
cells it covers are not rendered either and the merge leaves a hole. The window reaches back to the
anchor for exactly that reason.

Below 200 rows nothing is virtualized: at that size the window costs more than it saves, and the
thirty-row sheet the app starts on renders exactly as it always did.

### Two different algorithms for adjusting references

The part that's easy to overlook: "shift a formula on copy" and "shift a formula on inserting/deleting a
row/column" are genuinely different algorithms. Get either one wrong and formulas silently compute the wrong
thing:

| | `shift.ts` (relative shift) | `structuralShift.ts` (structural shift) |
|---|---|---|
| Used when | Copy/paste, dragging the fill handle | Inserting/deleting a row or column |
| An absolute ref like `$A$1` | **Doesn't move** (standard Excel behavior) | Always moves (a row was really inserted, so every reference must shift) |
| A reference that lands exactly on a deleted position | Never happens in this path | Becomes `#REF!` |
| A range spanning the insert/delete point | Shifts the whole range equally | **Grows/shrinks** as appropriate (insert in the middle → range gets longer; delete an edge until empty → `#REF!`) |

### Supported functions

The drag-and-drop palette shows only the **32 most commonly used** formulas, but the engine itself supports
**59 functions** — the rest can be typed directly into a cell even with no card in the palette (e.g. `=MID(...)`,
`=YEAR(...)`, `=PROPER(...)`):

| Category | In the palette (32) | Also available by typing |
|---|---|---|
| Math | `SUM` `PRODUCT` `ROUND` `ABS` `SUMIF` `SUMIFS` | `ROUNDUP` `ROUNDDOWN` `SQRT` `POWER` `MOD` `INT` `CEILING` `FLOOR` `SUMPRODUCT` |
| Statistics | `AVERAGE` `COUNT` `COUNTA` `MIN` `MAX` `COUNTIF` `AVERAGEIF` `COUNTIFS` `AVERAGEIFS` | `COUNTBLANK` `RANK` `RANK.EQ` |
| Logic | `IF` `IFERROR` `AND` `OR` | `NOT` `IFNA` |
| Text | `CONCATENATE` `UPPER` `LOWER` `TRIM` `LEFT` `RIGHT` | `CONCAT` `MID` `LEN` `PROPER` `TEXT` `TEXTJOIN` `SUBSTITUTE` `FIND` `SEARCH` `CHAR` `CODE` |
| Date | `TODAY` `NOW` `DATEDIF` | `DAY` `MONTH` `YEAR` |
| Lookup | `VLOOKUP` `XLOOKUP` `INDEX` `MATCH` | — |

> **The last ten came from asking the real model, not from working through the Excel reference.**
> `TEXTJOIN` `FIND` `RANK.EQ` `SUMPRODUCT` `CEILING` `CHAR` — and their obvious companions `SEARCH`
> `SUBSTITUTE` `FLOOR` `CODE` — are what the assistant answered with while this engine had no such
> function. See [Ask AI for a formula](#-ask-ai-for-a-formula) for how that was found.

**`INDEX` + `MATCH` replaces `VLOOKUP` and does what it cannot** — `VLOOKUP` can only search the
leftmost column of a table, and hard-codes *which column number* to return, which breaks silently
the moment someone inserts a column:

```
=INDEX(D2:D100,MATCH("Phuket",A2:A100,0))   read column D, searching column A
=INDEX(A2:A100,MATCH(150,C2:C100,0))        search column C, return column A — VLOOKUP cannot look leftwards
```

Giving `INDEX` a row number of 0 hands back the whole column (or 0 for the column, the whole row),
so another function can consume it: `=SUM(INDEX(A1:D6,0,3))`.

**`XLOOKUP` is the one to reach for now** — it names the search range and the answer range
separately, so the key needn't be leftmost and nothing breaks when a column is inserted between
them. Two further differences from `VLOOKUP` matter in practice: it matches **exactly by default**
(`VLOOKUP`'s default is approximate, which quietly returns a neighbouring row), and it takes what to
show when nothing matches, instead of leaving `#N/A` to be wrapped in `IFERROR` — which swallows
real errors along with the miss:

```
=XLOOKUP("Phuket",A2:A100,D2:D100,"not found")
=XLOOKUP(150,C2:C100,A2:A100,,-1)               nearest value at or below 150
```

The nearest-match modes compare rather than assume the column is sorted, which is the case
`VLOOKUP`'s approximate match gets silently wrong. Both arrays must be a single row or column of the
same length: Excel would spill a whole row out of a two-dimensional return array, and this engine
has no spilling, so that is refused rather than answered with the first cell.

**An argument can be left out mid-formula** — `XLOOKUP(a,b,c,,-1)` skips `if_not_found` to reach the
match mode, the way Excel writes it. Before this the parser rejected the empty slot, which made
every argument after an optional one unreachable without typing a value nobody meant.

**`DATEDIF` answers "how long between these two dates"** in whole units: `"Y"`, `"M"` and `"D"`,
plus `"MD"`, `"YM"` and `"YD"` — the days ignoring months and years, the months ignoring years, and
the days ignoring years — which between them say "3 years, 2 months and 5 days" without three
separate subtractions. An end date before the start is `#NUM!`, as in Excel: it is a mistake in the
sheet, and a negative age would hide it.

**`SUMIFS` takes its arguments in the opposite order to `SUMIF`** — `SUMIF` puts the range being
summed *last*, `SUMIFS` puts it *first*. That's Excel's own inconsistency, kept because a formula
copied out of a real workbook has to behave the same way here:

```
=SUMIF(A2:A100,"Bangkok",C2:C100)                    one condition — sum range last
=SUMIFS(C2:C100,A2:A100,"Bangkok",B2:B100,"Q2")     several conditions — sum range first
```

Each criteria range has to be the same shape as the summed range, or the result is `#VALUE!`.
Lining them up from the top-left instead would test the wrong row for every cell past the shorter
range, and return a total that looks entirely reasonable and is wrong.

**Criteria typed into the palette are quoted for you** — `Q2` becomes `"Q2"` (not a reference to
the empty cell Q2), and `>100` becomes `">100"`, which is the only form that parses. For a
criteria that should come from a cell, write it Excel's way by concatenating: `">"&F1`, or
`""&F1` for the value alone.

**Criteria take wildcards** — `*` for any run of characters, `?` for exactly one, and `~` to escape
either when you mean the character itself (`"10~*20"` finds `10*20`). They work across the whole IF
family: `SUMIF`, `COUNTIF`, `AVERAGEIF`, `SUMIFS`, `COUNTIFS`, `AVERAGEIFS`. Matching ignores case
and covers the whole cell, so wrap a term in `*` on both sides for "contains".

**Not supported:** `MATCH` over a two-dimensional range — that returns `#N/A` rather than guessing a
position inside a block.

Full support for arithmetic/comparison/concatenation operators (`+ - * / ^ = <> < > <= >= &`) and Excel-style
error values: `#DIV/0!`, `#VALUE!`, `#NAME?`, `#N/A`, `#REF!`, `#CIRCULAR!`.

Want to add a formula to the drag-and-drop palette? Add the real function in `functions.ts`, then add its entry
plus both languages' text in `formulaCatalog.ts` and `i18n/th.ts`/`en.ts`.

---

## 🌐 Bilingual UI (i18n)

No off-the-shelf i18n library (e.g. next-intl) is used, since the app is already entirely client-rendered and
doesn't need locale-based routing (`/en/...`) — instead it's a hand-written dictionary, with **TypeScript
enforcing translation quality**:

```mermaid
flowchart LR
    Types["i18n/types.ts<br/>interface Messages (the shared key set)"] -.implements.-> TH["i18n/th.ts"]
    Types -.implements.-> EN["i18n/en.ts"]
    TH --> Map["i18n/messages.ts<br/>Record&lt;Locale, Messages&gt;"]
    EN --> Map
    Map --> Hooks["i18n/index.ts<br/>useT() / useLocale() (client)<br/>getMessages() (server/store)"]
    Hooks --> Components["Every component"]
    Hooks --> Store["sheetStore actions<br/>(busy/error messages)"]
    Map --> Route["/api/ai/formula<br/>(imports messages.ts directly,<br/>no Zustand dependency)"]
```

- `th.ts`/`en.ts` must both implement the same `Messages` type — miss even one key's translation and **the
  build fails immediately** (rather than shipping a blank string discovered later in production).
- `messages.ts` (a plain map, no dependency on Zustand or the browser) is kept separate from `index.ts` (which
  has hooks tied to `localeStore`), so the **API route** (server-side code) can import it without pulling in
  `localStorage`/React.
- The AI assistant always understands both languages (the heuristic's keyword list mixes Thai and English in
  one list), but **its reply always follows whatever language the UI is set to** — the client sends the current
  `locale` with every question, and the app picks the matching Claude system prompt or heuristic explanation
  for that language.
- The demo seed data shown on first load stays in Thai (the app's default locale) — **deliberately not**
  regenerated when the language is switched, since that would risk silently overwriting a user's real data.

---

## 🔐 Security — what was actually tested

This section exists because it is the line between "I asked an AI for an app" and building software.
Code that looks right and runs is not the same as code that is safe, and the only way to find out is
to attack it.

### The limits were written down first, then attacked

`SECURITY.md` recorded three holes in the live-data API as "accepted risks", which was too comfortable
an admission. All three were closed ([`b6438ba`](https://github.com/SuruchBoss/ExcelToGo/commit/b6438ba)),
then the pentest was run again — **against a running server, not by reading the code.**

### The second pass found a real one: an SSRF bypass the whole suite missed

The fetcher skips its SSRF guard for URLs pointing back at the app's own origin, and decided "points at
us" with `url.startsWith("/")`. But `//169.254.169.254/`, `/\169.254.169.254/` and `//evil.example/`
all start with a slash too, and `new URL(url, origin)` resolves them to a foreign host — **so the guard
was skipped for exactly the addresses it exists to block.**

Proven on a running server before fixing: `//169.254.169.254/` returned an HTTP response instead of a
refusal, and `//127.0.0.1:3000/api/sources` came back `401` from the app's own admin API — meaning the
server had connected to a loopback address the guard is meant to refuse. On a cloud host the first of
those is the **instance metadata endpoint**.

Closed in two layers: `executeSource` decides "same origin" from the *resolved* origin rather than a
leading slash, and `validate.ts` refuses a path whose second character is a slash or backslash before it
ever reaches the fetcher
([`8b92a7e`](https://github.com/SuruchBoss/ExcelToGo/commit/8b92a7e)).

**Confirmed by reverting** — all four cases fail on the old code and pass on the new. The tests were not
written to agree with whatever the code already did.

### 123 security tests

| File | Tests | What it covers |
|---|---|---|
| `urlGuard.test.ts` | 21 | Loopback, private ranges, cloud metadata, every IPv4-in-IPv6 spelling, link-local, multicast, non-http(s) schemes, hosts that don't resolve |
| `executeSource.test.ts` | 31 | Re-checking after a redirect, cutting redirect loops, the same-origin fast path, pagination, row bounds |
| `secretBox.test.ts` | 10 | AES-256-GCM, distinct ciphertexts, tamper detection, refusing to encrypt with no key rather than storing plain text |
| `rateLimiter.test.ts` | 10 | Refusing past the limit, per-key counting, a `Retry-After` that really shrinks, a bounded key map under a flood of forged addresses |
| `sourcesAuth.test.ts` | 9 | No token set means every request is refused, a blank token counts as unset, a token that is merely a prefix does not pass |
| `validate.test.ts` | 4 | Which URL shapes are accepted, and which paths must be refused |
| `ai/formula/route.test.ts` | 6 | Demo mode must not reach Anthropic **even with an API key configured**, the local fallback still answers (not a 403), a missing question is a 400 |
| `byok.test.ts` | 12 | The visitor's own key: which shapes are accepted, masking (enough to recognise, not enough to reuse), gone when the tab closes, blocked storage must not break the panel |

Run them on their own: `npx vitest run src/lib/server/ src/app/api/sources/validate.test.ts src/app/api/ai/formula/ src/lib/byok.test.ts`

### OWASP Top 10, only the categories that actually apply here

| Category | What is in place |
|---|---|
| **A01 Broken Access Control** | Every `/api/sources` handler refuses when no token is configured (403) and refuses a wrong one (401) — two distinct states so an operator can tell which happened |
| **A02 Cryptographic Failures** | Source credentials are AES-256-GCM on disk and masked in every API response |
| **A04 Insecure Design** | Live data is **off by default**; it takes an env var to switch on. A public demo refuses every write and reads only three hard-coded sources — the visitor picks an id, never a destination |
| **A05 Security Misconfiguration** | No `SOURCES_ADMIN_TOKEN` means the API is closed, not open with no password |
| **A07 Authentication Failures** | The token is compared in full, not by prefix; accepted as a dedicated header or a bearer token |
| **A10 SSRF** | DNS is resolved and *every* returned address checked; redirects are followed and re-checked here rather than left to `fetch`; origins are compared after resolution |

### Anonymous testing

Every endpoint hit with no token: all six `/api/sources` handlers **fail closed**. `/api/ai/formula` is
the one deliberately open endpoint — the assistant is the app's own feature and requiring a login to use
it would be absurd — so it carries a ceiling of 20 requests per minute per IP with `Retry-After`.

That ceiling stops casual abuse; it does not stop a bill. An endpoint with no auth that can call a
model is the operator's money behind a button anyone can press, so **on a public demo
(`NEXT_PUBLIC_DEMO_MODE=1`) this route never calls Anthropic at all**, even if the host has an
`ANTHROPIC_API_KEY` set — it falls through to the local keyword matcher instead. The feature still
works; what the demo gives up is the model's judgement, not the button. And it is a rule in the code,
not a rule in whoever configured the host's memory.

### Checked by hand but not pinned by a test — the difference matters

Three more things were verified during the pentest and passed, but **have no regression test**, so
nothing would warn you if a future change broke them:

- Metadata addresses written in decimal, octal or hex — the URL parser normalises those to a plain
  address before the guard sees them, so it simply sees `169.254.169.254`
- The `[id]` path segment cannot escape its directory
- An auth-header name containing CRLF is refused by `fetch` itself

### Known limits, deliberately left open

- **The rate-limit counters live in one process's memory.** Two instances count separately and a
  serverless cold start forgets everything — a guard against casual abuse, **not a billing control.**
  A real one needs shared storage, which this project deliberately does not have.
- **CSV injection is neutralised** (this line used to say it wasn't). Measured before it was fixed: a sheet
  holding `+cmd|'/c calc'!A0` and `@SUM(1+1)*cmd|'/c calc'!A0` exported both of them live, while `=1+1` did
  not survive because this app's own engine had already evaluated it — **the dangerous prefixes are exactly
  the three the engine does not treat as a formula**, so "we compute formulas ourselves" was never a
  protection. It has its own security tests in `csvInjection.test.ts` (see
  [CSV in and out](#-csv-in-and-out)).
- **There are no user accounts**, so there is no per-user authorisation to test. `SOURCES_ADMIN_TOKEN`
  is an operator switch, not an account.

## 📈 Lighthouse

Measured against a local production build (`npm run build && npm run start`) with Lighthouse 12 on the
**mobile** preset — 4x CPU slowdown and simulated slow 4G, not a desktop run dressed up as one.

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Landing `/` | 85 | **100** | **100** | **100** |
| App `/app` | 86 | **100** | **100** | **100** |

`/` — FCP 1.3s · LCP 3.8s · TBT 140ms · **CLS 0** · Speed Index 4.1s
`/app` — FCP 1.0s · LCP 3.8s · TBT 200ms · **CLS 0** · Speed Index 1.0s

**Accessibility 100 on both pages**, which agrees with the [`check:a11y`](#-testing) gate that runs axe on
every PR — two different tools, same answer.

**Both of them were also wrong about the grid, and worth saying so.** Lighthouse 100 and axe clean at
four viewport/page combinations, while the sheet was to a screen reader an ordinary data table you
could not drive: no `role="grid"`, no `aria-selected`, no `scope` on the headers, every one of ten
thousand cells its own tab stop, and the browser's focus parked on A1 while `Ctrl+↓` moved the cursor
to A10 in silence. Neither tool was at fault — a `<table>` with `<th>` is a valid table, and they
were grading the thing they were shown. The grid now declares itself: `role="grid"` with
`aria-rowcount`/`aria-colcount`, `aria-rowindex` per row and `aria-colindex` per cell (the only way
"row 2,003 of 5,000" exists at all when forty rows are in the DOM), `scope` on both header
directions, `aria-selected` tracking the range, one roving tab stop instead of one per cell, and DOM
focus that follows the cursor — including the *moving* corner when Shift extends a selection, since
the anchor staying put is how a growing selection goes unannounced.

**Focus only ever announces where the cursor is, though.** Sort a column and the rows reorder under a
cursor that has not moved; paste and forty cells fill in below the fold; filter and half the sheet
disappears. Every one of those was silence. A polite live region now says what happened, with the
numbers that make it useful:

| You do this | It says |
|---|---|
| Sort column C | `Sorted column C ascending` |
| Filter column B | `Filtered column B: 4 of 9 rows shown` |
| Paste a block | `Pasted 3 rows by 2 columns at A1` |
| Select A2:B3 and press Delete | `Cleared A2:B3` |
| Merge, then split | `Merged A17:B17 into one cell` · `Split the merged cells in A17:B17` |
| Import a file | `File imported, 3 sheets` |
| Insert a chart | `Added a bar chart from B1:E10` |
| Change its kind, then delete it | `Changed to a line chart` · `Chart deleted, none left on this sheet` |
| Build a pivot | `Built pivot sheet "Pivot 1", 11 rows by 3 columns, and opened it` |
| Refresh it after the source moved | `Pivot refreshed from its source, 11 rows by 3 columns` |
| `Ctrl+Z` | `Undone` |

Charts and pivots earn their place here more than anything else on the list. A chart is drawn *over*
the grid rather than in it, so nothing a screen reader walks would ever mention that one had
appeared, changed shape or gone; and building a pivot creates a sheet that did not exist and
switches to it, which is the largest jump the app makes without the user navigating.

**A wrong number nearly shipped in that pivot message.** The first version read the dimensions off
the sheet the pivot is written onto — and that sheet is a blank 30×10 canvas with the result in its
corner, so an eleven-row summary announced itself as "30 rows by 10 columns". Caught by reading the
sentence the browser actually produced rather than trusting that the fields were named what they
sounded like. `renderPivotSheet` now returns the block's real size alongside the sheet.

Two regions, alternating on a sequence number, because a screen reader announces a live region when
its text **changes** — sorting the same column twice writes identical words, and one node would say
it once. Measured: the same sort three times in a row moves the text B → A → B.

Moving the cursor deliberately says nothing. Focus already announces the cell, and a grid that
repeats itself is worse than one that stays quiet. Verified the same way — arrows, `Ctrl+↓`,
`PageDown` and `Shift+↓` in sequence leave both regions untouched.

Two things are left out on purpose, and each is a decision rather than a gap. **Live data** re-polls
every few seconds, and a region that announces itself every five seconds is not an accessibility
feature, it is a fault. **The pie-series picker** is a native `<select>` whose options carry the
series names, and a select announces its own choice — a live region on top of that is the same
double-talk that keeps cursor movement out. Both omissions have a test of their own, so that "it
says nothing" cannot later be mistaken for "nobody got round to it".

**None of this has been heard by a real screen reader.** What is verified is that the right text
reaches the right region at the right moment, in both languages.

**Performance is not 90, and the only thing Lighthouse flags is `unused-javascript`, ~59KB (~300ms)** —
mostly Next's own framework chunks that aren't needed for the first frame. Going further means cutting into
the framework bundle itself, which isn't a trade worth making here. Written down rather than rounded up.

> These are localhost numbers, not Vercel's. The deployed site has a CDN and compression and should do
> better, but I can't verify that from here, so only what was actually measured is reported.

## 🧪 Testing

```bash
npm test      # 948 cases across 57 files, via Vitest
```

Testing is focused on the **formula engine, sort logic, JSON-to-table conversion, pagination, rate-limit backoff, Excel templates and live-block placement** — pure functions with no React/DOM dependency, so
they run fast and give high confidence.

**But not one of those 948 cases opens the app**, and nearly every bug this project found by hand lived in
the wiring *between* pieces that all passed their tests — the toolbar's "+ row" called `addRow`, which
announced nothing, while `insertRowAtSelection` next to it announced correctly (both tested) · the AI
assistant sent a range including its text header, because the context builder read raw `sheet.cells`
instead of computed values (both tested) · one new button pushed the language toggle 42px off the screen.

```bash
npm run check:e2e   # 5 flows in a real browser (needs a build)
```

Flows are picked by one rule: **would a unit test already catch it?** If yes it does not belong there. What
is left is the seams — type a formula and watch the value move on screen · export `.xlsx` through the real
button and import that file back through the real input, then check that the formula is still a formula and
the Thai is still Thai · walk the grid on the keyboard alone and watch focus follow the cursor · undo · and
whether a change away from the cursor is announced at all. Every flow also fails on an uncaught page error,
because a flow that passes every assertion while the console fills with exceptions React swallowed has not
passed.

### The tests with no formulas written in them

The other engine tests say *this formula gives this value*. They were written by the same person who
wrote the engine, from the same understanding of it — so they share its blind spots. A precedence bug
survives an example suite by being consistently wrong in the test and in the code. `property.test.ts`
names no formula at all: each test states something that must hold for *every* formula, then throws
thousands of generated ones at it.

The generator and the shrinker are about 80 hand-written lines rather than fast-check, for the same
reason the engine has no formula library. Every run is seeded and prints its seed on failure, so
`SEED=12345 npx vitest run property` replays it exactly.

**It found two real gaps on the first run — both in ground the engine's 147 example tests never covered:**

| What it found | What is actually true |
|---|---|
| `IF(TRUE(),1,2)` was a syntax error | Excel accepts `TRUE` and `TRUE()` alike; this engine accepted only the first. The generator writes `TRUE()` because Excel takes it — no example test ever had |
| `SUM(A1:A3)` over 1, TRUE, 2 gave 4 | Excel gives 3: a logical value in a *cell* is ignored, while one passed as an argument still counts. A number that is one too high looks exactly like a number that is right |

Both are fixed and pinned by example tests. **And the properties themselves were proved by breaking
things**: make `a-b-c` parse as `a-(b-c)` — destroying left-associativity — and the property fails at
once, while **all 147 of the engine's example tests still pass**. That is the entire argument for this file, in one
measurement.

**Each gate was proved by breaking it first** — take `say(...)` out of `addRow` and the fifth flow fails at
once; disable `ArrowRight` in the grid and two assertions in the third fail. (The first attempt at that
second one stayed green: the `case` I inserted landed *after* the existing `case "ArrowRight"` and was dead
code. Proving a gate means checking that the thing you meant to break actually broke.)

> **948 tests passed, and 43% of the assistant's answers were unusable** — because those tests mock
> the model, so it returns what the test author imagined. A test count says what you thought to ask,
> not whether you asked enough. Only a real API key found this: see
> [What 948 passing tests could not catch](#-what-948-passing-tests-could-not-catch), repeatable
> with `npm run check:ai`.

| File | Cases | Tests |
|---|---|---|
| `tokenizer.test.ts` | 8 | Literals, cell/range refs (including absolute `$`), operators, string escaping, the `#REF!` token |
| `property.test.ts` | 8 | Property-based: each test generates hundreds of formulas and checks a rule that must always hold — arithmetic against an oracle sharing no engine code, precedence on expressions with no parentheses at all, evaluation never throwing, a zero shift being identity, two shifts equalling the shift of their sum, insert-then-delete of a row leaving every reference where it was, and SUM against adding the cells by hand |
| `csvInjection.test.ts` | 11 | CSV injection from the attacker's side: every DDE payload has to leave unable to run, from the export button and from the crash rescue alike · negative numbers, Thai text and blanks must be untouched · export-then-import returns the original however many times it goes round |
| `crashRescue.test.ts` | 19 | Rescuing the sheet out of every broken shape localStorage can hold (no key, unparseable JSON, wrong types) without throwing, filenames Windows accepts, and the storage key matching what the store actually writes |
| `parser.test.ts` | 20 | Operator precedence/associativity, ranges, function calls, syntax errors, arguments left out mid-call |
| `evaluator.test.ts` | 10 | Arithmetic, comparisons, concatenation, reading cells/ranges, error propagation |
| `functions.test.ts` | 81 | The whole function library across aggregate/rounding/logic/text/lookup, including INDEX/MATCH (leftward lookups, whole rows/columns, unsorted data), SUMIFS (several conditions, mismatched ranges), XLOOKUP (leftward lookups, a not-found fallback, nearest match on unsorted data, searching from the end) and DATEDIF (all six units, the month borrow, dates that don't exist) — plus dates that must not shift across timezones |
| `formulaCatalog.test.ts` | 12 | What the palette actually builds: criteria quoting, a half-filled second condition, and every formula having text in both languages |
| `shift.test.ts` | 8 | Relative reference shifting on copy/paste; absolute references staying put |
| `structuralShift.test.ts` | 15 | Reference adjustment on row/column insert/delete, including `#REF!` and range grow/shrink |
| `sheetSort.test.ts` | 7 | The bounds/header-detection heuristic, and sorting itself (blank values, limited column scope) |
| `jsonToTable.test.ts` | 10 | Finding the record array in a response, flattening nested objects, numeric-column detection, single-row KPI objects |
| `paginate.test.ts` | 19 | Detecting the next page from a Link header / next field / cursor / a URL param, stopping on an explicit null, refusing non-link values |
| `executeSource.test.ts` | 28 | The real fetch loop (stubbed fetch): row limits, the 20-page ceiling, loop guards, a failing mid-chain page, column union across pages, auth header on every page, a mid-chain 429, and the SSRF guard on the path that actually fetches (including a redirect to a private address) |
| `rateLimit.test.ts` | 20 | Parsing `Retry-After` (seconds and HTTP-date) and every `X-RateLimit-Reset` shape, separating a quota-exhausted 403 from a plain one, backoff maths |
| `sheetMerges.test.ts` | 15 | Which cells a merge swallows, shifting merges on row/column insert and delete, dropping one that collapses to a single cell |
| `sheetTemplate.test.ts` | 14 | Which cells are locked vs. fields, inline and range-backed dropdown options, column-width conversion |
| `excelIO.test.ts` | 32 | Builds a real .xlsx and round-trips it: reading fields/dropdowns/widths, an unprotected file isn't a template, export→import comes back identical, and styling (fills/font sizes/borders/row heights/merges) round-trips, as do all five kinds of conditional formatting rule and cell notes (both the plain-string and Excel's rich-text form) |
| `charts.test.ts` | 42 | Reading a range into series and labels (including a text label column), gaps for non-numbers, a zero-anchored axis, moving/resizing/clamping a chart's frame, what the legend names per kind, shifting on edits |
| `server/urlGuard.test.ts` | 21 | Addresses the server refuses to reach (loopback, private ranges, cloud metadata, IPv6 link-local), IPv4 embedded in IPv6 in every spelling, non-http schemes, and the allowlist |
| `server/sourcesAuth.test.ts` | 9 | No token means off, right/wrong/prefix tokens, and telling "switched off" apart from "wrong token" |
| `server/secretBox.test.ts` | 10 | Encrypting and decrypting a credential, non-repeating ciphertext, tamper detection, refusing with no key, and reading pre-existing plaintext |
| `cloud/cloud.test.ts` | 15 | On/off from the environment (a half-set deployment included), the stored shape and its JSON round trip, refusing a workbook from a newer version, and spotting another device's save |
| `pdfFont.test.ts` | 5 | Embedding the Thai font, fetching it once per page, and falling back to the built-in font rather than failing the export |
| `cellComments.test.ts` | 17 | Writing and clearing a note, trimming, following an insert/delete, and a note going with the row it was written about |
| `gridGeometry.test.ts` | 18 | Pixel positions of rows and columns (including widths/heights from an import), filtered-out rows taking no height, where a new chart lands and how it steps clear of one already there, anchor↔pixel round trips |
| `chartGeometry.test.ts` | 14 | The shapes a bar/line/pie is made of: bars inside the plot and scaled to their value, a line broken at a gap, a pie following the chosen series, labels thinning out when the room runs out |
| `chartImage.test.ts` | 10 | The exported picture: a complete SVG document, the legend carried into it, XML escaping, and null when there is nothing to draw |
| `conditionalFormat.test.ts` | 33 | Compare/text/rank rules (ties included), colour scales (including an all-equal range), data bars (including negatives), stacked rules, range shifting on insert/delete |
| `liveBlocks.test.ts` | 15 | Writing/clearing a live block, shrinking extents, sum/avg/count, which value options are offered, region-occupied checks |

CI: `npm run verify` bundles it — `lint` → `check:readme` → `test` → `build` (the build also type-checks the
whole project, including the two languages' `Messages` parity). **It has to be green before every push**; the
full rule lives in `AGENTS.md`.

**GitHub Actions** (`.github/workflows/ci.yml`) runs those same five gates on every push and pull request,
across **Node 20.19, 22.12 and 24** — the first two being both floors `engines` declares, so the claim is
tested rather than asserted. They run as separate steps so the run summary names the gate that failed instead
of showing one opaque red cross.

Testing the real floor caught the same class of bug twice, and both times it was "the documented minimum
doesn't actually work": first `check:readme` died on `import.meta.dirname` (Node 20.11+), then `npm test` died
instantly because Vite 7 is ESM-only and needs `require(esm)`, which exists only from 20.19/22.12. This
project's true floor comes from Vite, not Next — which is only knowable by running CI on it.

---

## 🔭 What's next

What's not done yet, and why — to show this is a known gap, not something forgotten:

- [x] **Automated CI (GitHub Actions)** — done: lint → check:readme → test → build on every push and PR,
      across Node 20.19, 22.12 and 24
- [x] **Cloud save / cross-device sync** — done as **bring-your-own-backend** (see ✨ Features):
      point it at your own Supabase project. Off by default, because this is an open-source project
      rather than a hosted service. Still open: automatic sync, simultaneous editing, version
      history, and sharing a workbook with someone else
- [x] **Charts/graphs** — done (see ✨ Features): bar, line and pie drawn from a range and following
      the live values, placed on the grid, dragged and resized there, anchored to a cell, and carried
      into both the `.xlsx` and the PDF. **A chart in the `.xlsx` is now a real, editable chart** —
      the OOXML chart parts are written by hand and spliced into what ExcelJS produces. Still open:
      charts in the PDF are still pictures (jsPDF has no chart primitive), and a pie draws one
      series at a time
- [x] **Pivot tables** — done (see ✨ Features): group by several columns, fan one field out across
      the top, summarise with sum/count/average/min/max, and get an ordinary sheet back that can be
      sorted, charted and exported. **A summary sheet now remembers its source** and offers a
      Refresh button once the numbers behind it move. Still open: refreshing is manual, one column
      field at a time, and no filters of its own
- [x] **A ceiling on `/api/ai/formula`** — done: 20 calls a minute per address, refused with `429`
      and a `Retry-After`. Still open: the counters are per process, so this guards against casual
      abuse rather than acting as a billing control across instances
- [x] **Formulas across sheets** — done (see [formulas across sheets](#-formulas-across-sheets)):
      `=Sheet2!A1`, Thai names unquoted, cross-sheet staleness that follows a chain rather than one
      link, and cycles that span sheets. **This line used to say "`.xlsx` export writes computed
      values, so a round trip loses the formula", and that was not true** — the writer has been
      sending `{ formula, result }` for a long time, and plain formulas, cross-sheet references and
      `$A$1` all come back intact. A limitation nobody re-checks outlives the bug it described, so
      the claim is pinned by tests now instead of by memory: make the writer emit numbers instead
      of formulas and four of them fail immediately.
- [x] **The fill handle** — done (see [the fill handle](#️-the-fill-handle)): numbers, Thai days and
      months, quarters, `Item 08`, and formulas whose references move. Still open: dragging *inwards*
      to clear, and Excel's right-drag menu of fill options.
- [x] **Find and replace** — done (see [find and replace](#-find-and-replace)). Still open: searching
      the displayed value as well as the raw text, and regular expressions.
- [ ] **Freezing panes** beyond the already-sticky header row/column
- [x] **Conditional formatting** — done (see ✨ Features): compare/text/rank/colour scale/data bar,
      written into and read back from `.xlsx`. Still open: icon sets and custom-formula rules
- [x] **Cell comments** — done (see ✨ Features): a note per cell with an amber corner, following
      edits to the sheet, and exported as a real Excel note. Still open: an author and timestamp,
      and threaded replies
- [x] **`INDEX`/`MATCH`, `SUMIFS`, `COUNTIFS`, `AVERAGEIFS` and wildcards in criteria** — done
      (see Supported functions): lookups that read leftwards, and counting/summing/averaging on
      several conditions at once
- [x] **`XLOOKUP` and `DATEDIF`** — done (see Supported functions): a lookup whose key column
      needn't be leftmost, matching exactly by default and taking its own not-found value, plus date
      gaps in all six units (which turned up a bug where `DAY`/`MONTH`/`YEAR` were a day out west of
      UTC)
- [x] **Mobile/tablet support** — done (see ✨ Features): the panel opens over the screen, the
      toolbar folds to icons, a second tap edits a cell, 44px targets, and a range is dragged out
      with a finger from a grip on the selection's corner (which scrolls the sheet to meet it)
- [x] **Accessibility checks in CI** — done: `npm run check:a11y` runs axe (WCAG 2.0/2.1/2.2 A+AA) on both
      pages at 390px and 1280px and checks for sideways scroll at five widths, as its own CI job. **Two
      widths is the whole point** — the previous audit ran at desktop width only and reported zero
      violations while eight buttons below 640px had no accessible name. **It now also opens things before
      checking them** — the shortcut dialog passed every load-time scan while containing two serious
      violations, because it does not exist until you press a button; a state that cannot be opened fails
      the gate rather than being skipped. Still open: the other panels, menus and popovers are not in that
      list yet.
- [x] **Property-based testing for the engine** — done: `property.test.ts` names no formula at all,
      only rules that must hold for every formula, checked against thousands of generated ones with a
      hand-written generator and shrinker and a replayable seed. It found two real gaps on its first run
      (`TRUE()` failing to parse, `SUM` counting logical values sitting in cells), both now fixed. Still
      open: no property covers the `.xlsx` round trip, and the cross-sheet resolver is not generated against.
- [x] **Tests that actually open the app (E2E) in CI** — done: `npm run check:e2e` drives Chromium
      through 5 flows as its own CI job — a formula recalculating on screen, an `.xlsx` round trip through
      the real buttons, keyboard-only navigation, undo, and whether anything is announced. Three bugs this
      project previously found by hand are now inside the gate's reach, and each gate was proved by breaking
      it. Still open: the AI panel (it needs the model mocked), charts, pivots and touch drag-select.
- [x] **The grid speaks the ARIA grid pattern** — done: `role="grid"`, row/column counts and per-cell
      indices that survive virtualization, `scope` on both header directions, `aria-selected`, one
      roving tab stop, and focus that follows the cursor. Found by using the app with the keyboard,
      not by any gate — axe passed all four runs while it was still an undriveable table. Still open:
      none of it is verified against a real screen reader.
- [x] **A spoken summary of what happens away from the cursor** — done: a polite live region says what a
      sort, filter, paste, clear, merge, insert, import or undo just did, with the numbers (`Filtered
      column B: 4 of 9 rows shown`), including charts appearing, changing kind and going, and a pivot
      being built or refreshed with its real size. Two regions alternating, because a screen reader
      announces on text *change* and sorting the same column twice writes the same words. Moving the
      cursor stays silent — focus already announces the cell, and saying it twice is worse than not
      saying it. Deliberately silent, each with a test saying so: live data, which re-polls on a timer,
      and the pie-series picker, which is a native select that announces itself. Still open: as above,
      no real screen reader has heard any of it.
- [x] **A keyboard-shortcut reference in the app** — done (see [the Excel keyboard](#️-the-excel-keyboard)):
      `Ctrl`/`Cmd`+`/` or `F1`, or the button at the end of the sheet-tab strip. The list is kept honest by
      a test that reads the handlers' source, so a key cannot be added, renamed or removed without the sheet
      failing. Still open: it covers the grid and the global handlers, not the keys inside individual panels.
- [x] **Direct CSV import/export** — done (see ✨ Features): the delimiter is sniffed (`,`, `;`, tab), the BOM
      is stripped on the way in and written on the way out so Excel reads Thai, quoting follows RFC 4180, and
      the export carries computed values, **and CSV injection is neutralised** without touching negative
      numbers or changing this app's own round trip. Still open: non-UTF-8 files.
- [x] **Merge cells** — done (see ✨ Features): one button for merge and split, overlapping merges are
      absorbed, it asks first only when data would be lost, and the export carries real `<mergeCell>`
      elements. Still open: vertical centring, and freezing beyond the already-sticky headers.

- [x] **Template support for imported files** — done (see ✨ Features): cell locking, dropdowns and column
      widths are read from a protected file, every route into the structure is guarded, and export puts the
      template back together
- [x] **Imported files keep their look** — done: fills, font sizes, borders, row heights and merged cells.
      Still open: images/charts, and authoring a template in-app
- [x] **Live data from REST API / CSV** — done (prototype, see ✨ Features), polling-based refresh
- [x] **Following paginated APIs** — done: auto-detected from a Link header / next field / cursor / a param
      already in the URL, and the user is told when the data came back incomplete
- [x] **Rate limits explained to the user** — done: reads `Retry-After`/`X-RateLimit-Reset`, genuinely stops
      polling for the duration, exponential backoff for ordinary failures, shown in plain language with a
      live countdown
- [x] **Recalculate only what changed, and stop rendering rows nobody can see** — done (see
      [the formula engine](#-formula-engine)): an AST cache plus a dependency graph read off the
      syntax tree takes one edit in a 3,000-row sheet from **1,244.9 ms to 3.6 ms**, and a
      5,000-row sheet keeps 41 `<tr>` in the DOM. Still open: editing the cell a whole column of
      running totals reads still costs around 1,000–1,200 ms (a real fan-out, not a cache miss), and columns
      are not windowed, only rows.
- [x] **Full Excel keyboard coverage** — done (see [the Excel keyboard](#️-the-excel-keyboard)):
      `Ctrl+arrow` to the edge of the data, `Shift+arrow` to drag the selection, both together for
      each at once, `Home`/`End`/`Ctrl+Home`/`Ctrl+End`, Page keys measured in pixels, the two-step
      `Ctrl+A`, and the view following the cursor in both axes. Still open: `Ctrl+Space` /
      `Shift+Space` for a whole column or row, and `Ctrl+Enter` to fill a selection at once.
- [ ] **Database sources** (Postgres/MySQL) — next phase: tech picks a table / saves a query once, users never see SQL
- [ ] **Push-based realtime (SSE/WebSocket)** instead of polling, and filtering live data from the UI before placing it

**Deliberately out of scope:**

- **Real-time multi-user collaboration** — would need a backend + WebSocket, which conflicts with the intended
  design of a personal, browser-only tool with no backend at all.
- **Using an off-the-shelf formula library** — the engine is hand-written on purpose to keep full control over
  its behavior (see [Formula engine](#-formula-engine)), even at the cost of fewer built-in functions than a
  library like HyperFormula would offer.

---

## 👤 Author

Built by **Suruch Boss**

- GitHub — [github.com/SuruchBoss](https://github.com/SuruchBoss)
- LinkedIn — [linkedin.com/in/suruchboss](https://www.linkedin.com/in/suruchboss)

If this project is useful to you, or you'd like to talk about work, do get in touch.

---

## 📄 License

Released under the [Apache License 2.0](LICENSE) — free to use, modify and use commercially.

What the licence asks in return: if you redistribute it (a deployed fork counts), include a copy of
the licence, state which files you changed, and **carry the [`NOTICE`](NOTICE) file with its
upstream credit**, per section 4(d). That last mechanism is why Apache-2.0 was chosen over MIT,
which has no equivalent.

`"private": true` stays in `package.json` on purpose — it prevents an accidental `npm publish` of
an application and says nothing about whether the source is open.
