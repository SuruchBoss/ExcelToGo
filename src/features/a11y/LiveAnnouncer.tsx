// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useSheetStore } from "@/store/sheetStore";

/**
 * Says out loud what just happened somewhere other than the cursor.
 *
 * The grid announces the cell focus lands on, and that covers moving around. It covers nothing
 * else: sort a column and the rows reorder under a cursor that has not moved; paste and forty
 * cells fill in below the fold; filter and half the sheet disappears. To a screen reader every one
 * of those was silence, and the roadmap entry that came out of the last accessibility pass said so
 * in as many words.
 *
 * **Two regions, alternating.** A screen reader announces a live region when its text *changes*, so
 * sorting the same column twice would write identical text into the same node and be heard once.
 * The sequence number from the store decides which of these two holds the message; the other is
 * emptied. Something always changes, so something is always said.
 *
 * Both are in the DOM from the first render and never unmount. A live region added to the page at
 * the same moment as its content is frequently missed — the announcement has to arrive into a
 * region the screen reader was already watching.
 *
 * `polite`, never `assertive`: none of this is urgent enough to interrupt someone mid-sentence.
 */
export default function LiveAnnouncer() {
  const announcement = useSheetStore((s) => s.announcement);
  const even = (announcement?.seq ?? 0) % 2 === 0;
  const text = announcement?.text ?? "";

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {even ? text : ""}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {even ? "" : text}
      </div>
    </>
  );
}
