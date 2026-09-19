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
  /** The account that created it. A member may read and edit; only this account may share it. */
  user_id: string;
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
  /**
   * Who it belongs to.
   *
   * The listing holds workbooks shared with this person as well as their own, and the two are not
   * interchangeable: only an owner can invite, remove or delete. Carried here so the UI can say
   * which is which instead of offering a button that the database will refuse.
   */
  ownerId: string;
}

export function toSummary(row: Pick<CloudWorkbookRow, "id" | "name" | "updated_at" | "user_id">): CloudWorkbookSummary {
  return { id: row.id, name: row.name, updatedAt: row.updated_at, ownerId: row.user_id };
}

/**
 * One earlier state of a workbook, as the listing shows it.
 *
 * `data` is left out: a version is a whole copy of the document, and pulling twenty of them down
 * to draw a list of dates would move megabytes to render kilobytes.
 */
export interface WorkbookVersion {
  id: string;
  /** The name it had *then*. A version labelled with the current name cannot be told from its neighbours. */
  name: string;
  createdAt: string;
  savedBy: string | null;
}

/**
 * How a version is described in the list.
 *
 * Relative for anything recent, because "2 hours ago" answers the question people are actually
 * asking — is this the one from before lunch — and an ISO timestamp does not. Absolute past a
 * week, where "9 days ago" stops being easier to place than a date.
 */
export function describeVersionAge(createdAt: string, now: Date, locale: "th" | "en"): string {
  const then = Date.parse(createdAt);
  if (Number.isNaN(then)) return createdAt;
  const minutes = Math.floor((now.getTime() - then) / 60_000);
  if (minutes < 1) return locale === "th" ? "เมื่อครู่" : "just now";
  if (minutes < 60) return locale === "th" ? `${minutes} นาทีที่แล้ว` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === "th" ? `${hours} ชั่วโมงที่แล้ว` : `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return locale === "th" ? `${days} วันที่แล้ว` : `${days} d ago`;
  return new Date(then).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB");
}

/** One person a workbook has been shared with. */
export interface WorkbookMember {
  email: string;
  invitedAt: string;
}

/**
 * Whether a string is worth sending to the database as an invitation.
 *
 * Deliberately loose. The strict thing to do is reject anything that is not a valid address, and
 * the strict thing is wrong here: an invitation is checked against whoever signs in, so a typo
 * costs a row that nobody ever matches, while a rule that is too clever rejects a real address
 * somebody actually uses. This refuses what cannot possibly work and lets the rest through.
 */
export function isInvitableEmail(value: string): boolean {
  const email = value.trim();
  if (email.length < 3 || email.length > 320) return false;
  const at = email.indexOf("@");
  return at > 0 && at === email.lastIndexOf("@") && at < email.length - 1 && !/\s/.test(email);
}

/** Matched case-insensitively, because the database stores what it was given, lower-cased. */
export const normaliseEmail = (value: string) => value.trim().toLowerCase();

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
