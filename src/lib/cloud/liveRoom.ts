/**
 * One workbook, several people, and the bookkeeping that keeps them from talking over each other.
 *
 * `liveSession.ts` holds the rules — which message wins, what to do with one that arrives. This
 * holds the state those rules need and the wiring between them and whatever is carrying messages.
 * The transport is an interface, not a Supabase channel, and that is deliberate: the interesting
 * failures here (a deferred edit flushing after the editor closes, an echo of your own keystroke,
 * a message that lost a race arriving second) are all reachable in a test with a fake that delivers
 * messages by calling a function, and none of them are reachable at all with a real socket nobody
 * running this repo's tests can open.
 */
import {
  CellEdit,
  cellKeyOf,
  ClientId,
  CursorMove,
  Decision,
  LiveMessage,
  Participant,
  decide,
  randomClientId,
  wins,
} from "./liveSession";

/** What the room needs from a transport. Supabase implements this; so does a fake in the tests. */
export interface LiveChannel {
  send(message: LiveMessage): void;
  /** Whoever else is connected, as the transport currently sees it. */
  onPresence?(handler: (participants: Participant[]) => void): void;
  onMessage(handler: (message: LiveMessage) => void): void;
  track?(state: Participant): void;
  close(): void;
}

export interface LiveRoomHooks {
  /** Put a value in a cell. The room has already decided this is the right thing to do. */
  applyCell(edit: CellEdit): void;
  /** Somebody changed the shape of a sheet; reload the saved copy rather than patching. */
  resync(tabId: string): void;
  /** Presence changed — someone joined, left, or moved. */
  participants(list: Participant[]): void;
  /**
   * A remote edit landed on a cell this person had open, after they closed it.
   *
   * Worth saying out loud rather than letting them find it later: they watched a value they typed
   * become a different value, and silence there is how people stop trusting a shared document.
   */
  overwritten?(edit: CellEdit): void;
}

export interface LiveRoomOptions {
  channel: LiveChannel;
  /** This client's display name. Not an identity claim — there are no accounts here to ask. */
  name: string;
  hooks: LiveRoomHooks;
  self?: ClientId;
  /** Injectable so a test can put two writes in the same millisecond on purpose. */
  now?: () => number;
}

export class LiveRoom {
  readonly self: ClientId;
  private readonly channel: LiveChannel;
  private readonly hooks: LiveRoomHooks;
  private readonly now: () => number;
  private readonly name: string;

  /** Last write applied per cell, so a message that lost a race is not replayed over the winner. */
  private readonly applied = new Map<string, { at: number; from: ClientId }>();
  /** Edits held back while their cell is open in the editor, at most one — the winning one — each. */
  private readonly deferred = new Map<string, CellEdit>();
  private readonly people = new Map<ClientId, Participant>();
  private knownTabs: ReadonlySet<string> = new Set();
  private editing: { tabId: string; row: number; col: number } | null = null;
  private closed = false;

  constructor({ channel, name, hooks, self, now }: LiveRoomOptions) {
    this.channel = channel;
    this.hooks = hooks;
    this.name = name;
    this.self = self ?? randomClientId();
    this.now = now ?? Date.now;

    channel.onMessage((message) => this.receive(message));
    channel.onPresence?.((list) => {
      this.people.clear();
      for (const person of list) if (person.id !== this.self) this.people.set(person.id, person);
      this.announcePeople();
    });
  }

  /** Which tabs exist locally. Messages for anything else are not applied to a sheet that isn't here. */
  setTabs(tabIds: Iterable<string>): void {
    this.knownTabs = new Set(tabIds);
  }

  participants(): Participant[] {
    return [...this.people.values()];
  }

  /** One message off the wire, routed by the rules. */
  receive(message: LiveMessage): void {
    if (this.closed) return;
    const decision = decide(message, {
      self: this.self,
      knownTabs: this.knownTabs,
      editing: this.editing,
      applied: this.applied,
    });
    this.act(message, decision);
  }

  private act(message: LiveMessage, decision: Decision): void {
    switch (decision.action) {
      case "ignore":
        return;
      case "resync":
        return this.hooks.resync(message.tabId);
      case "defer": {
        const edit = message as CellEdit;
        const key = cellKeyOf(edit.tabId, edit.row, edit.col);
        const held = this.deferred.get(key);
        // Only the winner is kept: replaying three superseded values in order would show the user
        // two states that never existed.
        if (!held || wins(edit, held)) this.deferred.set(key, edit);
        return;
      }
      case "apply":
        if (message.kind === "cursor") return this.remember(message);
        return this.commit(message as CellEdit);
    }
  }

  private commit(edit: CellEdit, overwritten = false): void {
    this.applied.set(cellKeyOf(edit.tabId, edit.row, edit.col), { at: edit.at, from: edit.from });
    this.hooks.applyCell(edit);
    if (overwritten) this.hooks.overwritten?.(edit);
  }

  private remember(move: CursorMove): void {
    this.people.set(move.from, { id: move.from, name: move.name, tabId: move.tabId, row: move.row, col: move.col });
    this.announcePeople();
  }

  private announcePeople(): void {
    this.hooks.participants(this.participants());
  }

  /** The local person opened a cell for editing; nothing may overwrite it until they are done. */
  beginEdit(tabId: string, row: number, col: number): void {
    this.editing = { tabId, row, col };
  }

  /**
   * The editor closed. Anything held back for that cell is applied now.
   *
   * This is where the edit that was deferred either lands or is found to have been superseded by
   * what the local person just typed — `wins` decides, with the same rule everyone else is using.
   */
  endEdit(): void {
    const open = this.editing;
    this.editing = null;
    if (!open) return;
    const key = cellKeyOf(open.tabId, open.row, open.col);
    const held = this.deferred.get(key);
    if (!held) return;
    this.deferred.delete(key);
    const mine = this.applied.get(key);
    if (mine && !wins(held, mine)) return;
    this.commit(held, true);
  }

  /** The local person changed a cell. Told to everyone, and remembered so an echo cannot undo it. */
  localEdit(tabId: string, row: number, col: number, raw: string): void {
    if (this.closed) return;
    const edit: CellEdit = { kind: "cell", tabId, row, col, raw, at: this.now(), from: this.self };
    this.applied.set(cellKeyOf(tabId, row, col), { at: edit.at, from: edit.from });
    this.channel.send(edit);
  }

  /**
   * A row or column came or went.
   *
   * Broadcast as its own kind rather than as the cell edits it implies: the receiving client has to
   * reload rather than patch, because every cell message already in flight now refers to a position
   * that has moved.
   */
  localStructureChange(tabId: string): void {
    if (this.closed) return;
    this.channel.send({ kind: "structure", tabId, at: this.now(), from: this.self });
  }

  /** Where this person is looking. Cheap, frequent, and carries no sheet data. */
  moveCursor(tabId: string, row: number, col: number): void {
    if (this.closed) return;
    const state: Participant = { id: this.self, name: this.name, tabId, row, col };
    this.channel.track?.(state);
    this.channel.send({ kind: "cursor", tabId, row, col, from: this.self, name: this.name });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.people.clear();
    this.deferred.clear();
    this.channel.close();
  }
}
