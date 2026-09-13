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

## Known limitations — read this before deploying

Most of the app runs entirely in the browser: the spreadsheet, the formula engine, import/export
and conditional formatting never send your data anywhere. Sheets live in that browser's
`localStorage`.

The **live data sources** feature is different, and is a prototype. Three things about it matter
if you put this on a server that other people can reach:

1. **The data-source API has no authentication.** `/api/sources` and `/api/sources/[id]` are open
   to anyone who can reach the app. There are no user accounts, so there is nothing to log in to.
   Anyone able to load the page can create, edit and delete sources.

2. **A source can point at any URL, and the server will fetch it.** There is no allowlist and no
   block on internal addresses, so a source pointed at a link-local or private address (cloud
   instance metadata, an internal admin service, `localhost`) will be fetched *by the server*, and
   the response shown in the sheet. On a cloud host this is a server-side request forgery route to
   credentials and internal services.

3. **Source credentials are stored in plaintext.** An auth header attached to a source is written
   to `data/sources.json` on the server's filesystem. It is masked (`••••••••`) when sent back to
   the browser and is gitignored, so it does not reach the repository — but anyone with read access
   to the host, its backups, or its disk images can read it.

**Consequence:** run it locally, or behind an authenticating proxy on a network you trust. Do not
expose an instance to the public internet while the live-data feature is enabled unless you have
added authentication and restricted which hosts a source may fetch.

These are limitations of the current scope rather than bugs, which is why they are written down
here instead of being reported privately. A report that one of them can be reached in a way this
page does not describe is still worth sending.

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
