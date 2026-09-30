// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useSyncExternalStore } from "react";

/**
 * A way to crash the app on purpose, for the gates only (#145).
 *
 * The rescue screen is what a person sees on the worst day, so it needs pictures and gates like any
 * other screen — and to reach it something has to throw. The screenshot scene used to get there by
 * saving a workbook in an old format the app could not read; #139 taught the app to read it, and
 * the scene quietly stopped reaching the screen. A crash that depends on a bug lasts until the bug
 * is fixed, so this one depends on nothing but being asked.
 *
 * It is in every build, including production, because the gates test the build that ships. What
 * keeps it from being a switch a person can hit is that two things must both be true: the browser
 * is being driven by automation (`navigator.webdriver`, which WebDriver and CDP set and no browser a
 * person uses does), and this tab's `sessionStorage` asks for it. Someone who can do both is already
 * driving their own page and could make it throw any way they liked.
 */
export const CRASH_TEST_KEY = "exceltogo:crash-test";

export function crashTestAsked(
  nav: { webdriver?: boolean } | undefined,
  storage: Pick<Storage, "getItem"> | undefined
): boolean {
  if (nav?.webdriver !== true || !storage) return false;
  try {
    return storage.getItem(CRASH_TEST_KEY) === "1";
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};
const onClient = () =>
  crashTestAsked(typeof navigator === "undefined" ? undefined : navigator, typeof window === "undefined" ? undefined : window.sessionStorage);
const onServer = () => false;

/** Throws while rendering when a gate asked for it, so the nearest error boundary takes over. */
export function CrashTest() {
  if (useSyncExternalStore(noSubscribe, onClient, onServer)) throw new Error("ExcelToGo crash test (#145)");
  return null;
}
