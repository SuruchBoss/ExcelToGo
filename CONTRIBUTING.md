# Contributing to ExcelToGo

Thanks for taking a look. Issues, ideas and pull requests are all welcome — including "this is
confusing" and "this broke for me", which are as useful as code.

By contributing you agree that your contribution is licensed under the
[Apache License 2.0](LICENSE), the same licence as the project.

## Getting it running

Requires **Node.js 20.19+ or 22.12+** (the floor comes from Vite 7, which the test suite runs on).

```bash
npm install
npm run dev        # http://localhost:3000
```

The AI assistant works without any setup, using keyword matching. To connect it to Claude instead,
copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`.

## Before you open a pull request

One command has to be green:

```bash
npm run verify     # lint → check:readme → test → build
```

CI runs exactly these four on every push and pull request, across Node 20.19, 22.12 and 24, so
running it first is faster than waiting to be told.

`npm run check:readme` is a dependency-free script that checks the two READMEs against the repo:
that internal links resolve, that referenced screenshots exist and none are orphaned, that quoted
test counts match the suite, that every `src/lib` module appears in the structure listing, and that
the Thai and English feature lists stay in step.

## House rules

The full set lives in [`AGENTS.md`](AGENTS.md). The ones worth knowing up front:

- **Both READMEs change together.** `README.md` is Thai, `README.en.md` is English. A feature
  documented in one and not the other is a bug the check script will catch.
- **A user-facing feature needs its own section under Features**, with a screenshot if it's visual.
  Screenshots are taken from a production build (`npm run build && npm run start`), never
  `next dev`, whose overlay ends up in the image.
- **Numbers you claim must come from counting.** Test counts, formula counts, function counts. A
  wrong one has shipped before.
- **State the limits.** "X isn't supported" is worth more than silence.
- Tests live next to what they test, as `*.test.ts`, and run under Vitest.

## Where things are

```
src/lib/formulaEngine/   tokenizer → parser → evaluator → functions (no third-party formula library)
src/lib/                 sheet model, Excel/PDF I/O, conditional formatting, sorting, templates
src/features/            UI by feature: grid, toolbar, formulas, data, ai
src/i18n/                th.ts and en.ts, with types.ts enforcing key parity at build time
```

Adding a formula means three places: the implementation in `formulaEngine/functions.ts`, an entry
in `formulaCatalog.ts` so it appears in the palette, and its text in **both** `i18n/th.ts` and
`i18n/en.ts`. A test in `formulaCatalog.test.ts` checks that last part for you.

## Developer Certificate of Origin (DCO)

Contributions are accepted under the project's license (see [LICENSE](LICENSE) and, where a
directory has its own, that directory's license). So that the origin of every change is clear,
**each commit in a pull request from a fork must be signed off** under the Developer Certificate
of Origin 1.1. CI checks it (`.github/workflows/license-check.yml`).

Sign off with `git commit -s`. It adds a line with the name and email of the commit's author:

```
Signed-off-by: Your Name <you@example.com>
```

By signing off you certify the following (the full text of the DCO, from
<https://developercertificate.org/>):

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

A sign-off is a statement made by a person. Automated tools and AI agents do not sign off on
anyone's behalf; the person who submits their work does.

## File headers

Every source file starts with its copyright and license identifier, for example:

```ts
// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0
```

`node scripts/license-headers.mjs --fix` adds it to new files; CI fails a file without it.
Applied database migrations are exempt, because editing one changes its recorded checksum.

## Reporting a security issue

Please don't open a public issue — see [SECURITY.md](SECURITY.md), which also describes the
limitations that are already known and deliberate.
