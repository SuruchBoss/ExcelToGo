import { Messages } from "@/i18n/types";
import { CellValue, TableData } from "@/lib/dataSources/types";
import { LiveAggregate } from "@/lib/liveBlocks";

/** Plain-language name for a single value pulled out of a source, e.g. "รวม total" / "Total total".
 *  A row count has no column to name, and a single-row payload's field speaks for itself. */
export function valueLabel(t: Messages, table: TableData | undefined, column: string, aggregate: LiveAggregate): string {
  if (aggregate === "count") return t.data.aggregate.count;
  const label = table?.columns.find((c) => c.key === column)?.label ?? column;
  if (aggregate === "first") return label;
  return `${aggregate === "sum" ? t.data.aggregate.sum : t.data.aggregate.avg} ${label}`;
}

/** Formats a cell value for display in the panel/picker (thousands separators, blanks stay blank). */
export function formatValue(v: CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v.toLocaleString("en-US");
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return v;
}
