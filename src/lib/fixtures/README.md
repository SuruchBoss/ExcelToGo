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
