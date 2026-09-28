// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * What a tap on a cell does to the formula being typed (#99).
 *
 * The text only: which characters go where. Nothing here reads or computes a formula — the address
 * is written into the draft exactly as if it had been typed, and the draft is saved the same way.
 */

/** Where the address a tap put into the draft sits, so the next tap can take its place. */
export interface PointSpan {
  start: number;
  end: number;
  /** The address as written, to tell whether someone has typed over it since. */
  ref: string;
}

export interface PointResult {
  text: string;
  span: PointSpan;
}

/** An address or a range as a person or a tap writes it: `C5`, `$C$5`, `C2:C10`. */
const TRAILING_REF = /\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?$/;
/** What may stand right before an address: the start of the formula, a bracket, a separator, an operator. */
const BEFORE_REF = new Set(["=", "(", ",", ";", ":", "+", "-", "*", "/", "^", "&", "<", ">", " "]);

/**
 * The draft after a tap on the cell `ref`, with the caret (or selection) at `selStart`–`selEnd`.
 *
 * - Straight after a tap, a second tap replaces the first address rather than running into it:
 *   C5 then D7 gives `=D7`, never `=C5D7` — Google Sheets does the same on a phone.
 * - Right after an address typed by hand, the tap replaces that address, for the same reason.
 * - Anywhere else the address goes in at the caret, replacing any selected text.
 */
export function pointInto(text: string, selStart: number, selEnd: number, ref: string, last?: PointSpan | null): PointResult {
  let start = selStart;
  const end = selEnd;
  if (selStart === selEnd) {
    if (last && last.end === selStart && text.slice(last.start, last.end) === last.ref) {
      start = last.start;
    } else {
      const typed = TRAILING_REF.exec(text.slice(0, selStart));
      if (typed) {
        const from = selStart - typed[0].length;
        if (from > 0 && BEFORE_REF.has(text[from - 1])) start = from;
      }
    }
  }
  const next = text.slice(0, start) + ref + text.slice(end);
  return { text: next, span: { start, end: start + ref.length, ref } };
}

/** The draft with the address a tap put in widened to `ref` — the grip dragged from C2 to C10. */
export function widenPoint(text: string, span: PointSpan, ref: string): PointResult {
  if (text.slice(span.start, span.end) !== span.ref) return { text, span };
  const next = text.slice(0, span.start) + ref + text.slice(span.end);
  return { text: next, span: { start: span.start, end: span.start + ref.length, ref } };
}

/** The draft with `chars` typed at the caret — the pointing bar's bracket and operator keys. */
export function typeInto(text: string, selStart: number, selEnd: number, chars: string): { text: string; caret: number } {
  return { text: text.slice(0, selStart) + chars + text.slice(selEnd), caret: selStart + chars.length };
}

/**
 * The formula with the closing brackets it is missing, as Excel adds them when a formula is
 * entered: `=SUM(C2:C10` saves as `=SUM(C2:C10)`. Brackets inside a string are text. Only a
 * formula is touched; anything else, and a formula with a bracket too many, stays as typed.
 */
export function closeBrackets(text: string): string {
  if (!text.startsWith("=")) return text;
  let depth = 0;
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "(") depth++;
    else if (!quoted && ch === ")") depth--;
  }
  return depth > 0 && !quoted ? text + ")".repeat(depth) : text;
}
