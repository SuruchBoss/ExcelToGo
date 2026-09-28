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
    request(_name: string, a: unknown, b?: unknown) {
      const options = (typeof a === "function" ? {} : a) as { ifAvailable?: boolean };
      const callback = (typeof a === "function" ? a : b) as (lock: unknown) => unknown;
      if (!held) return run(callback);
      if (options.ifAvailable) return Promise.resolve(callback(null));
      return new Promise((resolve) => queue.push(() => void run(callback).then(resolve)));
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
  const options: TabLockOptions = {
    locks,
    channel: channel?.(),
    onRole: (role) => roles.push(role),
    beforeHandOff: () => log.push(`${name} commits`),
    afterTakeOver: () => log.push(`${name} reads the save`),
  };
  const lock = createTabLock(options);
  return { lock, roles, last: () => roles[roles.length - 1] };
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

  it("a closed editing tab frees the workbook for a tab that was looking", async () => {
    const locks = fakeLocks();
    const bus = fakeBus();
    const a = openTab(locks, bus, [], "A");
    await settle();
    const b = openTab(locks, bus, [], "B");
    await settle();
    b.lock.viewOnly();
    a.lock.stop();
    await settle();
    b.lock.takeOver();
    await settle();
    expect(b.last()).toBe("editor");
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
