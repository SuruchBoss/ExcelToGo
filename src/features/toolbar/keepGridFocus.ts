// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Lets a toolbar button be pressed without taking focus from the grid.
 *
 * Clicking Bold, "+ Row" or Undo used to leave focus on that button, so the arrow keys and Delete
 * pressed next went nowhere until the person clicked back into a cell (#102, blind test L5). A
 * mouse-down that does not move focus is how spreadsheets do it: the click still fires, the cursor
 * stays where it was. Only for a mouse's main button on a `<button>` — a select, an input, a right
 * click and the keyboard all behave as they always have, and Tab still reaches every button.
 */
export function keepGridFocus(e: React.MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest("button") && !target.closest("select, input, textarea")) e.preventDefault();
}
