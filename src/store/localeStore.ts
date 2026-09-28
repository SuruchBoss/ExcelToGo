// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_LOCALE, Locale } from "@/i18n/types";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "exceltogo-locale",
      storage: createJSONStorage(() => localStorage),
      // Same reasoning as useHydrateSheetStore: read localStorage only after the first client
      // render so the server-rendered HTML (always DEFAULT_LOCALE) matches the client's initial
      // render, avoiding a React hydration mismatch.
      skipHydration: true,
    }
  )
);

/**
 * The language a first visit gets, from the languages the browser says its person reads.
 *
 * Thai if Thai is anywhere in the list, English otherwise: an English browser used to get the Thai
 * page, with a small "TH / EN" in the corner as the only way out (blind test U15). Anyone who has
 * pressed that button keeps their choice — this only answers when nothing was ever chosen.
 */
export function pickLocale(languages: readonly string[]): Locale {
  return languages.some((l) => l.toLowerCase().startsWith("th")) ? "th" : "en";
}

/**
 * The browser tab's title in each language. The metadata is Thai, because that is what a crawler
 * and a first render get; after that the tab follows the language on screen like everything else.
 */
const TITLES: Record<Locale, { home: string; guide: string }> = {
  th: {
    home: "ExcelToGo — พิมพ์เป็นภาษาไทย แล้วได้สูตร Excel ที่ใช้ได้จริง",
    guide: "คู่มือต่อข้อมูลของคุณเอง · ExcelToGo",
  },
  en: {
    home: "ExcelToGo — describe it in plain words, get a working Excel formula",
    guide: "Connect your own data · ExcelToGo",
  },
};

const syncDocument = (locale: Locale) => {
  document.documentElement.lang = locale;
  document.title = TITLES[locale][window.location.pathname.startsWith("/guide") ? "guide" : "home"];
};

/** Reads an autosaved language preference from localStorage once, after the initial render — or,
 *  on a first visit, takes the browser's. Also keeps <html lang> and the tab title in sync with
 *  what is on screen. */
export function useHydrateLocaleStore() {
  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem("exceltogo-locale") !== null;
    } catch {
      // Storage refused (a private window, blocked site data): fall through to the browser's.
    }
    void Promise.resolve(useLocaleStore.persist.rehydrate()).then(() => {
      if (!stored) useLocaleStore.getState().setLocale(pickLocale(navigator.languages ?? [navigator.language]));
    });
  }, []);

  useEffect(() => {
    syncDocument(useLocaleStore.getState().locale);
    return useLocaleStore.subscribe((s) => syncDocument(s.locale));
  }, []);
}
