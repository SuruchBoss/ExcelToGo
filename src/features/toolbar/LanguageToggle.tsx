"use client";

import clsx from "clsx";
import { useT } from "@/i18n";
import { useLocaleStore } from "@/store/localeStore";

/**
 * Switches the whole app's language.
 *
 * Shows **both** language codes with the active one lit, rather than the one-word toggle it used
 * to be. That button read "EN" while the page was Thai — the convention where the label names the
 * language you are switching *to* — and the project's own author read it as "the page is in
 * English" and reported the page as broken. If the person who wrote the app misreads it, a first
 * time visitor has no chance. Two codes with one of them clearly current cannot be read the wrong
 * way round.
 *
 * Still one button, so the control keeps a single tab stop and one accessible name that says what
 * pressing it does rather than just naming a language.
 *
 * `className` lets the landing page opt out of the toolbar's zinc-and-rounded look, which would
 * read as a stray widget among that page's squared, ruled controls.
 */
export default function LanguageToggle({ className }: { className?: string } = {}) {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  // The active code is marked by *adding* emphasis, never by dimming the other one. Dimming was the
  // first attempt and the a11y gate rejected it: this button's text is already a muted grey on the
  // landing page, and 45% opacity on top of that failed contrast outright. Getting back over the
  // threshold would have meant ~88% opacity, which is not a difference anyone can see — so the
  // mechanism was wrong, not the number.
  const code = (lang: "th" | "en", label: string) => (
    <span className={clsx("transition-colors", locale === lang && "font-semibold underline underline-offset-4")}>
      {label}
    </span>
  );

  return (
    <button
      onClick={() => setLocale(locale === "th" ? "en" : "th")}
      title={t.app.languageToggleTitle}
      aria-label={t.app.languageToggleTitle}
      className={
        className ??
        "flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:min-h-0 sm:py-1.5"
      }
    >
      {code("th", "TH")}
      <span aria-hidden className="font-normal">/</span>
      {code("en", "EN")}
    </button>
  );
}
