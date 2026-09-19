/**
 * Two people in one workbook at the same time — the rules, with no network in them.
 *
 * Kept apart from the Supabase client for the same reason `workbook.ts` is: nobody running this
 * repo's tests has a project to point at, and the interesting part of live editing is not the
 * socket. It is deciding what to do with a message that arrives while somebody is typing.
 *
 * **What this does.** Every cell edit is broadcast to the other people in the same workbook and
 * applied on arrival, last writer wins. Presence says who else is here and where their cursor is.
 * That covers the case this is actually for: two people filling in different parts of the same
 * sheet and wanting to see each other do it.
 *
 * **What this is not.** It is not a CRDT and does not pretend to be one. Two people typing into
 * *the same cell* in the same second produce one winner and one loss, and the loser is told rather
 * than left to notice. Structural edits — inserting or deleting a row or column — are not merged
 * at all: they move every cell below or right of them, so a cell message crossing one on the wire
 * would land in the wrong place. Those are announced, and the other clients resync from the saved
 * copy instead of trying to patch. Diverging silently would be worse than a visible reload, and a
 * spreadsheet that quietly disagrees with itself on two screens is the failure worth the most care
 * to avoid.
 */

/** Who sent it. Random per tab, so two tabs of one account are two participants — they are. */
export type ClientId = string;

export interface CellEdit {
  kind: "cell";
  tabId: string;
  row: number;
  col: number;
  raw: string;
  /** `Date.now()` on the sender. Clocks differ; see `wins` for why that is survivable here. */
  at: number;
  from: ClientId;
}

export interface StructureChange {
  kind: "structure";
  tabId: string;
  at: number;
  from: ClientId;
}

export interface CursorMove {
  kind: "cursor";
  tabId: string;
  row: number;
  col: number;
  from: ClientId;
  name: string;
}

export type LiveMessage = CellEdit | StructureChange | CursorMove;

export interface Participant {
  id: ClientId;
  name: string;
  tabId: string;
  row: number;
  col: number;
}

/** The key a cell's last-applied timestamp is remembered under. */
export const cellKeyOf = (tabId: string, row: number, col: number) => `${tabId}:${row},${col}`;

/**
 * Which of two writes to the same cell stands.
 *
 * Later wins; a tie goes to the larger client id. The tie-break is not decoration — without it two
 * clients whose clocks agree to the millisecond can each keep their own value and stay different
 * for ever, which is the one outcome this whole module exists to prevent. Every participant runs
 * the same comparison on the same two facts, so they all land on the same answer without asking
 * anyone.
 *
 * Clock skew means the winner may not be the person who typed last. That is a real limitation of
 * timestamps and it is stated in the README rather than papered over; the alternative is a server
 * sequence number, which means a server, which this app does not have.
 */
export function wins(incoming: { at: number; from: ClientId }, existing: { at: number; from: ClientId }): boolean {
  if (incoming.at !== existing.at) return incoming.at > existing.at;
  return incoming.from > existing.from;
}

export type Decision =
  | { action: "apply" }
  | { action: "ignore"; why: "own-message" | "older" | "other-tab" }
  | { action: "defer"; why: "being-edited" }
  | { action: "resync"; why: "structure-changed" };

export interface DecisionContext {
  self: ClientId;
  /** The tab the person is looking at; messages for another tab are applied to the model, not the view. */
  knownTabs: ReadonlySet<string>;
  /** The cell the local person has open in the editor right now, if any. */
  editing: { tabId: string; row: number; col: number } | null;
  /** Last applied write per cell, so a message that lost a race is not replayed over the winner. */
  applied: ReadonlyMap<string, { at: number; from: ClientId }>;
}

/**
 * What to do with one message.
 *
 * A pure function of the message and what this client knows, which is what makes the rules
 * testable: every case below is a test rather than a comment claiming it was thought about.
 */
export function decide(message: LiveMessage, ctx: DecisionContext): Decision {
  if (message.from === ctx.self) return { action: "ignore", why: "own-message" };
  if (message.kind === "cursor") return { action: "apply" };
  if (!ctx.knownTabs.has(message.tabId)) return { action: "ignore", why: "other-tab" };
  if (message.kind === "structure") return { action: "resync", why: "structure-changed" };

  // Never overwrite the cell somebody has open. Watching your own typing vanish mid-word is the
  // thing that makes people stop trusting a shared document, and the edit is not lost — it is
  // applied when the editor closes.
  if (
    ctx.editing &&
    ctx.editing.tabId === message.tabId &&
    ctx.editing.row === message.row &&
    ctx.editing.col === message.col
  ) {
    return { action: "defer", why: "being-edited" };
  }

  const seen = ctx.applied.get(cellKeyOf(message.tabId, message.row, message.col));
  if (seen && !wins(message, seen)) return { action: "ignore", why: "older" };
  return { action: "apply" };
}

/** A colour per participant, stable for as long as they are here, from the id alone. */
export function colourFor(id: ClientId): string {
  const palette = ["#0b6b4f", "#b23a33", "#6d28d9", "#b45309", "#0369a1", "#9d174d"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

/** Short, readable, and not a claim about who anyone is — there are no accounts to ask. */
export function randomClientId(): ClientId {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * A message off the wire, or null.
 *
 * Everything here came from another browser over a channel anyone holding the anon key can join,
 * so it is checked rather than trusted. The shape is small enough that checking it is cheap, and
 * the cost of not checking is a `raw` of the wrong type reaching the formula engine or a `row` of
 * `-1` reaching an array index. Strings are capped at the length a cell can hold for the same
 * reason the import path caps them: a megabyte in one cell is not an edit, it is a payload.
 */
export const MAX_RAW_LENGTH = 32_768;
const MAX_NAME_LENGTH = 40;

const isIndex = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 1_048_576;
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

export function parseLiveMessage(raw: unknown): LiveMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (!isId(m.tabId) || !isId(m.from)) return null;

  if (m.kind === "structure") {
    return typeof m.at === "number" && Number.isFinite(m.at)
      ? { kind: "structure", tabId: m.tabId, at: m.at, from: m.from }
      : null;
  }
  if (!isIndex(m.row) || !isIndex(m.col)) return null;

  if (m.kind === "cursor") {
    if (typeof m.name !== "string") return null;
    return { kind: "cursor", tabId: m.tabId, row: m.row, col: m.col, from: m.from, name: m.name.slice(0, MAX_NAME_LENGTH) };
  }
  if (m.kind === "cell") {
    if (typeof m.raw !== "string" || m.raw.length > MAX_RAW_LENGTH) return null;
    if (typeof m.at !== "number" || !Number.isFinite(m.at)) return null;
    return { kind: "cell", tabId: m.tabId, row: m.row, col: m.col, raw: m.raw, at: m.at, from: m.from };
  }
  return null;
}
