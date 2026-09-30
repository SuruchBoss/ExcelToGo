# Test fixtures

## `payneat-erp-sample-import-template.xlsx`

Copied unchanged from [SuruchBoss/PaynEat-ERP](https://github.com/SuruchBoss/PaynEat-ERP),
`docs/integrations/exceltogo/sample-import-template.xlsx`, as last changed at commit `0ebd35b`
(sha256 `e75d3245cc4de9869f044ccdd38802fa4113f49e5c8f5173ea289f9936964c07`).
Licensed Apache-2.0, like this repository; the ERP's maintainers agreed to its use as a test file.

It is the ERP's **draft 0** import template (ADR-0016 in that repository) — a design sample, not a
contract. Its dropdowns read from a hidden, protected `Ref` sheet: `$A` units, `$B` location codes,
`$C` item codes. Regenerate or refresh it from that repository rather than editing it here.

The larger `sample-import-template-large.xlsx` is not copied yet; it belongs to the work on storing
cross-sheet rules as references rather than per-cell lists.

## `losses-picture-chart.xlsx` · `losses-picture-chart.en.xlsx`

For #83, the report of what an opened file cannot keep. Each is a real package from two writers on
this machine: ExcelJS 4.4.0 wrote the workbook and a picture (`workbook.addImage` + `worksheet.addImage`),
then the app's own chart writer (`injectCharts` in `src/lib/xlsxCharts.ts`) added a bar chart. Sheet
one also holds `=TEXTBEFORE(A2,…)`, a function the engine does not have. The `.en` file is the same
thing with English sheet names, for the English screenshot.

openpyxl was tried first and not used: ExcelJS cannot open a file whose drawings openpyxl wrote (#159).
To make them again, write a vitest file that builds the workbook as above and saves it here.
