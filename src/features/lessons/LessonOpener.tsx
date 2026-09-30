// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { create } from "zustand";
import { selectHasWork, useSheetStore } from "@/store/sheetStore";
import { useTabStore } from "@/store/tabStore";
import { lessonBySlug } from "@/lib/lessons";
import { useT } from "@/i18n";
import ImportChoiceDialog from "@/features/toolbar/ImportChoiceDialog";

/** The example waiting on the "open it how?" question, if any. Outside React state because it is
 *  decided in an effect, once the tab knows whether it edits. */
const useAsking = create<{ slug: string | null }>(() => ({ slug: null }));

/**
 * Opens a formula page's example when the app is reached through its "ลองในตาราง" (#149).
 *
 * The link carries a lesson's name and nothing else: `/app?lesson=sumif`. The table itself comes
 * from the lessons built into the app, so a link someone makes up cannot put anything of theirs in
 * a sheet — a name the app does not know is dropped without a word.
 *
 * It opens the way a file does, because that is what it is to the person's work:
 * - with no work in this browser (a blank sheet or the untouched sample), it opens straight away;
 * - with work, the same question a file asks, with "keep what is open" focused (PO, #149);
 * - either way, one undo takes it back out.
 *
 * It waits for the autosave to be read, or "is there work here?" would be answered before the work
 * had loaded; and for this tab to be the one that edits. A tab that ends up only looking (#47) does
 * not open it — its own notice is the one thing it should be saying.
 *
 * The name is taken off the address as soon as it is read, so reloading the app does not open the
 * example a second time.
 */
export default function LessonOpener() {
  const t = useT();
  const role = useTabStore((s) => s.role);
  const hydrated = useSyncExternalStore(
    (onChange) => useSheetStore.persist.onFinishHydration(onChange),
    () => useSheetStore.persist.hasHydrated(),
    () => false
  );
  // From Next's own view of the address rather than `window.location`: "ลองในตาราง" is a client-side
  // navigation, and while this page first renders the window can still be showing the formula page.
  const named = useSearchParams().get("lesson");
  const wanted = useRef<string | null>(null);
  const asking = useAsking((s) => s.slug);

  useEffect(() => {
    if (named === null) return;
    if (lessonBySlug(named)) wanted.current = named;
    const url = new URL(window.location.href);
    url.searchParams.delete("lesson");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [named]);

  useEffect(() => {
    const slug = wanted.current;
    if (!slug || !hydrated || role === "starting" || role === "asking") return;
    wanted.current = null;
    // The work here is another tab's, and this tab is only looking at it.
    if (role !== "editor") return;
    if (selectHasWork(useSheetStore.getState())) useAsking.setState({ slug });
    else useSheetStore.getState().openLesson(slug, "replace");
  }, [hydrated, role, named]);

  const lesson = asking ? lessonBySlug(asking) : undefined;
  if (!lesson) return null;
  const close = () => useAsking.setState({ slug: null });
  return (
    <ImportChoiceDialog
      fileName={t.importChoice.lessonFile(lesson.id)}
      sheets={useSheetStore.getState().sheets.length}
      onCancel={close}
      onChoose={(mode) => {
        useSheetStore.getState().openLesson(lesson.slug, mode);
        close();
      }}
    />
  );
}
