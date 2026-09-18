"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { X, Keyboard } from "lucide-react";
import { SHORTCUT_GROUPS, formatKey, isAppleKeyboard } from "@/lib/keyboardShortcuts";
import { useT } from "@/i18n";

/**
 * The shortcut sheet.
 *
 * Rendered only while open, which is what lets it read `navigator` directly for the ⌘-or-Ctrl
 * question: there is no server render of this subtree for a client-only value to disagree with.
 */
export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  /** Where focus was when this opened, so it can be put back. */
  const openerRef = useRef<HTMLElement | null>(null);

  const apple = useMemo(
    () => (typeof navigator === "undefined" ? false : isAppleKeyboard(navigator.platform, navigator.userAgent)),
    []
  );

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const opener = openerRef.current;
    return () => opener?.focus?.();
  }, []);

  /**
   * Escape closes, and Tab stays inside.
   *
   * A dialog you can Tab out of is a dialog a keyboard user loses — and on a page whose entire
   * point is keyboard shortcuts, that would be a poor first impression. `capture` so Escape is
   * seen before the grid's own Escape handling gets it.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const stops = [...panel.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')].filter(
        (el) => el.offsetParent !== null
      );
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const here = document.activeElement;
      if (!e.shiftKey && here === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (here === first || here === panel)) {
        e.preventDefault();
        last.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const keys = (combo: string[]) =>
    combo.map((token) =>
      token === "AnyKey" ? (
        <span key={token} className="text-xs text-zinc-500">
          {t.shortcuts.anyKey}
        </span>
      ) : (
        <kbd
          key={token}
          className="rounded border border-zinc-300 border-b-2 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-zinc-700"
        >
          {formatKey(token, apple)}
        </kbd>
      )
    );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div onClick={onClose} aria-hidden className="absolute inset-0 bg-zinc-900/40" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:max-h-[86vh] sm:max-w-3xl sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-5">
          <div>
            <h2 id={titleId} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
              <Keyboard size={16} className="text-emerald-600" /> {t.shortcuts.title}
            </h2>
            <p className="text-xs text-zinc-500">{t.shortcuts.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.shortcuts.close}
            className="-mr-1 flex min-h-11 min-w-11 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 sm:min-h-9 sm:min-w-9"
          >
            <X size={17} />
          </button>
        </div>

        {/* tabIndex on the scroller: below about 900px tall the list scrolls, and a scrollable
            region with no focusable content inside it is one a keyboard user cannot scroll at all
            — the arrow keys need somewhere to be aimed. It is also the dialog's second tab stop,
            which is what makes the Tab trap above observable rather than a loop of one. */}
        <div tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 sm:px-5 sm:py-4">
          {/* A grid rather than CSS columns: columns balance by flowing, and with whole groups that
              cannot be split they flowed 10 rows into the left column and 15 into the right, so the
              left one stopped a third of the way up. A grid pairs the groups deliberately — see the
              order they are declared in. One column on a phone, where a sideways-scrolling table
              would be worse than a long list. */}
          <div className="sm:grid sm:grid-cols-2 sm:gap-x-8">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.id} className="mb-5 break-inside-avoid">
                {/* zinc-500, not zinc-400: at 11px these are normal-size text and need 4.5:1.
                    zinc-400 on white measures 2.62 — caught by running axe against the dialog while
                    it was open, which the CI gate cannot do because it only ever sees the page as
                    it loads. */}
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {t.shortcuts.groups[group.id]}
                </h3>
                <dl>
                  {group.shortcuts.map((s) => (
                    <div key={s.id} className="flex items-baseline justify-between gap-3 border-b border-zinc-100 py-1.5 last:border-0">
                      <dt className="text-xs text-zinc-600">{t.shortcuts.items[s.id]}</dt>
                      <dd className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                        {s.combos.map((combo, i) => (
                          <span key={combo.join("+")} className="flex items-center gap-1">
                            {i > 0 && <span className="px-0.5 text-[10px] text-zinc-500">/</span>}
                            {keys(combo)}
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
