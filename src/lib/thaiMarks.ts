// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * Where Thai tone marks have to be moved before a PDF will read correctly.
 *
 * Thai stacks up to two marks over one consonant: an upper vowel (ิ ี ึ ื ั ็ ํ) and, above that, a
 * tone mark (่ ้ ๊ ๋ ์). A font places the second one with an OpenType GPOS mark-to-mark rule, and
 * jsPDF applies no OpenType features at all — it asks the font for each glyph and draws them at the
 * pen position. Both marks carry a zero advance and both outlines sit at the same height, so they
 * land on top of each other: `ที่` comes out looking like `ที`, with the tone mark swallowed whole.
 *
 * This module does the one piece of shaping that matters here, and no more: find the tone marks
 * that need lifting, and say where they are. The caller draws them a second time, higher up.
 *
 * Deliberately not a shaping engine. Reordering, ligatures, the lowered marks that tall consonants
 * (ป ฟ ฬ) want, the narrowed forms after ญ and ฐ — none of that is here, because none of it is what
 * makes Thai unreadable in an exported sheet, and a half-written shaper is worse than an honest
 * single rule.
 */

/** Vowels that sit *above* the consonant, so anything stacked on one has to clear it. */
const UPPER_VOWELS = new Set([
  0x0e31, // ั  MAI HAN AKAT
  0x0e34, // ิ  SARA I
  0x0e35, // ี  SARA II
  0x0e36, // ึ  SARA UE
  0x0e37, // ื  SARA UEE
  0x0e47, // ็  MAITAIKHU
  0x0e4d, // ํ  NIKHAHIT
]);

/** Marks that ride on top: the four tones, plus the two that behave the same way visually. */
const ABOVE_MARKS = new Set([
  0x0e48, // ่  MAI EK
  0x0e49, // ้  MAI THO
  0x0e4a, // ๊  MAI TRI
  0x0e4b, // ๋  MAI CHATTAWA
  0x0e4c, // ์  THANTHAKHAT
  0x0e4e, // ๎  YAMAKKAN
]);

export interface RaisedMark {
  /** The single mark character to draw again, higher. */
  char: string;
  /**
   * The text in front of it, with every raised mark already removed. Its rendered width is the
   * mark's x offset from the start of the string — Thai marks have a zero advance, so removing
   * them changes no width and the offset stays exact.
   */
  prefix: string;
}

export interface ThaiMarkPlan {
  /** The string to draw normally: the original minus the marks that are drawn separately. */
  base: string;
  /** Empty when nothing needs moving, which is the common case and the fast path. */
  raised: RaisedMark[];
}

/** True when a tone mark sits directly on an upper vowel and would otherwise collide with it. */
export function needsRaisedMarks(text: string): boolean {
  for (let i = 1; i < text.length; i++) {
    if (ABOVE_MARKS.has(text.charCodeAt(i)) && UPPER_VOWELS.has(text.charCodeAt(i - 1))) return true;
  }
  return false;
}

/**
 * Splits a string into what can be drawn in one pass and the marks that must be drawn lifted.
 *
 * Only a mark *immediately* after an upper vowel is lifted. One after a lower vowel (`ผู้`) or
 * straight after a consonant (`ป่า`) is already in the right place, and moving it would break what
 * currently works.
 */
export function planThaiMarks(text: string): ThaiMarkPlan {
  if (!needsRaisedMarks(text)) return { base: text, raised: [] };

  let base = "";
  const raised: RaisedMark[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const lifts = i > 0 && ABOVE_MARKS.has(text.charCodeAt(i)) && UPPER_VOWELS.has(text.charCodeAt(i - 1));
    if (lifts) raised.push({ char: ch, prefix: base });
    else base += ch;
  }
  return { base, raised };
}
