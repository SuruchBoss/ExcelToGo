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
  request(name: string, options: { ifAvailable: boolean }, callback: (lock: Lock | null) => unknown): Promise<unknown>;
  request(name: string, callback: (lock: Lock | null) => unknown): Promise<unknown>;
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
  onRole(role: TabRole): void;
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
  let waiting = false;
  let stopped = false;
  const setRole = (next: TabRole) => {
    if (stopped || next === role) return;
    role = next;
    opts.onRole(next);
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
  if (!locks) {
    setRole("editor");
  } else {
    locks
      .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (stopped) return;
        if (!lock) {
          setRole("asking");
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
      if (data?.type !== TAKE_OVER || role !== "editor") return;
      opts.beforeHandOff();
      setRole("handedOff");
      letGo();
    };
  }

  return {
    role: () => role,
    takeOver() {
      if (!locks || role === "editor" || waiting || stopped) return;
      waiting = true;
      channel?.postMessage({ type: TAKE_OVER });
      // Not awaited: the promise settles when the lock is released again, not when it is granted.
      void locks
        .request(LOCK_NAME, () => {
          waiting = false;
          if (stopped) return;
          opts.afterTakeOver();
          setRole("editor");
          return hold();
        })
        .catch(() => {
          waiting = false;
        });
    },
    viewOnly() {
      if (role === "asking") setRole("viewer");
    },
    stop() {
      stopped = true;
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
