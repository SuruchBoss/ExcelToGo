// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * One tab edits the workbook at a time (#47).
 *
 * Every tab saves the whole workbook to the same localStorage key, so with two tabs open the one
 * that saved last silently threw away what the other had typed. Now the tab holding a Web Lock is
 * the only one that edits and saves; another tab opened on top asks what to do — take over, which
 * turns the first tab view-only, or just look — and says which it is for as long as it is open.
 *
 * A lock rather than a heartbeat because the browser releases it when a tab closes or crashes, so
 * there is no stale "somebody is editing" to time out. Handing over goes through a
 * BroadcastChannel: the editing tab commits what it has, lets go of the lock, and the tab taking
 * over reads the save only once it holds the lock — so the last keystroke of the old tab is in
 * what the new one opens.
 *
 * A tab that is not editing keeps a request for the lock waiting (#146), so when the editing tab
 * closes, crashes or leaves the app the browser hands the lock to one waiting tab — no polling —
 * and that tab reads the latest save before it edits, the same as taking over. The other waiting
 * tabs keep looking, and what they say stays true: another tab is editing again.
 *
 * Several tabs can be waiting when one presses "use this tab instead", and the lock goes to them
 * in the order they asked, not to the one that pressed. So a waiting tab that has heard another
 * ask to take over passes the lock on once when it comes: it queues again, behind the tab that
 * asked, and lets go. Only if it comes round to it a second time — the tab that asked closed first
 * — does it keep it.
 *
 * A browser without Web Locks (or a context that refuses them) edits as every tab did before:
 * the old behaviour, not a tab that can never save.
 */

/** `starting` until the lock answers · `asking` is a second tab waiting for a choice ·
 *  `viewer` chose to look · `handedOff` was editing until another tab took over. */
export type TabRole = "starting" | "editor" | "asking" | "viewer" | "handedOff";

export const LOCK_NAME = "exceltogo-workbook";
export const CHANNEL_NAME = "exceltogo-tabs";

type Lock = unknown;
/** The part of `navigator.locks` this uses, so a test can hand in its own. */
export interface LockManagerLike {
  request(
    name: string,
    options: { ifAvailable?: boolean; signal?: AbortSignal },
    callback: (lock: Lock | null) => unknown,
  ): Promise<unknown>;
}
/** The part of `BroadcastChannel` this uses. */
export interface ChannelLike {
  postMessage(message: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close(): void;
}

export interface TabLockOptions {
  locks: LockManagerLike | undefined;
  channel: ChannelLike | undefined;
  /** `freed` when this tab edits because the tab that was editing let go by itself (#146) — it
   *  closed or left the app — rather than because this one asked to take over. */
  onRole(role: TabRole, freed?: boolean): void;
  /** Called on the editing tab just before it lets go: commit whatever is half-typed. */
  beforeHandOff(): void;
  /** Called on the tab taking over once it holds the lock, before it edits: read the latest save. */
  afterTakeOver(): void;
}

export interface TabLock {
  role(): TabRole;
  /** Asks the editing tab to hand over, and edits here once it has. */
  takeOver(): void;
  viewOnly(): void;
  stop(): void;
}

const TAKE_OVER = "take-over";

export function createTabLock(opts: TabLockOptions): TabLock {
  let role: TabRole = "starting";
  let release: (() => void) | null = null;
  let wait: AbortController | null = null;
  // This tab pressed "use this tab instead" and is waiting for the lock because of it.
  let takingOver = false;
  // Another tab asked to take over since this one last queued: pass the lock on once if it comes.
  let owed = false;
  let stopped = false;
  const setRole = (next: TabRole, freed = false) => {
    if (stopped || next === role) return;
    role = next;
    opts.onRole(next, freed);
  };
  // Held until another tab takes over or this one closes; the browser drops it on close by itself.
  const hold = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  const letGo = () => {
    release?.();
    release = null;
  };

  const { locks, channel } = opts;
  // Waits for the lock without asking anyone for it. Not awaited: the promise settles when the lock
  // is released again, not when it is granted.
  const queue = () => {
    if (!locks || wait || stopped) return;
    const controller = new AbortController();
    wait = controller;
    owed = false;
    void locks
      .request(LOCK_NAME, { signal: controller.signal }, () => {
        wait = null;
        if (stopped) return;
        if (owed && !takingOver) {
          // Behind the tab that asked, then let go so it gets the lock.
          queue();
          return;
        }
        const freed = !takingOver;
        takingOver = false;
        opts.afterTakeOver();
        setRole("editor", freed);
        return hold();
      })
      .catch(() => {
        if (wait === controller) wait = null;
        takingOver = false;
      });
  };

  if (!locks) {
    setRole("editor");
  } else {
    locks
      .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (stopped) return;
        if (!lock) {
          setRole("asking");
          queue();
          return;
        }
        setRole("editor");
        return hold();
      })
      .catch(() => setRole("editor"));
  }

  if (channel) {
    channel.onmessage = (event) => {
      const data = event.data as { type?: string } | null;
      if (data?.type !== TAKE_OVER) return;
      if (role !== "editor") {
        owed = true;
        return;
      }
      opts.beforeHandOff();
      setRole("handedOff");
      letGo();
      queue();
    };
  }

  return {
    role: () => role,
    takeOver() {
      if (!locks || role === "editor" || takingOver || stopped) return;
      takingOver = true;
      // The request already waiting is this tab's place in the queue; the tabs ahead of it pass.
      queue();
      channel?.postMessage({ type: TAKE_OVER });
    },
    viewOnly() {
      if (role === "asking") setRole("viewer");
    },
    stop() {
      stopped = true;
      wait?.abort();
      wait = null;
      letGo();
      if (channel) {
        channel.onmessage = null;
        channel.close();
      }
    },
  };
}
/** The real `navigator.locks` and a channel, where this browser has them. */
export function browserTabLock(options: Omit<TabLockOptions, "locks" | "channel">): TabLock {
  const locks = typeof navigator !== "undefined" ? (navigator.locks as unknown as LockManagerLike | undefined) : undefined;
  const channel = typeof BroadcastChannel !== "undefined" ? (new BroadcastChannel(CHANNEL_NAME) as unknown as ChannelLike) : undefined;
  return createTabLock({ ...options, locks, channel });
}
