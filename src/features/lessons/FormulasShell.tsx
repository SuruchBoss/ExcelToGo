// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import Link from "next/link";
import { th } from "@/i18n/th";

/**
 * The frame every formula page shares: a header with the way back and the way into the app, and
 * the breadcrumb that says where the page sits.
 *
 * A server component with Thai written in, like the pages it wraps (#149). No language store, no
 * toggle: these pages are Thai until they have English URLs of their own, and a client bundle for
 * a toggle that could only say one thing is weight for nothing.
 */
export default function FormulasShell({
  trail,
  children,
}: {
  /** Breadcrumb steps before the current page, which is named last and not linked. */
  trail: { name: string; href?: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 bg-paper text-ink">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {th.app.skipToContent}
      </a>
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-8">
          <Link href="/" className="font-mono text-[13px] font-semibold tracking-[0.02em] text-ink hover:text-ledger-ink">
            {th.app.brand}
          </Link>
          <div className="flex-1" />
          <Link href="/app" className="inline-flex min-h-11 items-center bg-ledger px-4 text-[13.5px] font-medium text-white hover:bg-ledger-ink sm:min-h-0 sm:py-2.5">
            {th.landing.backToApp}
          </Link>
        </div>
      </header>
      <nav aria-label="ตำแหน่งของหน้านี้" className="mx-auto max-w-4xl px-4 pt-5 sm:px-8">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ash">
          {trail.map((step, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={step.name} className="flex items-center gap-1.5">
                {step.href && !last ? (
                  <Link href={step.href} className="inline-flex min-h-6 items-center underline-offset-2 hover:text-ink hover:underline">
                    {step.name}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-ink" : undefined}>
                    {step.name}
                  </span>
                )}
                {!last && (
                  <span aria-hidden className="font-mono text-[11px]">
                    ›
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-4 pb-20 pt-6 outline-none sm:px-8">
        {children}
      </main>
    </div>
  );
}
