import { useLocaleStore } from "@/store/localeStore";
import { MESSAGES } from "./messages";
import { Locale, Messages } from "./types";

export { MESSAGES } from "./messages";
export type { Locale, Messages, CategoryKey, FormulaMessage } from "./types";
export { LOCALES, DEFAULT_LOCALE } from "./types";

/** Current UI language, reactive to changes (re-renders the calling component). */
export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}

/** Current UI messages, reactive to language changes. Use inside React components. */
export function useT(): Messages {
  const locale = useLocale();
  return MESSAGES[locale];
}

/** Non-reactive access to the current messages — for use outside React components (e.g. the
 *  Zustand store's actions), where hooks aren't available. Reads the locale store's latest
 *  value at call time rather than subscribing to it. */
export function getMessages(): Messages {
  return MESSAGES[useLocaleStore.getState().locale];
}
