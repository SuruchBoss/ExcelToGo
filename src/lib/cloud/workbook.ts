/**
 * What a saved workbook looks like in the database, and the rules around reading one back.
 *
 * Kept apart from the Supabase client so the shape and the conflict rule can be tested without a
 * network or a project to point at — which matters here, because nobody running this repo's tests
 * has a database.
 */
import { SheetTab } from "@/store/sheetStore";

/** Bumped when the stored shape changes in a way an older app couldn't read. */
export const WORKBOOK_FORMAT = 1;

export interface CloudWorkbookRow {
  id: string;
  name: string;
  /** ISO timestamp the server stamped on the last write. */
  updated_at: string;
  data: {
    format: number;
    sheets: SheetTab[];
  };
}

/** The listing view: enough to choose one, without pulling every sheet down. */
export interface CloudWorkbookSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export function toSummary(row: Pick<CloudWorkbookRow, "id" | "name" | "updated_at">): CloudWorkbookSummary {
  return { id: row.id, name: row.name, updatedAt: row.updated_at };
}

export function workbookPayload(sheets: SheetTab[]): CloudWorkbookRow["data"] {
  return { format: WORKBOOK_FORMAT, sheets };
}

/**
 * The tabs out of a stored row, or null when it isn't something this version can open.
 *
 * A row written by a newer app is refused rather than half-read: opening it would silently drop
 * whatever the newer format added, and the user would find out by noticing their work missing.
 */
export function readWorkbook(data: unknown): SheetTab[] | null {
  if (!data || typeof data !== "object") return null;
  const body = data as Partial<CloudWorkbookRow["data"]>;
  if (typeof body.format !== "number" || body.format > WORKBOOK_FORMAT) return null;
  if (!Array.isArray(body.sheets) || body.sheets.length === 0) return null;
  return body.sheets;
}

/**
 * Whether saving over a workbook would overwrite someone else's newer edit.
 *
 * Two devices signed into one account is the ordinary case, not an exotic one, and last-write-wins
 * with no warning loses work silently. The app knows when it last read the row; if the server has
 * moved on since, the save asks first.
 */
export function wouldOverwriteNewer(seenAt: string | null, serverUpdatedAt: string | null): boolean {
  if (!seenAt || !serverUpdatedAt) return false;
  const seen = Date.parse(seenAt);
  const server = Date.parse(serverUpdatedAt);
  // An unparseable timestamp is treated as "can't tell", and not telling is better than a false
  // alarm every save.
  if (Number.isNaN(seen) || Number.isNaN(server)) return false;
  return server > seen;
}
