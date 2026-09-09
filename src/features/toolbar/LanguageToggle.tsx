"use client";

import { Languages } from "lucide-react";
import { useT } from "@/i18n";
import { useLocaleStore } from "@/store/localeStore";

/** Switches the whole app's language. Shows the *other* language's name (e.g. "EN" while
 *  Thai is active) since that's what clicking it will switch to — the common toggle-button
 *  convention, so the button never needs its own translated label. */
export default function LanguageToggle() {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <button
      onClick={() => setLocale(locale === "th" ? "en" : "th")}
      title={t.app.languageToggleLabel}
      className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
    >
      <Languages size={15} /> {t.app.languageToggleLabel}
    </button>
  );
}
