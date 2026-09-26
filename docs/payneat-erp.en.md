# ExcelToGo and PaynEat ERP

**ภาษาไทย:** [payneat-erp.md](payneat-erp.md)

- **Status:** joined the PaynEat ecosystem (2026-09-26), **and nothing has been built yet.** Everything below
  is a plan, not a feature that exists.
- **On the ERP side:** [ADR-0016](https://github.com/SuruchBoss/PaynEat-ERP/blob/main/docs/adr/0016-exceltogo-spreadsheet-companion.md)
  (records this agreement), [ADR-0011](https://github.com/SuruchBoss/PaynEat-ERP/blob/main/docs/adr/0011-ecosystem-and-sherwhyve.md)
  (what each system owns), [ADR-0013](https://github.com/SuruchBoss/PaynEat-ERP/blob/main/docs/adr/0013-extension-by-integration.md)
  (extension through the API only), [`TELEMETRY.md`](https://github.com/SuruchBoss/PaynEat-ERP/blob/main/docs/TELEMETRY.md) v1.2

## What does not change

- **ExcelToGo still stands on its own.** Someone who never uses the ERP sees nothing different. Anything
  specific to PaynEat lives in a template or in operator configuration, never on the main screen.
- **The ERP is reached through its public API only.** A [database source](../README.en.md#-straight-into-a-database-postgresql--mysql)
  must not be pointed at the ERP's database: its tables are not a contract, and reading them directly steps
  around the ERP's audit trail. **ExcelToGo cannot enforce this in code** — the list of reachable hosts
  belongs to the operator — so the ERP should also close the network path to its own database.
- **Sheet data stays in the browser**, as it always has. Data pulled from the ERP lives in the browser of
  whoever is looking at it.

## What was agreed

| Work | Who owns what | When |
|---|---|---|
| **Data-import template** | The ERP owns the template's shape (sheets, columns, rules) and the import endpoint, and re-checks every row. ExcelToGo opens the template, helps people fill it in correctly, and exports an `.xlsx` with its rules intact | After ERP v1, before a pilot chain |
| **Live data from the ERP's public API** | The ERP provides the API and a read-only token; ExcelToGo is its first consumer | Once the ERP ships its public API |
| **`x-request-id`** | ExcelToGo sends it on every request, in the shape `TELEMETRY.md` defines | Any time |

## Import template: how far along it is

Tested against the ERP's draft-0 templates ([`docs/integrations/exceltogo/`](https://github.com/SuruchBoss/PaynEat-ERP/tree/main/docs/integrations/exceltogo),
commit `a184ce9`), in Node and in the real app (production build, Chromium), on 2026-09-26.

**Works today:** a sheet-protected file opens as a template (unlocked cells are the fields), the data sheets
go back out still protected, and dropdowns written as an inline list (`"plant,warehouse,branch"`) survive
the round trip.

**Missing, and needed before a template goes to a chain:**

1. **Bug: a dropdown that points at a range on another sheet gets the wrong options.** A rule such as
   `Ref!$B$2:$B$5` is read from the same range *on the sheet being opened* instead of on `Ref`
   (`src/lib/excelIO.ts`, `rangeReader`), with no warning. In the ERP's template **every** cross-sheet
   dropdown is wrong — the unit column offers item codes, for one.
2. **Bug: a template's dropdowns are written back without checking Excel's 255-character limit.** The large
   template exports a 9,001-character list formula, which breaks the spec.
3. **The range reference itself has to survive the round trip.** Options are captured as a list **copied
   into every cell** at import. `Ref!$C$2:$C$3001` has to be kept end to end — along with **the reference
   sheet's hidden and protected state**, which is currently lost on export (`Ref` comes back visible and
   unprotected).
4. **Bug: empty input rows are cut off.** A sheet's size comes from the rows holding values (at least 20),
   not from unlocked cells or cells carrying a rule. The ERP's template has input rows down to row 200
   (`Items`, `OpeningBalance`) and 50 (`Locations`); ExcelToGo opens 20.
5. **A template sheet keeps only its `list` rules.** `whole`, `decimal`, `textLength` and `date` on a
   protected sheet are all dropped, on import and on export. Even on an ordinary sheet the support is
   partial: no minimum for `textLength`, `whole` read as any number, `greaterThan` read as "at least", and
   no `date` at all.
6. **Bug: when saving to `localStorage` fails, the app breaks silently.** See the numbers below.

**Measured** (development machine; for comparison, not a promise):

| | Regular template | Large template (3,000 codes × 3,000 rows) |
|---|---|---|
| Open in the app until the tabs show | 0.4 s | 2.4 s |
| Size to store in `localStorage` | 17K characters | **about 45 million characters**, against a ~5 MB quota |
| Save | works | **fails** — an uncaught `QuotaExceededError` |
| Export `.xlsx` | 0.1 s | **fails** — the button does nothing (Node exports in 0.9 s, but the file breaks the spec per item 2) |
| Reload the page | work is still there | **all work is lost** |

The size comes from item 3: 3,000 options copied into each of 6,000 cells. Kept as a reference, it falls to
the size of the actual data. Item 6 needs its own fix all the same, because other large sheets can hit the
quota too, and the person has to be told rather than lose their work without a word.

## Live data: what the ERP needs to know

- **ExcelToGo has to be self-hosted.** Live sources do not work on the Vercel demo in any case: their
  configuration lives in `data/sources.json`, and Vercel's filesystem is read-only.
- **Recommended paging shape:** a body of `{ "data": [...], "next": "<absolute URL on the same host>" }`,
  with `next` set to `null` on the last page, and `429` with `Retry-After` in seconds when limiting. The
  pager also understands `Link: rel="next"`, a cursor in the body, and `?page=` / `?offset=`
  ([paginate.ts](../src/lib/dataSources/paginate.ts), [rateLimit.ts](../src/lib/dataSources/rateLimit.ts)).
- **Ceilings per refresh:** 20 pages, 50,000 rows, 15 seconds per request, 45 seconds in total. To reach
  50,000 rows the ERP has to serve at least 2,500 rows per page.
- **One token per installation, not per person.** ExcelToGo's sources belong to the whole deployment, so
  the ERP's audit trail sees "ExcelToGo" as the caller, not which accountant asked. Issue the narrowest
  token the reports need.
- **An ERP on an internal network.** Today ExcelToGo blocks every private range, even for a host listed in
  `SOURCES_ALLOWED_HOSTS`. The plan is a list of internal hosts the operator names one by one, with
  **loopback, link-local and cloud metadata still always blocked** and tests pinning it — stricter than
  `SOURCES_ALLOWED_DB_HOSTS`, which skips the address check entirely. It ships together with a review of the
  whole fetch path.

## `x-request-id`

A fresh value per request, matching `^[\w-]{8,64}$` as `TELEMETRY.md` v1.2 requires — otherwise the ERP
generates its own and the link back is lost. Writing ExcelToGo's own logs to the telemetry contract is not
planned yet.
