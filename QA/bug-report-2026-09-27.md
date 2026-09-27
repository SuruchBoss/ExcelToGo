# QA Report — ExcelToGo functional survey (pass 2) — 2026-09-27

**Mode:** survey (every feature section in README.en.md) · **Build:** `a7e0c5a` (main) · production build (`next start`)
**Env:** Chromium 141 (Playwright), 1360×900 and 390×844 (touch), Thai and English UI, fresh browser context per scenario
**Status:** this report describes build `a7e0c5a`. Since then Sprint A (`4fbac05`) and #23 (`0baa2c5`) have merged into main. None of the 64 bugs below was closed by them. Before starting on any of them, confirm it still reproduces on current main.
**Method:** each bug was reproduced at least twice from a fresh context by the tester, then re-run by the QA lead (the "Verified" column). Expected values were computed by hand, not taken from the app.

## Summary

**Total 64** — Critical 8 · High 18 · Medium 22 · Low 16
(plus 3 extra-evidence notes on existing issues, and findings reported privately per `AGENTS.md`, not listed here)

Two areas carry most of the risk:
- **Silent data loss in everyday editing:** undo, cut/paste across sheets, the formula bar, two open tabs, and live blocks after a row insert.
- **Import fidelity:** a real Excel file loses rows, filled-down formulas, dates and merged-cell totals, and the user is not told.

| | Critical | High | Medium | Low |
|---|---|---|---|---|
| Grid / editing | 3 | 6 | 9 | 7 |
| Import / export / pivot / charts / templates | 3 | 8 | 7 | 4 |
| AI / live data / autosave | 2 | 4 | 6 | 5 |

Coverage and "not a bug" notes are at the end.

### Issues filed (approved 2026-09-27: Critical/High one per issue, Medium/Low grouped by area)
| Report ID | Issue |
|---|---|
| C1 · C2 · C3 · C4 | #40 · #41 · #42 · #43 |
| C5 · C6 · C7 · C8 | #44 · #45 · #46 · #47 |
| H1 · H2 · H3 · H4 · H5 · H6 | #48 · #49 · #50 · #51 · #52 · #53 |
| H7 · H8 · H9 · H10 · H11 · H12 | #54 · #55 · #56 · #57 · #58 · #59 |
| H13 · H14 · H15 · H16 · H17 · H18 | #60 · #61 · #62 · #63 · #64 · #65 |
| Perf F1 · F2 (health audit) | #66 · #67 |
| Node 20 EOL (health audit) | #68 |
| M1–M9 · M10–M16 · M17–M22 | #69 · #70 · #71 |
| Perf F3 · dependency upkeep | #72 · #73 |
| L1–L7 · L8–L11 · L12–L16 · perf F4–F5 | #74 · #75 · #76 · #77 |
| Extra evidence (comments) | #23 · #13 · #30 |

Labels: `bug` + `sev:*` + `area:*` + `status:needs-triage`. The labels were created automatically in grey, so recolour them in the repo settings if you like.

---

## Critical — data loss or corruption

### [C1] area:ui — After undoing "add sheet", an import, or "start blank", every edit is silently dropped
- **Steps:**
  1. Click + to add a sheet.
  2. Press Ctrl+Z.
  3. Type `important` in A2 and press Enter.
- **Expected:** A2 = important. **Actual:** the cell stays empty; format clicks do nothing either. After a reload A2 is still empty. It stays this way until the user clicks a tab.
- **Also happens:** after undoing an xlsx/CSV import, and after undoing "Start from a blank sheet" (typing 99 into the sample price still shows 65).
- **Evidence:** `qa-grid/t16b.mjs`, `t27.mjs`, `t32.mjs` · **Verified:** yes (all three variants)
- **Cause:** the zundo history keeps only `{ sheets }` (`src/store/sheetStore.ts:1723`), so `activeSheetId` can point at a tab that no longer exists. `activeTab()` (:433) falls back to `sheets[0]` for reads, but `withActiveSheet()` (:449) writes by id and matches nothing.
- **Fix:** after undo/redo, reset `activeSheetId` to an existing tab, or make `withActiveSheet` target `activeTab(s).id`.

### [C2] area:ui — Cut on one sheet and paste on another erases cells on the destination sheet
- **Steps:**
  1. On Sheet1, A1:A2 = move-me-1, move-me-2.
  2. On Sheet2, A1 = KEEP-A1, B1 = KEEP-B1, A2 = KEEP-A2.
  3. On Sheet1, cut A1:A2.
  4. On Sheet2, paste at D1.
- **Expected:** D1:D2 filled, and Sheet1's A1:A2 cleared.
- **Actual:** Sheet2's **own** A1:A2 are erased. Sheet1 still holds both values.
- **Evidence:** `qa-grid/t23.mjs` · **Verified:** yes
- **Cause:** `pasteAtSelection` (`sheetStore.ts` ~1087–1106) clears the cut rectangle on the *active* sheet. The clipboard doesn't record its source sheet.
- **Fix:** store the source sheet id with the cut and clear there.

### [C3] area:ui — The formula bar keeps an old value and writes it back when focused and left
- **Steps (sample sheet):**
  1. Select C2.
  2. Click Sort descending. The bar still shows 65 while the cell shows 85.
  3. Click into the bar, then click another cell.
- **Actual:** the new row's price becomes 65.
- **Same pattern:**
  - Delete a cell holding "hello", then focus and leave the bar: "hello" comes back.
  - Ctrl+Z a change (v2 → v1), then focus the bar and press Tab: the cell becomes v2 again.
- **Evidence:** `qa-grid/t29.mjs`, `t31.mjs` · **Verified:** yes (all three)
- **Cause:** `src/features/grid/FormulaBar.tsx:87-93`, an uncontrolled `<input key={address} defaultValue={raw}>`. Its `commit()` writes whenever `value !== raw`.
- **Fix:** key on address + raw (or make it controlled), and commit only after the user has typed.

### [C4] area:import-export — Import silently drops rows and columns, even from the app's own exports
- **Steps:**
  1. In a blank sheet, set A1 Revenue, B1 100, A25 Total, B25 `=B1`.
  2. Export Excel.
  3. Import that file.
- **Expected:** row 25 is present. **Actual:** the sheet is 20×10 and A25/B25 are gone, with no message. A sheet with a blank separator row or column loses its last row or column.
- **Evidence:** `qa-data/t-selfrt.mjs`, `sparse.xlsx` · **Verified:** yes
- **Cause:** `src/lib/excelIO.ts:361-362` sizes the sheet from `actualRowCount`/`actualColumnCount`. In ExcelJS those are *counts of non-empty* rows/columns, not the last index. The guard at `:378` then drops everything past the count.
- **Fix:** size from `rowCount`/`columnCount` or from the maximum index seen, and never drop a cell silently. Same code as #10 (unlocked empty rows), but this bug loses cells that **hold values**.

### [C5] area:import-export — Filled-down ("shared") formulas import as fixed numbers
- **Steps:**
  1. Import an xlsx where B1:B5 = `A1*10` was filled down in Excel.
  2. Change A2.
- **Actual:** only B1 keeps its formula; B2:B5 are frozen numbers. The next export writes numbers, so the formulas are lost for good.
- **Evidence:** `qa-data/shared.xlsx`, `t-set2.mjs` · **Verified:** by code path. `cellValueToRaw` only recognises `{formula}`, and ExcelJS returns `{sharedFormula, result}` for these cells, so they fall through to `result`.
- **Fix:** when `cell.type === ValueType.Formula`, use `=${cell.formula}` (ExcelJS translates shared formulas).

### [C6] area:import-export — Dates and times arrive as text, and times are destroyed
- **Actual:**
  - 2024-01-15 imports as the text `"2024-01-15"`.
  - 2024-01-15 14:30 loses its time.
  - 09:45 becomes `"1899-12-30"`.
  - `=A2-A1` and `=A1+30` show `#VALUE!` (Excel gives 36 and a date).
  - The export writes these as strings with no date format.
- **Evidence:** `qa-data/dates.xlsx`, `t-set2.mjs`, `out/rt-export.xlsx` · **Verified:** yes
- **Cause:** `cellValueToRaw` does `v.toISOString().slice(0,10)`, and `numberFormatFromExcelNumFmt` maps date formats to general.
- **Fix:** keep the serial number and carry a date/time number format that round-trips.

### [C7] area:live-data — Deleting or inserting a row above a live block makes the next refresh erase the user's rows
- **Steps:**
  1. Type Title in A1.
  2. Place Live sales at A3 (it fills A3:G8).
  3. Put your own total in E9:F9.
  4. Delete row 1.
  5. Wait for one refresh.
- **Actual:** the block is rewritten at its old anchor after clearing its old area. Your total, now in row 8, is erased and a stale header is left in row 2. Autosave has already saved the loss, and nothing tells the user.
- **Insert-row variant:** leaves an editable stale copy of the last row outside the block.
- **Evidence:** `qa-shell/r2/live2.txt`, `live3.txt`, `shots/live-delete-row-*.png` · **Verified:** by code. `liveBlocks` anchors are only touched by the live-data actions (`sheetStore.ts` ~1467–1529), never by structural edits.
- **Fix:** shift `liveBlocks[].anchorRow/anchorCol` in the row/column insert/delete path, clip or drop a block whose own rows are deleted, and add a store test.

### [C8] area:ui — Two tabs on the same workbook: the last tab to save silently wins
- **Steps:**
  1. Open /app in tab 1 and tab 2.
  2. Type in G2 in tab 1.
  3. Type in G3 in tab 2.
  4. Open a third tab.
- **Actual:** G2 is empty and G3 is filled. Tab 1's edit is gone and nothing warned. The README's Autosave section doesn't mention tabs.
- **Evidence:** `qa-shell/r2/twotabs.txt`, `shots/two-tabs-lost.png` · **Verified:** by code. The persist key `exceltogo-sheet-v2` has no `storage` listener; the only ones are in `StorageNotice.tsx` and `SourcesUnlock.tsx`.
- **Fix:** listen for `storage` on that key and rehydrate or warn ("changed in another tab"), or elect one editing tab (BroadcastChannel / `navigator.locks`). State the limit in both READMEs.

---

## High — wrong results or a key feature broken

### [H1] area:formulas — Sorting a table breaks every row formula, including on the built-in sample
- **Steps:**
  1. On the sample sheet, click C2.
  2. Click Sort descending.
- **Expected:** each Total still equals its own Price × Qty.
- **Actual:** formula text moves without adjusting. Chocolate cake (85×6 = 510) shows 660 via `=C7*D7`. The grand total still reads 7495, so the sheet *looks* right.
- **Evidence:** `qa-grid/t3.mjs`, `t3-sample-sorted.png` · **Verified:** yes (minimal case: Name/Score/Double `=B2*2` → Double values belong to other rows)
- **Cause:** `src/lib/sheetSort.ts:61-66`. The comment says "Excel doesn't do this either", which is not accurate: Excel keeps same-row relative references pointing at their own row after a sort, which is why Price×Qty tables sort correctly there. The README says nothing about it.
- **Fix:** shift relative refs by (destination row − source row) with `shiftFormulaRefs`, as fill/paste already do. Correct the comment.

### [H2] area:ui — Sort descending on a text column moves the header into the data
- **Actual:** `c, b, a, Name`. Ascending looks right only because "N" sorts before lowercase letters in code-point order.
- **Evidence:** `qa-grid/t3.mjs` · **Verified:** yes
- **Cause:** `detectSortRange` (`sheetSort.ts`) skips the header only when the column is mostly numeric.

### [H3] area:ui — Delete, copy and Ctrl+Enter act on rows hidden by a filter
- **Steps:**
  1. Filter out "South".
  2. Select the visible B2:B6 and press Delete.
- **Actual:** the hidden South values are erased too, where Excel only touches visible cells. Copy also copies hidden rows, and Ctrl+Enter fills them.
- **Evidence:** `qa-grid/t4.mjs`, rerun · **Verified:** yes
- **Cause:** `clearSelection`, `copySelection` and `fillSelectionFromAnchor` ignore `hiddenRowsFor`.

### [H4] area:ui — Cut and paste doesn't move references
- **Steps:**
  1. A1 = 5, B1 = `=A1*2`.
  2. Cut A1 and paste it in D1.
- **Expected (Excel's move):** B1 becomes `=D1*2` and still shows 10. **Actual:** B1 stays `=A1*2` and shows 0.
- **Also:** cutting a formula shifts it like a copy (`=A1*2` pasted in C5 becomes `=B5*2`).
- **Evidence:** `qa-grid/t2.mjs`, rerun · **Verified:** yes
- **Fix:** paste cut formulas unshifted, and rewrite references into the moved rectangle across the workbook.

### [H5] area:formulas — Numbers with thousands separators, % or currency are stored as text, so pasting from Excel totals 0
- **Actual:** paste `1,250 / 2,000 / 15% / ฿1,234.50` from Excel's clipboard, then `=SUM(...)` gives **0**. Typing `1,000` or `50%` gives text too, so `=A9*2` is `#VALUE!`. The README promises paste from real Excel and Google Sheets, and both copy displayed text. The fill-series code already accepts "1,250".
- **Evidence:** `qa-grid/t14.mjs`, `t15-paste-excel-0.png` · **Verified:** yes
- **Cause:** `literalValue` in `src/lib/sheetCompute.ts:202` uses plain `Number(raw)`. It is the same function as #23 but fails the other way. #23 has since been fixed with one `literalValue` (`ca8c7a6`); this case, grouping commas, `%` and currency, is not part of that fix and still needs checking on current main.

### [H6] area:import-export — Percent and currency formats show different numbers from Excel
- **Actual:**
  - Excel `0%` holding 0.25 (shown as 25%) appears as **0.25%**, and is exported as `0.00"%"`, so Excel then shows 0.25% as well.
  - Typing 0.5 and choosing Percent shows 0.50%.
  - `"$"#,##0.00` becomes ฿.
  - `0.000` is cut to 2 decimals.
  - `#,##0` loses its separators.
- **Evidence:** `qa-data/roundtrip.xlsx`, `out/rt-import.png`, `qa-grid/t22-pct-import-0.png` · **Verified:** yes (0.5 → "0.50%")
- **Cause:** `src/lib/cellFormat.ts:46-51` (deliberate per its comment, but the README only says "percent" with no caveat), `numberFormatFromExcelNumFmt`, `EXCEL_NUM_FMT`.
- **Fix:** use Excel's ×100 semantics and keep the original numFmt string for export. At minimum, convert on import/export and document the choice.

### [H7] area:ui — Duplicate or invalid sheet names point formulas at the wrong sheet, and export fails
- **Actual:**
  - With Sheet1/2/3 and `=Sheet3!A1` in Sheet1: delete Sheet2, add a sheet. The new tab is also "Sheet3"; typing 999 there changes Sheet1's formula result.
  - Renaming Sheet2 to "Sheet1" is allowed and turns `=Sheet2!A2` into a self-reference. The export then has a circular reference.
  - Renaming Sheet2 to "sheet1" (case only) makes Export Excel do **nothing**, with no message (it throws `Worksheet name already exists`).
  - "Q1/Q2" is accepted, but the file names the tab "Q1 Q2" while the formulas still say `'Q1/Q2'!A1`.
- **Evidence:** `qa-grid/t10b.mjs`, `t10c.mjs`, `dup.xlsx`; `qa-data/t-names2.mjs` · **Verified:** yes (duplicate "Sheet3", 999)
- **Cause:** `addSheet` uses `` `Sheet${length+1}` `` (`sheetStore.ts:676`); `renameSheet` (:699) doesn't validate; `sanitizeSheetName` is case-sensitive and doesn't rewrite formulas; `exportXlsx` has no catch.
- **Fix:** generate unique names; on rename enforce Excel's rules (case-insensitive unique, no `[]:*?/\`, max 31 characters); catch and report export errors.

### [H8] area:import-export — A merged cell's value is copied into every cell it covers
- **Actual:** after importing A1:A3 merged with value 10, `=SUM(A1:A3)` = 30 and `COUNTA` = 3 (Excel gives 10 and 1). Unmerging shows the value in every cell.
- **Evidence:** `qa-data/merged-num.xlsx` · **Verified:** by code. `importWorksheet`'s `eachCell` includes Merge-type cells, whose `.value` is the master cell's value.
- **Fix:** skip covered cells (`cell.type === ValueType.Merge` or `cell.master !== cell`).

### [H9] area:pivot — The summary sheet is cut to 30 rows × 10 columns with no warning
- **Actual:**
  - Group by Product with 35 products: P30–P35 and the **Grand total row** are missing.
  - Region × Month: shows M01–M09 only, with no Grand total column.
  - In both cases the result looks complete.
- **Evidence:** `qa-data/t-pivot.mjs`, `out/pivot-*.png` · **Verified:** yes (M10–M12 and the total column missing)
- **Cause:** `renderPivotSheet` uses `createEmptySheet()` (30×10, `sheetStore.ts:414`) and drops everything outside it (:418).
- **Fix:** size the sheet to the result.

### [H10] area:pivot — Pivot "Count" counts blank cells
- **Actual:** Count of Amount by Region gives กลาง 12, North 12, total 59. Counting non-empty cells, as Excel does, gives 11, 10 and 54.
- **Evidence:** `qa-data/pivot.xlsx`, `t-pivot.mjs` · **Cause:** `src/lib/pivot.ts` `aggregate()` count = `values.length`.
- **Fix:** count values that are non-empty.

### [H11] area:import-export — Formulas that read another sheet become `#REF!` in CSV/PDF exports and in pivots
- **Actual:**
  - A cell showing 142 (`=Data!B2+B2`) is written as `#REF!` to CSV and PDF.
  - The .xlsx export has no cached result for it.
  - A pivot over a cross-sheet source gives a blank row and a Grand total of 105.3 instead of 175.3.
- **Evidence:** `qa-data/t-cross.mjs`, `out/cross-1.csv` · **Verified:** yes (CSV `#REF!` while the grid shows 142)
- **Cause:** `computeSheet(sheet)` is called without `createWorkbookResolver(sheets)` at `sheetStore.ts:397, 1668, 1686, 1705, 1882`, and at `PivotPanel.tsx:39`. The grid itself uses the resolver (:1807).
- **Fix:** pass the resolver everywhere.

### [H12] area:charts — Charts in the exported .xlsx point at the wrong columns when a text column sits between the data columns
- **Steps:**
  1. Enter Branch | Notes | Q1 | Q2.
  2. Make a bar chart from A1:D5.
  3. Export Excel.
- **Actual:** the chart XML reads B and C (Notes, Q1) instead of C and D. The cached numbers are right, but Excel re-reads the references.
- **Evidence:** `qa-data/t-chart.mjs`, `out/chart-1.xlsx` · **Verified:** yes (`Sheet1!$B$2:$B$5`, `$C$2:$C$5`)
- **Cause:** `src/lib/xlsxChartXml.ts` `seriesRefsFrom` computes `startCol + labelOffset + index`, while `chartDataFrom` skips non-numeric columns.
- **Fix:** carry each series' source column.

### [H13] area:import-export — Named ranges from an Excel file break when used on another sheet
- **Actual:** names defined on sheet Lists and used on sheet Data: `=SUM(Rates)` gives `#NAME?` and a VLOOKUP over RateTable gives `#REF!`. The README says a name pointing at another tab "still works" and that files with names "still compute".
- **Evidence:** `qa-data/named.xlsx` · **Cause:** `excelIO.ts` `readDefinedNames` puts each name only on its target sheet and stores the reference without its sheet.
- **Fix:** keep the reference sheet-qualified and make workbook-level names visible from every sheet.

### [H14] area:templates — Template locks can be bypassed
- **Doc mismatch:** the README says "Every route in is guarded".
- **Actual:**
  - The formula panel's "This cell only" writes into a locked label.
  - "Entire column" overwrites locked formulas.
  - Cutting a locked cell and pasting it into an input empties the locked cell.
  - Merging locked cells erases one after a confirm prompt.
- **Evidence:** `qa-data/t-template.mjs`, `t-template2.mjs`, `out/template-1.png`
- **Cause:** `insertPending` / `applyFormula`, the cut source in `pasteAtSelection`, and `toggleMerge` skip `refusedByTemplate`.
- **Note:** a template lock protects a form's structure against mistakes. It is not a security boundary (the data is the user's own), so this is filed publicly. Say so if you see it differently.

### [H15] area:ai-assistant — The keyword matcher picks the wrong function
- **Actual:**
  - "จำนวนเงินรวมทั้งหมด" (total amount) gives `=COUNT(E2:E10)` = 9 instead of `=SUM` = 7495.
  - "ยอดรวมจำนวนสินค้าที่ขายได้" gives COUNT = 9 instead of 137.
  - "Account for every sale: total revenue" gives COUNT, because "count" sits inside "account".
  - "Difference in days" gives `=IF(A1>0,"Pass","Fail")` ("if" inside "difference").
  - "…price minus quantity" gives `=MIN(...)` ("min" inside "minus").
  - The English example chip "Look up a product's price from its code" is declined, while the Thai chip works.
- **Evidence:** `qa-shell/r2/ai.txt`; re-run directly against `heuristicSuggest` · **Verified:** yes
- **Cause:** `src/lib/aiHeuristic.ts:79` uses `q.includes(k)`, and the first rule that matches wins, with COUNT ("จำนวน") listed before SUM.
- **Fix:** word-boundary matching for Latin text; let "รวม", "ยอดรวม" and "total" beat "จำนวน"; treat "จำนวนเงิน" as an amount.

### [H16] area:ai-assistant — The matcher ignores conditions and builds templates on the header row
- **Actual:**
  - "sum of quantity for Bakery" gives `=SUM(D2:D10)` = 137 (correct: 38).
  - "ยอดรวมของหมวดเครื่องดื่ม" gives 7495 (correct: 2745).
  - "นับ…มากกว่า 15 ชิ้น" gives COUNT = 9 (correct: 4). The English version of the same question correctly declines.
  - The landing page's own headline example ("total sales for the northern branch") gives a plain SUM.
  - "Join name and category" gives `=CONCATENATE(A1," ",B1)` = "Product Category" (the header row).
  - "If price above 50…" gives `=IF(A1>0,"Pass","Fail")`.
  - Counting a text column gives COUNT = 0 where COUNTA is needed.
- **Why it matters:** the README's own rule is "a question it cannot answer is a better outcome than an answer it cannot justify".
- **Evidence:** `qa-shell/r2/ai.txt`, `shots/ai-*.png` · **Verified:** yes (matcher probe)
- **Fix:** decline when the question carries a qualifier ("for", "where", "only", "เฉพาะ", "ของหมวด", "มากกว่า"…); build templates on the cursor's row; use COUNTA for text.

### [H17] area:ai-assistant — "Insert" writes a formula that refers to its own cell, overwriting that cell's formula
- **Steps:**
  1. On the sample sheet, click E5 (`=C5*D5`).
  2. Ask "Total all sales in this column".
  3. Click Insert.
- **Actual:** E5 becomes `=SUM(E2:E10)`, which is `#CIRCULAR!`, and its own formula is gone.
- **Also:** at an empty F2, the app's own first chip produces `=SUM(F2)`, which is circular too.
- **Evidence:** `qa-shell/r2/ai.txt`, `shots/ai-en-inside.png`
- **Cause:** `useAIContext` (~1840) falls back to the cursor's own address; `autoSumRange` (`src/lib/aiRange.ts`) includes the cursor's row; `insertAIFormula` (~1593) doesn't check.
- **Fix:** never return a range that contains the target; insert below the run; refuse self-references.

### [H18] area:live-data — When the source's list becomes empty, the block fills with the response envelope
- **Steps:**
  1. A source on `/api/demo/orders?page=5` shows 20 correct rows.
  2. Change it to `page=99` (`items: []`).
- **Actual:** the header becomes `ok | page | page_size | total | items | next` and the single row `TRUE | 99 | 25 | 120`. Formulas over the block now read 120 as a quantity.
- **Evidence:** `qa-shell/r2/live5.txt`, `shots/live-empty-list.png` · **Verified:** yes (direct `jsonToTable` probe)
- **Cause:** `isRecordArray` requires `length > 0` (`src/lib/dataSources/jsonToTable.ts:14`).
- **Fix:** treat an empty records array as zero rows and keep the last good columns.

---

## Medium

| ID | Area | Bug | Where / fix |
|---|---|---|---|
| M1 | ui | After an in-app copy, pasting ignores newer text on the system clipboard ("APP" wins over text copied later in another app) | `pasteAtSelection` prefers `s.clipboard`; use the in-app block only when the external text equals `toTsv(clipboard)` |
| M2 | ui | An overlapping cut (A1:A3 → A2) gives `1,1,2,3`; Excel gives `"",1,2,3` | `destOverlapsSource` branch: clear the source cells not covered by the destination |
| M3 | ui | Filling a date gives invalid dates (`2026-01-30` → `2026-01-31`, `2026-01-32`) and `1/31/2026` → `1/31/2027` | `SUFFIX_RE` in `fillSeries.ts` matches dates; detect dates first |
| M4 | ui | A cell Excel copies with a line break (`"line1\nline2"`) pastes as two rows with stray quotes | `parseTsv` in `sheetClipboard.ts` has no quoted-field handling |
| M5 | ui | Ctrl+C puts formula text, not values, on the system clipboard (`2\t=A6*10`) | `toTsv(copyRange…)` uses raw cells; write displayed values |
| M6 | ui | Sort doesn't move comments (or validation or row heights) with their rows | `sortRange` |
| M7 | ui | Text sort is case-sensitive and uses code-point order: `Apple, Cherry, apple2, banana`; Thai `ขนม, เก้าอี้, ไก่`. The pivot already sorts Thai correctly | `compareCellValues`: use `Intl.Collator(['th','en'],{sensitivity:'base'})` |
| M8 | ui | While editing, Shift+Enter goes down and Shift+Tab goes right (the README's key table says up/left) | editor `onKeyDown` in `SpreadsheetGrid.tsx` ~805 ignores `shiftKey` |
| M9 | docs | `=SUM(A:A)` gives `#SYNTAX!`, but the README uses it as an example of a valid formula. Whole-column references aren't in the limits list | Implement them or document the limit |
| M10 | import-export | TRUE/FALSE import as the text true/false and export as strings, so Excel's `IF(A1,…)` gives `#VALUE!` | `cellValueToRaw` `String(v)`; `writeSheetToWorksheet` only converts numbers |
| M11 | validation | List rules are bypassed by paste (in-app and external) and by the fill handle; a leading space (` เหนือ`, the README's own example) is accepted | `checkValue` is only called in `setCellRaw` and trims first |
| M12 | import-export | Theme and indexed colours (Excel's default palette) import as no colour | `argbToHex`/`fillColorOf`; resolve through the workbook theme |
| M13 | conditional-format | Rule priority from the file is ignored: priority-1 red (>50) loses to green (>10) | `readConditionalFormats` keeps file order; sort by priority |
| M14 | ui | Formula panel "Entire column" overwrites the header and the grand total with no confirmation (header gets `=SUM(C1:D1)`) | `applyFormula` column scope: start at the anchor, stop at the table edge, confirm before overwriting |
| M15 | pdf | Page numbers read "Page 1 of 1", "Page 2 of 2"… (expected "of 6"); chart pages have no number | `didDrawPage` reads the page count mid-layout; use `putTotalPages` |
| M16 | pdf | Wide sheets wrap numbers onto two lines (150010 → "15001" / "0") | no-wrap numeric cells; a minimum width for the row-number column |
| M17 | ai-assistant / a11y | The "this is a keyword guess" note has 1.84:1 contrast (#00d492 on #ecfdf5, 10px); axe flags it serious. `check:a11y` never opens the panel with an answer on screen | a darker colour at 11–12px; add an "answer shown" state to `OPENED_STATES` |
| M18 | ai-assistant | BYOK: every error (401 invalid key, 429, 500, 529) shows "try again"; a rejected key is never named | the catch in `ask()` / `askAnthropicDirect.ts`: map `AuthenticationError` and `RateLimitError` |
| M19 | ai-assistant | BYOK: if the API never answers, the spinner stays forever with no cancel, and "Remove key" doesn't release it | no `timeout`/`maxRetries` on the SDK client; add an AbortController and a Cancel button |
| M20 | live-data | Sorting across a live block misaligns the user's own columns after the next refresh | `sortSelection`: refuse a sort that overlaps a live block |
| M21 | live-data | Offline, or in a tab without the token: the block shows a blank source name, "updates every 0s", stops updating silently, and never shows "fetched at" (the README says it does) | store name, interval and `fetchedAt` on the block; show "not updating" |
| M22 | live-data | The "Orders (several pages)" demo never paginates on a local or self-hosted install (the next page is blocked by the loopback guard, which is correct), and the hint "raise the row limit" can't help | document it; report *why* it stopped. Do not loosen the guard |

## Low

| ID | Area | Bug |
|---|---|---|
| L1 | ui | Find & replace corrupts text whose lowercase form has a different length: `İstanbul` with stan → X gives `İsXul` (`replaceIn`, `sheetSearch.ts`) |
| L2 | ui | Names like `A1B2` are accepted but unusable (`#SYNTAX!`), although the README says the validator refuses unusable names |
| L3 | ui | A formula that reads only another sheet gets no "reads" label (`FormulaBar.tsx`) |
| L4 | ui | CJK IME typing into a selected (not yet editing) cell is lost. Thai layouts are fine |
| L5 | ui | Clicking a toolbar button takes keyboard focus away from the grid (arrow keys and Delete then do nothing) |
| L6 | mobile | Find & replace can only be opened with Ctrl/Cmd+F or H, so it is unreachable on a phone |
| L7 | ui | Minor: dragging a single number counts up (deliberate but undocumented) · Ctrl+Z silently undoes an edit on another sheet · negative currency shows `฿-5.00` |
| L8 | conditional-format | A 3-colour scale is coloured by midpoint in the app but `percentile 50` in the export (3 of 1,2,3,4,100 looks different in Excel) |
| L9 | conditional-format | Text-equals and formula rules are dropped on import without notice; the README's limits list doesn't mention them |
| L10 | import-export | CSV export writes float noise (`0.30000000000000004`) where the grid shows 0.3 (`valuesToCsvGrid`) |
| L11 | import-export | Minor fidelity: the comment tooltip shows "C2" (the note appears only over the 6px triangle) · thick/double borders export as thin · the Excel `#N/A` literal imports blank |
| L12 | ai-assistant | BYOK: a reply that can't be read is labelled "No API key yet" although a key is saved |
| L13 | live-data | A REST (JSON) source that returns non-JSON text with commas is silently read as CSV ("Connected — 104 rows" of JavaScript) |
| L14 | mobile | The live-block toolbar is 515px wide at 390px (Refresh/Change/Remove off screen); on desktop it covers the row above the block |
| L15 | live-data | A failing source shows the green "Live" pulse next to "Connection failed" (`SourceRow.tsx`) |
| L16 | landing | The English landing page shows `=SUM(ยอดขาย)` in Thai, and its roadmap link points at the Thai README anchor |

---

## Extra evidence for existing issues (comment, don't re-file)
- **#23** (since closed by `0baa2c5`): the same coercion happened on **xlsx import** of a text cell ("007" → 7), and for typed `0x10` → 16, `0b11` → 3 and `Infinity`, which Excel keeps as text. CSV import of `007` → 7 and `1e5` → 100000 match Excel, so they are not bugs. H5 is the same function failing the other way.
- **#13:** a `whole` 1–10 rule imports fine but exports as `decimal`.
- **#30:** the import error for an empty or non-xlsx file is one of those `alert()` calls.

## Not a bug / documented
- Filters are session-only and not in undo (not promised).
- Merge warns before discarding values and undo restores them.
- The long-press menu on phones is a documented limit.
- Names are per-sheet (documented).
- Undo history is not kept across reloads (not claimed).
- `=0.1+0.2` shows 0.3. Array formulas were checked by hand and are correct.
- Notes on empty cells are lost on re-import, CSV apostrophe handling, pie charts show one series, PDF charts are images — all documented.
- A 20,000-row import completes (~27 s) and computes correctly.
- Storage full: the edit stays in memory and the alert with Export appears, as documented.
- The AutoSum range stopping at a blank is its documented rule.
- One Ctrl+Z removes a whole live block after refreshes, as documented.
- The BYOK key is only ever in `sessionStorage`, masked, and never in the page or console.
- Offline: the app loads, edits and exports as documented.
- Landing page figures (37 / 64 / 1399 / 269) match `scripts/counts.mjs`; no overflow at 390 or 1280 in either language.

## Coverage
Every feature section of README.en.md was tested, except **cloud save** and **editing together**, which need a Supabase backend (none is attached in this environment). **Straight into a database** was covered by the first pass's code review only.
- **Partial:**
  - text colour input (scripted input didn't apply)
  - fill across merged cells
  - the drag gesture of drag-and-drop formulas (click and scopes tested)
  - rank and data-bar conditional formats
  - pivot min/max
  - a slow or 500-returning live source (a local test server is correctly refused by the loopback guard, and no same-origin endpoint returns those)
  - Thai glyph shaping in the PDF (text presence only)

Evidence paths (`qa-grid/`, `qa-data/`, `qa-shell/`) name the QA test scripts, which were kept outside the repo. Each filed issue carries enough steps and values to reproduce without them.
