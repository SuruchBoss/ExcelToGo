// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { createTabLock, type ChannelLike, type LockManagerLike, type TabLockOptions, type TabRole } from "./tabLock";

/**
 * One tab edits the workbook at a time (#47). The browser's Web Locks and BroadcastChannel are
 * stood in for by the smallest fakes that behave like them: one lock, granted in order and released
 * when its callback's promise settles; one bus that delivers to every channel but the sender.
 */
function fakeLocks(): LockManagerLike {
  let held = false;
  const queue: (() => void)[] = [];
  const run = (callback: (lock: unknown) => unknown) =>
    new Promise<unknown>((resolve) => {
      held = true;
      Promise.resolve(callback({})).then((value) => {
        held = false;
        queue.shift()?.();
        resolve(value);
      });
    });
  return {
    request(_name: string, options: { ifAvailable?: boolean; signal?: AbortSignal }, callback: (lock: unknown) => unknown) {
      if (!held) return run(callback);
      if (options.ifAvailable) return Promise.resolve(callback(null));
      return new Promise((resolve, reject) => {
        const turn = () => void run(callback).then(resolve);
        queue.push(turn);
        // An aborted request leaves the queue, as the browser's does.
        options.signal?.addEventListener("abort", () => {
          const at = queue.indexOf(turn);
          if (at >= 0) queue.splice(at, 1);
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    },
  } as LockManagerLike;
}

function fakeBus() {
  const channels = new Set<ChannelLike>();
  return (): ChannelLike => {
    const channel: ChannelLike = {
      onmessage: null,
      postMessage(message) {
        for (const other of channels) if (other !== channel) queueMicrotask(() => other.onmessage?.({ data: message }));
      },
      close: () => void channels.delete(channel),
    };
    channels.add(channel);
    return channel;
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function openTab(locks: LockManagerLike | undefined, channel: (() => ChannelLike) | undefined, log: string[], name: string) {
  const roles: TabRole[] = [];
  const freed: boolean[] = [];
  const options: TabLockOptions = {
    locks,
    channel: channel?.(),
    onRole: (role, wasFreed) => {
      roles.push(role);
      freed.push(Boolean(wasFreed));
    },
    beforeHandOff: () => log.push(`${name} commits`),
    afterTakeOver: () => log.push(`${name} reads the save`),
  };
  const lock = createTabLock(options);
  return { lock, roles, last: () => roles[roles.length - 1], freed: () => freed[freed.length - 1] };
}

describe("which tab edits (#47)", () => {
  it("the first tab edits; a second one asks", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    const a = openTab(locks, bus, [], "A");
    await settle();
    const b = openTab(locks, bus, [], "B");
    await settle();
    expect(a.last()).toBe("editor");
    expect(b.last()).toBe("asking");
  });

  it("View only is only looking, and the first tab keeps editing", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    const a = openTab(locks, bus, [], "A");
    await settle();
    const b = openTab(locks, bus, [], "B");
    await settle();
    b.lock.viewOnly();
    await settle();
    expect(b.last()).toBe("viewer");
    expect(a.last()).toBe("editor");
  });

  it("taking over: the first tab commits and hands off before the second reads the save", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    const log: string[] = [];
    const a = openTab(locks, bus, log, "A");
    await settle();
    const b = openTab(locks, bus, log, "B");
    await settle();
    b.lock.takeOver();
    await settle();
    await settle();
    expect(log).toEqual(["A commits", "B reads the save"]);
    expect(a.last()).toBe("handedOff");
    expect(b.last()).toBe("editor");
  });

  it("the tab that was handed off can take it back", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    const a = openTab(locks, bus, [], "A");
    await settle();
    const b = openTab(locks, bus, [], "B");
    await settle();
    b.lock.takeOver();
    await settle();
    await settle();
    a.lock.takeOver();
    await settle();
    await settle();
    expect(a.last()).toBe("editor");
    expect(b.last()).toBe("handedOff");
  });

  it("a closed editing tab frees the workbook for a tab that was looking, with no press (#146)", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    const log: string[] = [];
    const a = openTab(locks, bus, log, "A");
    await settle();
    const b = openTab(locks, bus, log, "B");
    await settle();
    b.lock.viewOnly();
    a.lock.stop();
    await settle();
    expect(log).toEqual(["B reads the save"]);
    expect(b.last()).toBe("editor");
    expect(b.freed()).toBe(true);
  });

  it("a tab still asking is freed the same way, and its question goes", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    const a = openTab(locks, bus, [], "A");
    await settle();
    const b = openTab(locks, bus, [], "B");
    await settle();
    expect(b.last()).toBe("asking");
    a.lock.stop();
    await settle();
    expect(b.last()).toBe("editor");
  });

  it("taking over is not freed: that tab asked", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    openTab(locks, bus, [], "A");
    await settle();
    const b = openTab(locks, bus, [], "B");
    await settle();
    b.lock.takeOver();
    await settle();
    await settle();
    expect(b.last()).toBe("editor");
    expect(b.freed()).toBe(false);
  });

  it("with two tabs looking, one edits when the editing tab closes and the other keeps looking", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    const a = openTab(locks, bus, [], "A");
    await settle();
    const b = openTab(locks, bus, [], "B");
    const c = openTab(locks, bus, [], "C");
    await settle();
    b.lock.viewOnly();
    c.lock.viewOnly();
    a.lock.stop();
    await settle();
    expect(b.last()).toBe("editor");
    expect(c.last()).toBe("viewer");
  });

  it("the tab that pressed takes over, not a tab that was waiting ahead of it", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    const log: string[] = [];
    const a = openTab(locks, bus, log, "A");
    await settle();
    const b = openTab(locks, bus, log, "B");
    const c = openTab(locks, bus, log, "C");
    await settle();
    b.lock.viewOnly();
    c.lock.viewOnly();
    c.lock.takeOver();
    for (let i = 0; i < 4; i++) await settle();
    expect(c.last()).toBe("editor");
    expect(a.last()).toBe("handedOff");
    expect(b.last()).toBe("viewer");
    expect(log).toEqual(["A commits", "C reads the save"]);
  });

  it("if the tab that asked closes before its turn, the workbook still ends up with one tab editing", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    const a = openTab(locks, bus, [], "A");
    await settle();
    const b = openTab(locks, bus, [], "B");
    const c = openTab(locks, bus, [], "C");
    await settle();
    b.lock.viewOnly();
    c.lock.viewOnly();
    c.lock.takeOver();
    c.lock.stop();
    for (let i = 0; i < 4; i++) await settle();
    // A let go for C and queued behind B; B passed once for C; C was gone — so A's turn came.
    expect([a.last(), b.last()]).toEqual(["editor", "viewer"]);
  });

  it("the tab that was handed off gets it back when the tab that took over closes", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    const a = openTab(locks, bus, [], "A");
    await settle();
    const b = openTab(locks, bus, [], "B");
    await settle();
    b.lock.takeOver();
    await settle();
    await settle();
    b.lock.stop();
    await settle();
    expect(a.last()).toBe("editor");
    expect(a.freed()).toBe(true);
  });

  it("a browser without Web Locks edits in every tab, as before", () => {
    const a = openTab(undefined, undefined, [], "A");
    const b = openTab(undefined, undefined, [], "B");
    expect([a.last(), b.last()]).toEqual(["editor", "editor"]);
  });

  it("a lock the browser refuses leaves the tab editing, not unable to save", async () => {
    const refusing = { request: () => Promise.reject(new Error("SecurityError")) } as unknown as LockManagerLike;
    const a = openTab(refusing, undefined, [], "A");
    await settle();
    expect(a.last()).toBe("editor");
  });
});
