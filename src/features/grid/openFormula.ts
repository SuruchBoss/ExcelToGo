// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Is this draft a formula still waiting for a cell address?
 *
 * `=`, `=SUM(`, `=A1+` — the moments Excel calls "point mode", where clicking a cell puts its
 * address into the formula. Here that click saved the half-typed formula into the cell being
 * edited and moved on: on a phone, typing `=` and tapping C5 left `=` in the cell, and in the
 * sample sheet it wrote over the word that was there (#99, sev:critical).
 *
 * Until tapping a cell inserts its address (the pointing bar, next), a click or tap on the grid
 * while this is true does nothing at all: the editor stays open and the cell keeps its value. A
 * finished formula — `=SUM(A1:A3)`, caret after the bracket — is not waiting, so clicking another
 * cell still saves it and moves, as it always has.
 */
const WAITS_AFTER = new Set(["=", "(", ",", ";", ":", "+", "-", "*", "/", "^", "&", "<", ">"]);

export function awaitsOperand(draft: string | null | undefined): boolean {
  if (!draft?.startsWith("=")) return false;
  // Inside an unclosed string the comma is text, not a separator: `="a,` is waiting for a quote.
  if ((draft.match(/"/g)?.length ?? 0) % 2 === 1) return false;
  return WAITS_AFTER.has(draft.trimEnd().slice(-1));
}
