// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { Keyboard } from "lucide-react";
import ShortcutsDialog from "./ShortcutsDialog";
import { useShortcutsDialog } from "./useShortcutsDialog";
import { useT } from "@/i18n";

/**
 * The way in to the shortcut sheet: one button, and the key that opens it from anywhere.
 *
 * Button, dialog and hook travel together so whichever bar it lands in needs one import and no
 * state of its own — and it went through two bars. The toolbar was the obvious place and the wrong
 * one: measured at 1360px, that row fitted its thirteen buttons with nothing to spare, and adding
 * this one pushed 42px past the edge, clipping the language toggle on every laptop under 1440.
 * The sheet-tab strip has the room, and a help button at the end of a status bar is where people
 * already look for one.
 */
export default function ShortcutsButton() {
  const t = useT();
  const { open, setOpen, close } = useShortcutsDialog();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t.shortcuts.open}
        title={`${t.shortcuts.open} (Ctrl+/)`}
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 sm:h-7 sm:w-7"
      >
        <Keyboard size={16} />
      </button>
      {open && <ShortcutsDialog onClose={close} />}
    </>
  );
}
