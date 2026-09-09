# 📊 ExcelToGo — Turn an Excel Sheet into an Easy-to-Fill UI

**Language:** [ไทย](README.md) · English

> Excel on desktop or online is hard to fill in, the UI isn't friendly, you can't remember formulas, and
> scrolling around a big sheet leaves you lost about which row/column you're on — this project fixes exactly
> that: a spreadsheet-style grid with **drag-and-drop formulas** instead of memorizing syntax, an **AI assistant**
> that suggests formulas from a plain-language question, and a **hand-written formula engine** (no third-party
> library) covering the Excel features people actually use day to day.

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Zustand" src="https://img.shields.io/badge/Zustand-5-443E38">
  <img alt="Vitest" src="https://img.shields.io/badge/tests-78%20passing-2F9E44?logo=vitest&logoColor=white">
</p>

A Next.js web app that turns an Excel-style grid into a friendlier UI: drag-and-drop ready-made formulas instead
of memorizing syntax, an AI assistant that suggests formulas from a natural-language question (Thai or English),
and a hand-written formula engine (tokenizer → parser → evaluator, no third-party formula library) supporting
cell/range references, relative & structural reference adjustment, circular-reference detection, multi-sheet
workbooks, and full-fidelity Excel/PDF export. Bilingual UI (Thai/English), 78 automated tests.

---

## 📸 Screenshots

<p align="center"><b>Main screen</b> — the data grid with the drag-and-drop formula panel on the right</p>
<p align="center"><img src="docs/screenshots/01-overview.png" width="820"></p>

<table>
<tr>
<td width="50%" align="center"><b>Formula parameter panel</b><br><sub>Pick range C2:C4 straight from the grid instead of typing the address</sub><br><br>
<img src="docs/screenshots/02-formula-panel.png" width="380"></td>
<td width="50%" align="center"><b>Result after inserting</b><br><sub>SUM(C2:C4) computes to 100 the moment you confirm</sub><br><br>
<img src="docs/screenshots/03-after-insert.png" width="380"></td>
</tr>
<tr>
<td width="50%" align="center"><b>AI formula assistant</b><br><sub>Ask in a plain-language sentence, get a formula back with an explanation</sub><br><br>
<img src="docs/screenshots/04-ai-assistant.png" width="380"></td>
<td width="50%" align="center"><b>Multiple sheets in one file</b><br><sub>Switch, add, or rename sheets from the tab bar</sub><br><br>
<img src="docs/screenshots/05-sheet-tabs.png" width="380"></td>
</tr>
</table>

<p align="center"><b>Cell formatting + column filters</b> — bold, number formats (currency), and per-column checkbox filters</p>
<p align="center"><img src="docs/screenshots/06-format-filter.png" width="820"></p>

<p align="center"><b>Switch languages in one click</b> — menus, buttons, formula names/descriptions, and AI replies all update instantly</p>
<p align="center"><img src="docs/screenshots/07-english-ui.png" width="820"></p>

---

## 📋 Table of Contents

- [Screenshots](#-screenshots)
- [Why this project](#-why-this-project)
- [Getting started](#-getting-started)
- [Features](#-features)
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

**Requires:** [Node.js](https://nodejs.org) 18.18+ (20 or 22 recommended) and npm

```bash
npm install
npm run dev
```

Open **http://localhost:3000** — you'll see a working sample sheet immediately, no setup required (a small
coffee/bread/milk sales sheet with real formulas, so you can see it working right away).

Other available commands:

| Command | What it does |
|---|---|
| `npm run dev` | Development mode (hot reload) |
| `npm run build` | Build a production bundle |
| `npm run start` | Run the production build (run `npm run build` first) |
| `npm run lint` | Check code quality with ESLint |
| `npm test` | Run the 78-case Vitest suite |

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

Reads every cell's value, plus its **original formulas and formatting**, straight into the grid and recomputes
everything immediately. A multi-sheet file imports as separate tabs.

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

- **Excel**: a single `.xlsx` with **every sheet** included, original formulas and formatting intact (opens and
  keeps working in Excel/Google Sheets).
- **PDF**: the currently open sheet only, showing computed values with row/column headers — good for printing
  or sharing read-only.

### 🔌 Live data from an API / CSV (prototype)

<p align="center"><img src="docs/screenshots/08-live-data.png" width="820"></p>

Split into two roles so the end user touches as little technology as possible:

- **Tech sets it up once** ("Add data source" in the **Data** panel): enter a REST API URL or a CSV/Google
  Sheets link, an auth header if needed, and a refresh interval, then "Test connection". Config and credentials
  live on the server (`data/sources.json`, gitignored) and never reach the user's browser; the server does the
  fetching, so CORS isn't the user's problem.
- **Everyday users** see only a plain-language source name plus a **preview table** — the app converts the
  JSON automatically (finds the largest array of records in the response, flattens nested objects into
  `customer › name` columns) — then **drag "Whole table"** or **drag a single value** (total/average/count of a
  numeric column, or each field of a KPI object) onto a cell.
- Linked cells are tinted green with a status dot, read-only, and **refresh themselves on the source's
  schedule** (polling). Regular formulas (`=A10*2`, `SUM`, `VLOOKUP`) and Excel/PDF export work on live data
  immediately, because the app writes real values into the cells.
- Refreshes **never enter the undo history** (zundo is paused during the write) — one Ctrl+Z undoes the whole
  placed block.
- Two demo sources are seeded so it works out of the box (`/api/demo/sales`, a table whose numbers drift
  every 5s, and `/api/demo/summary`, a KPI-style object).

> Database sources (Postgres/MySQL) are the next phase — the option is visible in the form but disabled for now.

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
| `vitest` | Unit tests for the formula engine and sort logic (78 cases) |

> **Note:** No off-the-shelf formula library (e.g. HyperFormula) is used — the **formula engine is hand-written**
> (tokenizer, parser, evaluator, and functions) to keep full control over its behavior. See
> [Formula engine](#-formula-engine) for details.

### Tooling

- **Node.js 18.18+** (20 or 22 recommended) and npm
- **ESLint 9** (`eslint-config-next`), including React 19-specific rules (`react-hooks/set-state-in-effect`, `react-hooks/refs`)
- **Vitest 3** for unit tests
- No database or separate backend — everything runs in one Next.js app

---

## 🏛 Architecture

### System overview

The app is **entirely client-rendered** (every page is `"use client"`) with exactly one point that touches a
real server: the AI assistant endpoint. All sheet data lives in the browser — there's no server-side database.

```mermaid
flowchart LR
    subgraph browser["User's browser"]
        UI["Web page (React, client components only)"]
        Store["Zustand stores<br/>sheetStore + localeStore"]
        LS[("localStorage<br/>sheet data + language")]
        Engine["Formula Engine<br/>all computation happens locally"]
    end

    subgraph server["Next.js Server"]
        API["/api/ai/formula<br/>(the only server-side logic)"]
    end

    Claude[("Claude API")]

    UI <--> Store
    Store <--> LS
    UI --> Engine
    UI -->|"POST question + selection + locale"| API
    API -->|"ANTHROPIC_API_KEY set"| Claude
    API -->|"no key"| Heuristic["local keyword matching (heuristic)"]
    Claude --> API
    Heuristic --> API
    API -->|"formula + explanation"| UI
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
        Full["full state: sheets, activeSheetId,<br/>selectionBySheetId, filtersBySheetId,<br/>pending, clipboard, sidebarMode, busy"]
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
    page.tsx                 # Main page — just assembles components from store state (holds no state itself)
    api/ai/formula/route.ts  # API endpoint suggesting formulas (Claude, or a heuristic fallback)
    api/sources/             # Source CRUD, /test (run without saving), /[id]/data (fetch as a table)
    api/demo/                # Self-drifting demo endpoints so live data can be tried without a real API
  store/
    sheetStore.ts            # Main Zustand store — sheets, activeSheetId, per-sheet selection/filters,
                              # the formula panel being filled in, which sidebar is open, plus every action —
                              # wrapped in persist (autosave) + zundo (undo/redo) covering all sheets together
    localeStore.ts           # Separate Zustand store for the selected UI language (th/en) — persisted the
                              # same way, but not tied to the sheet's undo/redo
  i18n/                      # All UI text, split by language (no off-the-shelf i18n library)
    types.ts                 # The central `Messages` type — TypeScript enforces th.ts/en.ts key parity
    th.ts, en.ts              # The actual text dictionaries (buttons/labels/formula names+descriptions/alerts)
    messages.ts               # Just a plain locale -> Messages map, usable from both client and server (API route)
    index.ts                  # useT()/useLocale() (hooks for components) + getMessages() (used in the store)
  features/
    grid/SpreadsheetGrid.tsx        # The main grid (cell selection/editing, sticky headers, right-click
                                     # insert/delete row-column, hides filtered rows, accepts formula drops)
    grid/useHeaderContextMenu.ts    # Hook: state + open/close for the row/column header right-click menu
    grid/useColumnFilterPopoverState.ts # Hook: state + open/close/toggle for the column filter popover
    grid/useClickAway.ts            # Shared hook: closes a popover/menu on an outside click or scroll
    grid/FormulaBar.tsx             # The formula bar above the grid
    grid/SheetTabs.tsx              # The sheet tab bar below the grid
    grid/ColumnFilterPopover.tsx    # The per-column filter popover
    formulas/FormulaPalette.tsx     # The formula list panel — search/category filter/drag
    formulas/FormulaParamPanel.tsx  # The parameter-entry panel — pick a range from the grid + choose a scope
    ai/AIAssistantPanel.tsx         # The "ask AI" chat panel
    data/DataSourcePanel.tsx        # The "Data" panel: source list + blocks placed in this sheet
    data/SourceCard.tsx             # One source: live status, preview, draggable table card / value chips
    data/SourceSetupDialog.tsx      # Tech-side setup form + "test connection"
    data/useLiveDataPolling.ts      # Root hook: loads sources + polls each on its own interval
    toolbar/Toolbar.tsx             # The top toolbar
    toolbar/FormatBar.tsx           # The cell-formatting bar + sort buttons
    toolbar/LanguageToggle.tsx      # The UI language switch button
  lib/                       # Core domain logic, no React/UI coupling — editable/testable independently
    formulaEngine/           # The hand-written formula engine — tokenizer.ts, parser.ts, ast.ts, evaluator.ts,
                              # functions.ts, coerce.ts, address.ts, shift.ts, structuralShift.ts,
                              # each with a matching *.test.ts run by Vitest
    formulaCatalog.ts        # The ready-made formula catalog's structure (id/params/how to build it) — the
                              # actual displayed name/description/labels come from src/i18n/th.ts,en.ts
    cellFormat.ts            # Cell formatting (bold/color/alignment/number format) + conversion to/from Excel numFmt
    aiHeuristic.ts           # Keyword-based formula suggestion logic (used with no ANTHROPIC_API_KEY), bilingual
    sheet.ts                 # The core sheet data model, whole-sheet computation, applying a formula by scope,
                              # inserting/deleting rows-columns
    sheetClipboard.ts        # Copy/cut/paste, converting to/from TSV (for cross-app pasting)
    sheetSort.ts             # Detecting the range to sort + the actual sort
    liveBlocks.ts            # Writes a source's table into cells, tracks extent to clear shrinking data, sum/avg/count (tested)
    dataSources/             # Types + jsonToTable.ts: turns any JSON/CSV into a table (tested)
    server/                  # Server-only: sourceRepo.ts (config + credentials in data/sources.json),
                              # executeSource.ts (does the actual fetch)
    excelIO.ts                # Importing/exporting a multi-sheet workbook (.xlsx) via exceljs, with cell formatting
    pdfExport.ts              # PDF export via jspdf + jspdf-autotable
  types/
    sheet-ui.ts               # Types for the grid's selection state
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
    Eval -->|"calls"| Fn["functions.ts<br/>42 functions"]
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

The drag-and-drop palette shows only the **25 most commonly used** formulas, but the engine itself supports
**42 functions** — the rest can be typed directly into a cell even with no card in the palette (e.g. `=MID(...)`,
`=YEAR(...)`, `=PROPER(...)`):

| Category | In the palette (25) | Also available by typing |
|---|---|---|
| Math | `SUM` `PRODUCT` `ROUND` `ABS` `SUMIF` | `ROUNDUP` `ROUNDDOWN` `SQRT` `POWER` `MOD` `INT` |
| Statistics | `AVERAGE` `COUNT` `COUNTA` `MIN` `MAX` `COUNTIF` `AVERAGEIF` | `COUNTBLANK` |
| Logic | `IF` `IFERROR` `AND` `OR` | `NOT` `IFNA` |
| Text | `CONCATENATE` `UPPER` `LOWER` `TRIM` `LEFT` `RIGHT` | `CONCAT` `MID` `LEN` `PROPER` `TEXT` |
| Date | `TODAY` `NOW` | `DAY` `MONTH` `YEAR` |
| Lookup | `VLOOKUP` | — |

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
npm test      # 78 cases across 7 files, via Vitest
```

Testing is focused on the **formula engine and sort logic** — pure functions with no React/DOM dependency, so
they run fast and give high confidence. UI/interaction behavior was verified manually with Playwright during
development of each feature (the scripts weren't committed to the repo — they were a temporary verification
tool, not a permanent regression suite).

| File | Cases | Tests |
|---|---|---|
| `tokenizer.test.ts` | 8 | Literals, cell/range refs (including absolute `$`), operators, string escaping, the `#REF!` token |
| `parser.test.ts` | 14 | Operator precedence/associativity, ranges, function calls, syntax errors |
| `evaluator.test.ts` | 10 | Arithmetic, comparisons, concatenation, reading cells/ranges, error propagation |
| `functions.test.ts` | 16 | The whole function library across aggregate/rounding/logic/text/lookup (SUM, VLOOKUP, SUMIF, IFERROR, etc.) |
| `shift.test.ts` | 8 | Relative reference shifting on copy/paste; absolute references staying put |
| `structuralShift.test.ts` | 15 | Reference adjustment on row/column insert/delete, including `#REF!` and range grow/shrink |
| `sheetSort.test.ts` | 7 | The bounds/header-detection heuristic, and sorting itself (blank values, limited column scope) |

CI: `npm run lint` → `npm run build` (which also type-checks the whole project, including the two languages'
`Messages` parity) → `npm test` — run by hand before every commit (no GitHub Actions workflow yet, see
[What's next](#-whats-next)).

---

## 🔭 What's next

What's not done yet, and why — to show this is a known gap, not something forgotten:

- [ ] **Automated CI (GitHub Actions)** — lint/build/test are currently run by hand before every push; no
  workflow set up yet
- [ ] **Cloud save / cross-device sync** — data currently lives only in one browser's `localStorage`; "Export
  Excel" is the way to move it (no user accounts or server-side database in the current scope)
- [ ] **Charts/graphs** from the sheet's data
- [ ] **Merged cells** and freezing beyond the already-sticky header row/column
- [ ] **Cell comments** and conditional formatting (highlight-by-condition)
- [ ] **More functions** such as `INDEX`/`MATCH`, multi-condition `SUMIFS`/`COUNTIFS`, date-difference functions
  (`DATEDIF`, etc.)
- [ ] **Mobile/tablet support** — currently designed primarily for a desktop screen; layout/touch for small
  screens isn't tuned yet
- [ ] **Direct CSV import/export** (currently `.xlsx` only)
- [x] **Live data from REST API / CSV** — done (prototype, see ✨ Features), polling-based refresh
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
