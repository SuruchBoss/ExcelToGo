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

/** Reads an autosaved language preference from localStorage once, after the initial render.
 *  Also keeps <html lang> in sync so the page's declared language matches what's on screen. */
export function useHydrateLocaleStore() {
  useEffect(() => {
    useLocaleStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    document.documentElement.lang = useLocaleStore.getState().locale;
    return useLocaleStore.subscribe((s) => {
      document.documentElement.lang = s.locale;
    });
  }, []);
}
