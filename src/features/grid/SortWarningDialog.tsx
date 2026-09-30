// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";
import AskFirstDialog from "./AskFirstDialog";

/**
 * Asked before a sort that would give formulas another row's numbers (#48).
 *
 * A formula that only uses its own row moves with the row and stays right. One that points at
 * another row — a running total, a grand total caught in the range — cannot come through a sort
 * right in any spreadsheet. Excel sorts it without a word; the blind test showed what that costs
 * (a total 2,710 baht off, and a tester going back to Excel). So the question is asked, with Cancel
 * under the cursor, and "sort anyway" still there for the person who means it.
 */
export default function SortWarningDialog() {
  const t = useT();
  const warning = useSheetStore((s) => s.sortWarning);
  const dismiss = useSheetStore((s) => s.dismissSortWarning);
  const sortSelection = useSheetStore((s) => s.sortSelection);
  if (!warning) return null;
  return (
    <AskFirstDialog
      title={t.sortWarning.title}
      body={t.sortWarning.body(warning.formulas)}
      proceed={t.sortWarning.sortAnyway}
      cancel={t.sortWarning.cancel}
      onProceed={() => sortSelection(warning.ascending, true)}
      onCancel={dismiss}
    />
  );
}
