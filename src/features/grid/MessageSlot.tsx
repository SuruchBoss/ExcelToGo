// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { useSyncExternalStore } from "react";
import { getSaveStatus, subscribeSaveStatus } from "@/lib/saveHealth";
import { selectHasWork, selectPivotStatus, selectShowingSample, useSheetStore } from "@/store/sheetStore";
import SaveFailedNotice from "./SaveFailedNotice";
import PivotNotice from "./PivotNotice";
import SampleNotice from "./SampleNotice";
import StartNotice from "./StartNotice";
import StorageNotice from "./StorageNotice";
import ViewOnlyNotice from "@/features/otherTab/ViewOnlyNotice";
import { useTabStore } from "@/store/tabStore";

/**
 * The one place above the grid a message may take, and one message at a time (#129).
 *
 * Each notice here was right on its own and they stacked: on a phone after opening a file, the
 * storage warning and the import message took 170px and left ten rows of grid. Now the most
 * pressing one shows and the rest wait:
 *
 * 1. this tab is only looking (#47) — every edit made here is refused, and nothing else explains why:
 *    an edit that silently does nothing is the most confusing state the app has (PO, #129: "การแก้ที่ถูก
 *    ปฏิเสธโดยไม่มีคำอธิบายคือกรณีที่งงที่สุด"). The same slot says, once, that the editing tab closed
 *    and this one edits now (#146), since a notice still claiming otherwise would be just as confusing;
 * 2. a save that failed — the work on screen will not survive a reload;
 * 3. a pivot whose source has moved — **the numbers on screen are wrong**, which outranks any advice
 *    about the app (PO, #129: "pivot ล้าสมัยคือตัวเลขบนจอไม่ตรง จึงสำคัญกว่าข้อความแนะนำ");
 * 4. the sample, or the way to it on an empty workbook — what the grid is showing;
 * 5. "saved in this browser only" — general advice, one line, once.
 *
 * The file-open message is not here: it floats over the foot of the grid (`ImportNotice`).
 */
export default function MessageSlot() {
  // The same notice also says, once, that the editing tab closed and this one edits now (#146).
  const viewOnly = useTabStore((s) => s.role === "viewer" || s.role === "handedOff" || (s.freed && s.role === "editor"));
  const saveStatus = useSyncExternalStore(subscribeSaveStatus, getSaveStatus, () => "ok" as const);
  const pivot = useSheetStore(selectPivotStatus);
  const showingSample = useSheetStore(selectShowingSample);
  const hasWork = useSheetStore(selectHasWork);

  if (viewOnly) return <ViewOnlyNotice />;
  if (saveStatus !== "ok") return <SaveFailedNotice />;
  if (pivot !== null && pivot !== "fresh") return <PivotNotice />;
  if (showingSample) return <SampleNotice />;
  if (!hasWork) return <StartNotice />;
  return <StorageNotice />;
}
