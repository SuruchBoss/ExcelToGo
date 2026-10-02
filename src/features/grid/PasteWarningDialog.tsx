// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import AskFirstDialog from "./AskFirstDialog";

/**
 * Asked before a paste lands on rows a filter hides (#50, PO's call).
 *
 * A paste into a filtered range goes down in one piece, over the hidden rows as well as the ones on
 * screen — Excel does the same. It is still data changed where nobody can see it, which is the kind
 * of loss this sprint exists to remove, so the paste waits for a yes. Delete, copy and fill already
 * skip hidden rows; a paste cannot, because its rows have to land somewhere.
 */
export default function PasteWarningDialog() {
  const t = useT();
  const warning = useSheetStore((s) => s.pasteWarning);
  const dismiss = useSheetStore((s) => s.dismissPasteWarning);
  const pasteAtSelection = useSheetStore((s) => s.pasteAtSelection);
  if (!warning) return null;
  return (
    <AskFirstDialog
      title={t.pasteWarning.title}
      body={t.pasteWarning.body(warning.hidden)}
      proceed={t.pasteWarning.pasteAnyway}
      cancel={t.pasteWarning.cancel}
      onProceed={() => {
        // Closed here rather than by the paste, so a paste a template refuses still closes it.
        pasteAtSelection(warning.text, true);
        dismiss();
      }}
      onCancel={dismiss}
    />
  );
}
