# 📊 ExcelToGo — Turn an Excel Sheet into an Easy-to-Fill UI

**Language:** [ไทย](README.md) · English

> Excel on desktop or online is hard to fill in, the UI isn't friendly, you can't remember formulas, and
> scrolling around a big sheet leaves you lost about which row/column you're on — this project fixes exactly
> that: a spreadsheet-style grid with **drag-and-drop formulas** instead of memorizing syntax, an **AI assistant**
> that suggests formulas from a plain-language question, and a **hand-written formula engine** (no third-party
> library) covering the Excel features people actually use day to day.
>
> Three things build on that: **[live data from an API/CSV](#-live-data-from-an-api--csv-prototype)** that keeps
> cells current on its own (following paginated APIs and backing off when rate-limited),
> **[imported files keeping their look](#-it-looks-like-the-file-you-opened)** (colour bands, large type,
> borders, merged cells), and **[templates read straight out of an Excel file](#-templates-from-an-excel-file)**
> that already know which cells are yours to fill in.

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Zustand" src="https://img.shields.io/badge/Zustand-5-443E38">
  <img alt="Vitest" src="https://img.shields.io/badge/tests-283%20passing-2F9E44?logo=vitest&logoColor=white">
  <img alt="CI" src="https://github.com/SuruchBoss/ExcelToGo/actions/workflows/ci.yml/badge.svg">
</p>

A Next.js web app that turns an Excel-style grid into a friendlier UI: drag-and-drop ready-made formulas instead
of memorizing syntax, an AI assistant that suggests formulas from a natural-language question (Thai or English),
and a hand-written formula engine (tokenizer → parser → evaluator, no third-party formula library) supporting
cell/range references, relative & structural reference adjustment, circular-reference detection, multi-sheet
workbooks, conditional formatting that re-colours cells from their current values, and full-fidelity Excel/PDF
export. Bilingual UI (Thai/English), 283 automated tests.

---

## 📸 Screenshots

<p align="center"><b>Main screen</b> — the data grid with the drag-and-drop formula panel on the right</p>
<p align="center"><img src="public/screenshots/01-overview.png" width="820"></p>

<table>
<tr>
<td width="50%" align="center"><b>Formula parameter panel</b><br><sub>Pick range C2:C4 straight from the grid instead of typing the address</sub><br><br>
<img src="public/screenshots/02-formula-panel.png" width="380"></td>
<td width="50%" align="center"><b>Result after inserting</b><br><sub>SUM(C2:C4) computes to 100 the moment you confirm</sub><br><br>
<img src="public/screenshots/03-after-insert.png" width="380"></td>
</tr>
<tr>
<td width="50%" align="center"><b>AI formula assistant</b><br><sub>Ask in a plain-language sentence, get a formula back with an explanation</sub><br><br>
<img src="public/screenshots/04-ai-assistant.png" width="380"></td>
<td width="50%" align="center"><b>Multiple sheets in one file</b><br><sub>Switch, add, or rename sheets from the tab bar</sub><br><br>
<img src="public/screenshots/05-sheet-tabs.png" width="380"></td>
</tr>
</table>

<p align="center"><b>Cell formatting + column filters</b> — bold, number formats (currency), and per-column checkbox filters</p>
<p align="center"><img src="public/screenshots/06-format-filter.png" width="820"></p>

<p align="center"><b>Switch languages in one click</b> — menus, buttons, formula names/descriptions, and AI replies all update instantly</p>
<p align="center"><img src="public/screenshots/07-english-ui.png" width="820"></p>

<p align="center"><b>Live data from an API / CSV</b> — select a cell, click "Insert into sheet", then choose the
whole table or a single summary number, seeing the real values before deciding</p>

<table>
<tr>
<td width="50%" align="center"><b>Whole table</b><br><sub>Full-width preview, stating the rows × columns it will use</sub><br><br>
<img src="public/screenshots/10-picker-table.png" width="380"></td>
<td width="50%" align="center"><b>A single summary number</b><br><sub>Cards show the actual value, e.g. <code>9,510 · Sum of total</code> — no guessing what "sum" returns</sub><br><br>
<img src="public/screenshots/12-picker-values.png" width="380"></td>
</tr>
</table>

<p align="center"><b>Click a live block and its toolbar appears right beside it</b> — refresh / change / remove,
with no trip back to the side panel. A block on the very first row leaves no space above, so the toolbar goes
underneath rather than covering the column headers.</p>
<p align="center"><img src="public/screenshots/11-block-toolbar.png" width="820"></p>

---

## 📋 Table of Contents

- [Screenshots](#-screenshots)
- [Why this project](#-why-this-project)
- [Getting started](#-getting-started)
- [Features](#-features)
  - [Spreadsheet grid](#-spreadsheet-grid)
  - [Autosave + Undo/Redo](#-autosave--undoredo)
  - [Copy / Cut / Paste](#️-copy--cut--paste)
  - [Cell formatting](#-cell-formatting)
  - [Conditional formatting](#-conditional-formatting)
  - [Insert/delete rows & columns](#-insertdelete-rows--columns)
  - [Sort and filter](#-sort-and-filter)
  - [Multiple sheets in one file](#-multiple-sheets-in-one-file)
  - [Import an existing Excel file](#-import-an-existing-excel-file)
  - [Drag-and-drop formulas](#-drag-and-drop-formulas)
  - [Ask AI for a formula](#-ask-ai-for-a-formula)
  - [Export](#-export)
  - [Live data from an API / CSV (prototype)](#-live-data-from-an-api--csv-prototype)
  - [It looks like the file you opened](#-it-looks-like-the-file-you-opened)
  - [Templates from an Excel file](#-templates-from-an-excel-file)
  - [A landing page that explains the app](#-a-landing-page-that-explains-the-app)
  - [Bilingual (Thai / English)](#-bilingual-thai--english)
- [Tech stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project structure](#-project-structure)
- [Formula engine](#-formula-engine)
- [Bilingual UI (i18n)](#-bilingual-ui-i18n)
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
| `npm test` | Run the 283-case Vitest suite |
| `npm run check:readme` | Check the READMEs still match the code (links/images/test count/new modules/both languages) |
| `npm run verify` | Everything, before a push: lint → check:readme → test → build |

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

- **[Vercel](https://vercel.com)** (recommended, easiest): connect this repo to Vercel and deploy — no setup
  needed. For real AI, add an `ANTHROPIC_API_KEY` environment variable under Project Settings → Environment
  Variables.
- Self-host with Docker/any Node server: `npm run build` then `npm run start`.

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

### ✂️ Copy / Cut / Paste

- **Ctrl+C / Ctrl+X / Ctrl+V** with a dashed highlight showing status (blue = copied, orange = cut).
- Pasting a copied formula adjusts relative references automatically, just like Excel.
- Paste text from elsewhere too (e.g. real Excel or Google Sheets) — splits into columns/rows by tabs/newlines
  automatically, and grows the sheet if the pasted block is bigger than the current table.

### 🎨 Cell formatting

Bold, text alignment (left/center/right), text color, number format (general / 2 decimal places / percent /
currency ฿) — travels with the cell on copy/paste and survives Excel export too.

The formatting row **folds away** (the brush button at the end of the formula bar). On a 1366×768 laptop the
three stacked bars ate 150px before a single grid row appeared; folded, that's 107px.

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

### ➕ Insert/delete rows & columns

Right-click a row/column header to insert or delete. The app **automatically rewrites every formula in the
sheet to reference the new correct positions**; a formula that referenced the exact row/column that got deleted
turns into `#REF!`, exactly like Excel.

### 🔤 Sort and filter

- **Sort** (A-Z/Z-A): selecting a single cell auto-detects the surrounding table bounds, and skips the header
  row automatically if it detects text sitting above numeric data.
- **Filter**: the funnel icon on each column header lets you check/uncheck which values to show, hiding rows instantly.

### 📑 Multiple sheets in one file

Switch/add/rename/delete sheets from the tab bar below the grid. Each sheet has independent data, formulas, and
formatting, but **undo/redo and autosave cover every sheet together**.

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

### 🤖 Ask AI for a formula

Type what you want as a plain sentence, in Thai or English — e.g. _"I want to total all sales in this column."_
The app sends your question plus the currently selected range to the AI and gets back a suggested formula with
a short explanation. One click inserts it into the selected cell.

### 📤 Export

- **Excel**: a single `.xlsx` with **every sheet** included — original formulas, formatting (fills, font sizes,
  borders, row heights, column widths, merged cells) and a template's locking all intact, so it opens in
  Excel/Google Sheets as the file it was rather than as computed numbers.
- **PDF**: the currently open sheet only, showing computed values with row/column headers — good for printing
  or sharing read-only.

### 🔌 Live data from an API / CSV (prototype)

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

### 🌐 Bilingual (Thai / English)

Click **EN**/**ไทย** in the top-right corner to switch the entire UI instantly — menus, buttons, all 25 formula
names/descriptions, alert text, and AI replies (both the keyword heuristic and real Claude) all follow the
selected language. The choice is remembered per browser. See [Bilingual UI (i18n)](#-bilingual-ui-i18n) for the
architecture behind it.

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
| `@anthropic-ai/sdk` | Connects to the Claude API for the AI assistant |
| `lucide-react` | UI icons |
| `clsx` | Conditional className composition |
| `vitest` | Unit tests for the formula engine, sort logic, JSON-to-table conversion, pagination, rate limiting, templates, file fidelity, conditional formatting and live blocks (283 cases) |

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
                              # each with a matching *.test.ts run by Vitest
    formulaCatalog.ts        # The ready-made formula catalog's structure (id/params/how to build it) — the
                              # actual displayed name/description/labels come from src/i18n/th.ts,en.ts
    cellFormat.ts            # Cell formatting (bold/italic/underline/color/fill/font size/borders/alignment/
                              # number format) + pt↔px conversion and to/from Excel numFmt
    aiHeuristic.ts           # Keyword-based formula suggestion logic (used with no ANTHROPIC_API_KEY), bilingual
    sheet.ts                 # The core sheet data model, whole-sheet computation, applying a formula by scope,
                              # inserting/deleting rows-columns
    sheetClipboard.ts        # Copy/cut/paste, converting to/from TSV (for cross-app pasting)
    sheetSort.ts             # Detecting the range to sort + the actual sort
    sheetMerges.ts           # Merged cells: which cell renders, which are swallowed, shifting on edits (tested)
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
    pdfExport.ts              # PDF export via jspdf + jspdf-autotable
  types/
    sheet-ui.ts               # Types for the grid's selection state
.github/workflows/
  ci.yml                     # CI: lint → check:readme → test → build on every push/PR, Node 20.19/22.12/24
scripts/
  check-readme.mjs           # Pre-push README check (dependency-free) — see AGENTS.md for the rule
public/
  screenshots/               # Screenshots from the running app — used by both the landing page and this README
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
    Eval -->|"calls"| Fn["functions.ts<br/>45 functions"]
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

The drag-and-drop palette shows only the **28 most commonly used** formulas, but the engine itself supports
**45 functions** — the rest can be typed directly into a cell even with no card in the palette (e.g. `=MID(...)`,
`=YEAR(...)`, `=PROPER(...)`):

| Category | In the palette (28) | Also available by typing |
|---|---|---|
| Math | `SUM` `PRODUCT` `ROUND` `ABS` `SUMIF` `SUMIFS` | `ROUNDUP` `ROUNDDOWN` `SQRT` `POWER` `MOD` `INT` |
| Statistics | `AVERAGE` `COUNT` `COUNTA` `MIN` `MAX` `COUNTIF` `AVERAGEIF` | `COUNTBLANK` |
| Logic | `IF` `IFERROR` `AND` `OR` | `NOT` `IFNA` |
| Text | `CONCATENATE` `UPPER` `LOWER` `TRIM` `LEFT` `RIGHT` | `CONCAT` `MID` `LEN` `PROPER` `TEXT` |
| Date | `TODAY` `NOW` | `DAY` `MONTH` `YEAR` |
| Lookup | `VLOOKUP` `INDEX` `MATCH` | — |

**`INDEX` + `MATCH` replaces `VLOOKUP` and does what it cannot** — `VLOOKUP` can only search the
leftmost column of a table, and hard-codes *which column number* to return, which breaks silently
the moment someone inserts a column:

```
=INDEX(D2:D100,MATCH("Phuket",A2:A100,0))   read column D, searching column A
=INDEX(A2:A100,MATCH(150,C2:C100,0))        search column C, return column A — VLOOKUP cannot look leftwards
```

Giving `INDEX` a row number of 0 hands back the whole column (or 0 for the column, the whole row),
so another function can consume it: `=SUM(INDEX(A1:D6,0,3))`.

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

**Not supported:** wildcards (`*`, `?`) in criteria; `COUNTIFS`/`AVERAGEIFS`; and `MATCH` over a
two-dimensional range — that returns `#N/A` rather than guessing a position inside a block.

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

## 🧪 Testing

```bash
npm test      # 283 cases across 17 files, via Vitest
```

Testing is focused on the **formula engine, sort logic, JSON-to-table conversion, pagination, rate-limit backoff, Excel templates and live-block placement** — pure functions with no React/DOM dependency, so
they run fast and give high confidence. UI/interaction behavior was verified manually with Playwright during
development of each feature (the scripts weren't committed to the repo — they were a temporary verification
tool, not a permanent regression suite).

| File | Cases | Tests |
|---|---|---|
| `tokenizer.test.ts` | 8 | Literals, cell/range refs (including absolute `$`), operators, string escaping, the `#REF!` token |
| `parser.test.ts` | 14 | Operator precedence/associativity, ranges, function calls, syntax errors |
| `evaluator.test.ts` | 10 | Arithmetic, comparisons, concatenation, reading cells/ranges, error propagation |
| `functions.test.ts` | 41 | The whole function library across aggregate/rounding/logic/text/lookup, including INDEX/MATCH (leftward lookups, whole rows/columns, unsorted data) and SUMIFS (several conditions, mismatched ranges) |
| `formulaCatalog.test.ts` | 12 | What the palette actually builds: criteria quoting, a half-filled second condition, and every formula having text in both languages |
| `shift.test.ts` | 8 | Relative reference shifting on copy/paste; absolute references staying put |
| `structuralShift.test.ts` | 15 | Reference adjustment on row/column insert/delete, including `#REF!` and range grow/shrink |
| `sheetSort.test.ts` | 7 | The bounds/header-detection heuristic, and sorting itself (blank values, limited column scope) |
| `jsonToTable.test.ts` | 10 | Finding the record array in a response, flattening nested objects, numeric-column detection, single-row KPI objects |
| `paginate.test.ts` | 19 | Detecting the next page from a Link header / next field / cursor / a URL param, stopping on an explicit null, refusing non-link values |
| `executeSource.test.ts` | 20 | The real fetch loop (stubbed fetch): row limits, the 20-page ceiling, loop guards, a failing mid-chain page, column union across pages, auth header on every page, a mid-chain 429 |
| `rateLimit.test.ts` | 20 | Parsing `Retry-After` (seconds and HTTP-date) and every `X-RateLimit-Reset` shape, separating a quota-exhausted 403 from a plain one, backoff maths |
| `sheetMerges.test.ts` | 15 | Which cells a merge swallows, shifting merges on row/column insert and delete, dropping one that collapses to a single cell |
| `sheetTemplate.test.ts` | 14 | Which cells are locked vs. fields, inline and range-backed dropdown options, column-width conversion |
| `excelIO.test.ts` | 22 | Builds a real .xlsx and round-trips it: reading fields/dropdowns/widths, an unprotected file isn't a template, export→import comes back identical, and styling (fills/font sizes/borders/row heights/merges) round-trips, as do all five kinds of conditional formatting rule |
| `conditionalFormat.test.ts` | 33 | Compare/text/rank rules (ties included), colour scales (including an all-equal range), data bars (including negatives), stacked rules, range shifting on insert/delete |
| `liveBlocks.test.ts` | 15 | Writing/clearing a live block, shrinking extents, sum/avg/count, which value options are offered, region-occupied checks |

CI: `npm run verify` bundles it — `lint` → `check:readme` → `test` → `build` (the build also type-checks the
whole project, including the two languages' `Messages` parity). **It has to be green before every push**; the
full rule lives in `AGENTS.md`.

**GitHub Actions** (`.github/workflows/ci.yml`) runs those same four gates on every push and pull request,
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
- [ ] **Cloud save / cross-device sync** — data currently lives only in one browser's `localStorage`; "Export
  Excel" is the way to move it (no user accounts or server-side database in the current scope)
- [ ] **Charts/graphs** from the sheet's data
- [ ] **Merged cells** and freezing beyond the already-sticky header row/column
- [x] **Conditional formatting** — done (see ✨ Features): compare/text/rank/colour scale/data bar,
      written into and read back from `.xlsx`. Still open: icon sets and custom-formula rules
- [ ] **Cell comments**
- [x] **`INDEX`/`MATCH` and `SUMIFS`** — done (see Supported functions): lookups that can read
      leftwards, and sums on several conditions. Still open: `COUNTIFS`/`AVERAGEIFS`, and
      wildcards (`*`, `?`) in criteria
- [ ] **More functions** such as `XLOOKUP`, `COUNTIFS`/`AVERAGEIFS`, date-difference functions
  (`DATEDIF`, etc.)
- [ ] **Mobile/tablet support** — currently designed primarily for a desktop screen; layout/touch for small
  screens isn't tuned yet
- [ ] **Direct CSV import/export** (currently `.xlsx` only)
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
- [ ] **Database sources** (Postgres/MySQL) — next phase: tech picks a table / saves a query once, users never see SQL
- [ ] **Push-based realtime (SSE/WebSocket)** instead of polling, and filtering live data from the UI before placing it

**Deliberately out of scope:**

- **Real-time multi-user collaboration** — would need a backend + WebSocket, which conflicts with the intended
  design of a personal, browser-only tool with no backend at all.
- **Using an off-the-shelf formula library** — the engine is hand-written on purpose to keep full control over
  its behavior (see [Formula engine](#-formula-engine)), even at the cost of fewer built-in functions than a
  library like HyperFormula would offer.

---

## 📄 License

This project doesn't declare a formal license yet. If you'd like to reuse, modify, or use this code
commercially, please contact the repository owner first.
