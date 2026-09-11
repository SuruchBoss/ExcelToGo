"use client";

import { useDataSourceStore } from "@/store/dataSourceStore";
import { useLiveBlocks, useSheetStore } from "@/store/sheetStore";
import DataPickerDialog from "./DataPickerDialog";

/** Renders the picker wherever the store says it's open, so the side panel and a block's own
 *  toolbar can both raise it without owning the dialog. */
export default function DataPicker() {
  const picker = useSheetStore((s) => s.dataPicker);
  const close = useSheetStore((s) => s.closeDataPicker);
  const sources = useDataSourceStore((s) => s.sources);
  const blocks = useLiveBlocks();

  if (!picker) return null;
  const source = sources.find((s) => s.id === picker.sourceId);
  if (!source) return null;

  return (
    <DataPickerDialog
      source={source}
      replacing={picker.replacingBlockId ? blocks.find((b) => b.id === picker.replacingBlockId) : undefined}
      onClose={close}
    />
  );
}
