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

### 3. Source credentials are encrypted at rest

An auth header attached to a source is encrypted with AES-256-GCM under `SOURCES_SECRET_KEY` before
it is written to `data/sources.json`, and decrypted only at the moment it is put on an outgoing
request. Without that key configured, the app **refuses to store a credential** rather than writing
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
