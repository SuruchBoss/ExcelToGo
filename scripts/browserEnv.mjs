// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * The environment every gate launches Chromium with: the caller's own, with a UTF-8 locale when it
 * has none.
 *
 * Under a POSIX locale (a container, a CI image, the QA machine) Chromium cannot name a download
 * with a character outside ASCII, so a sheet called `ยอดขาย` exports as a file called `download`.
 * The app did nothing wrong; the gate saw a bug that is not there — QA's blind test round 2 filed
 * one. `C.UTF-8` exists in every glibc image without installing a locale, and a caller that
 * already runs in UTF-8 (a developer's laptop) is left as it is.
 */
export function browserEnv(env = process.env) {
  const hasUtf8 = [env.LC_ALL, env.LC_CTYPE, env.LANG].some((v) => /utf-?8/i.test(v ?? ""));
  return hasUtf8 ? { ...env } : { ...env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" };
}
