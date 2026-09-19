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

## Live data sources: how they are guarded

Most of the app runs entirely in the browser: the spreadsheet, the formula engine, import/export,
charts and conditional formatting never send your data anywhere. Sheets live in that browser's
`localStorage`.

The **live data sources** feature is the exception, because it asks the *server* to fetch a URL on
your behalf. Three things guard it, and all three matter if you put this where other people can
reach it.

### 1. The API is off unless you switch it on

`/api/sources`, `/api/sources/[id]`, `/api/sources/[id]/data` and `/api/sources/test` all require
`SOURCES_ADMIN_TOKEN`, sent as `X-Sources-Token` (or `Authorization: Bearer`). With no token
configured the API **refuses every request with 403 `sources_disabled`** rather than serving
anybody — being unreachable is only a bad default if the alternative isn't "anyone on the internet
can drive the server's HTTP client", and it is.

One shared operator token rather than accounts, because that matches the documented shape of the
feature: one technical person sets the sources up, everyone else just sees the data. The browser
keeps it in `sessionStorage`, so closing the browser asks again.

**A public demo (`NEXT_PUBLIC_DEMO_MODE=1`) is the one exception, and it is a narrow one.** It
answers `GET /api/sources` with three sources hard-coded in `src/lib/server/demoSources.ts`, and
`GET /api/sources/[id]/data` for those three ids only — no token, because there is nothing to
protect: their URLs are app-relative paths into this app's own `/api/demo/*` handlers and are
fixed in the source tree. Every write stays refused: create, edit, delete and test all return 403
on a demo, which is what keeps the list closed. The visitor chooses an id, never a destination, so
the server's HTTP client has exactly three places it can go and no way to be pointed at a fourth.

Before this, a demo refused the feature outright. That was the safe thing to do while it was the
only safe thing — but it also meant the landing page advertised something nobody could try, and a
feature nobody can see may as well not exist. `src/lib/server/demoSources.test.ts` pins the
invariants the argument above rests on: app-relative URLs, no credential, GET only, and an id
lookup that matches the whole string rather than a `demo-` prefix.

A wrong token is compared in constant time, and "switched off" and "wrong token" are reported
differently so an operator can tell which they are looking at.

### 2. A source cannot reach your private network

Before every request — and again after **every redirect**, because a 302 is how a checked URL
becomes an unchecked one — the destination is resolved and every address it resolves to is checked.
Blocked: loopback, link-local (including `169.254.169.254`, the cloud metadata endpoint on AWS, GCP
and Azure alike), RFC 1918 private ranges, carrier-grade NAT, multicast, and the reserved and
documentation ranges. IPv6 link-local and unique-local go too, as do IPv4 addresses embedded in
IPv6 in **any** of their spellings — `::ffff:169.254.169.254`, the hex form `::ffff:a9fe:a9fe` that
a URL normalises it to, and the deprecated `::a9fe:a9fe`. Only `http` and `https` are allowed.

A URL beginning with a single `/` is one of the app's own routes and is the one case the guard is
skipped for — a demo source reaches `/api/demo/sales` even when the deployment's own origin is
loopback. "Its own route" is decided by resolving the URL and comparing the *resolved origin* to the
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

Running cloud save means running a database for whoever signs into your deployment, with the
obligations that carries. That is the reason it is off by default rather than something this
project hosts for everyone.

## Your own API key

`ANTHROPIC_API_KEY` is read on the server only and is never sent to the browser. Keep it in
`.env.local`, which is gitignored — `.env.example` is a template and holds no value.

`/api/ai/formula` deliberately requires no token: the assistant is a feature of the app, not an
admin tool. It is rate limited instead — **20 calls per minute per client address**, refused with
`429` and a `Retry-After` — so an open endpoint cannot be looped against your Anthropic bill.

On a public demo the route does not reach Anthropic at all. `NEXT_PUBLIC_DEMO_MODE=1` makes it
behave as if no key were configured — the local keyword matcher answers instead, which costs nothing
and still returns a usable formula. This is checked by
`src/app/api/ai/formula/route.test.ts`, which asserts the SDK is never even constructed while the
switch is on *with a key present*, so the protection does not depend on anyone remembering to leave
the key unset. Leaving it unset is still the better habit; two layers beat one.

The counters are held in the serving process's memory. Two instances behind a load balancer count
separately and a serverless cold start forgets everything, so this is a guard against casual abuse
and runaway scripts, **not a billing control**; a real one needs shared storage, which this project
does not have. The address comes from `x-forwarded-for`, which a client can forge, so it is used
for counting only and never for authorisation — and the limiter caps how many distinct keys it will
hold, because otherwise a spray of forged addresses would exhaust memory and turn the limiter into
the denial of service it exists to prevent.
