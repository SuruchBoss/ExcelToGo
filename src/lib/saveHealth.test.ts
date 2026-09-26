import { beforeEach, describe, expect, it } from "vitest";
import { getSaveStatus, guardedStorage, isQuotaError, resetSaveStatus, subscribeSaveStatus } from "./saveHealth";

/** A Storage whose writes can be switched to fail, the way a full or disabled one does. */
function fakeStorage() {
  const data = new Map<string, string>();
  const ctl = { fail: null as unknown };
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (ctl.fail) throw ctl.fail;
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  } as unknown as Storage;
  return { storage, data, ctl };
}

const quota = () => Object.assign(new Error("exceeded the quota"), { name: "QuotaExceededError" });

beforeEach(() => resetSaveStatus());

describe("isQuotaError", () => {
  it("recognises every spelling browsers use", () => {
    expect(isQuotaError(quota())).toBe(true);
    expect(isQuotaError({ name: "NS_ERROR_DOM_QUOTA_REACHED" })).toBe(true);
    expect(isQuotaError({ name: "Error", code: 22 })).toBe(true);
    expect(isQuotaError({ name: "Error", code: 1014 })).toBe(true);
  });

  it("does not call every failure a full disk", () => {
    // A private-mode refusal is not fixed by making the workbook smaller, so it must not be worded
    // as if it were.
    expect(isQuotaError(new Error("SecurityError"))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError("QuotaExceededError")).toBe(false);
  });
});

describe("guardedStorage", () => {
  it("passes reads and writes through while they work", () => {
    const { storage, data } = fakeStorage();
    const guarded = guardedStorage(storage);
    guarded.setItem("k", "v");
    expect(data.get("k")).toBe("v");
    expect(guarded.getItem("k")).toBe("v");
    expect(getSaveStatus()).toBe("ok");
  });

  it("turns a quota failure into a status instead of an exception", () => {
    const { storage, ctl } = fakeStorage();
    const guarded = guardedStorage(storage);
    ctl.fail = quota();
    expect(() => guarded.setItem("k", "big")).not.toThrow();
    expect(getSaveStatus()).toBe("full");
  });

  it("reports any other refusal as blocked", () => {
    const { storage, ctl } = fakeStorage();
    ctl.fail = new Error("SecurityError");
    guardedStorage(storage).setItem("k", "v");
    expect(getSaveStatus()).toBe("blocked");
  });

  it("keeps the last good save when a later one fails", () => {
    // A stale copy is worth more than nothing, and nothing is what deleting it would leave.
    const { storage, data, ctl } = fakeStorage();
    const guarded = guardedStorage(storage);
    guarded.setItem("k", "before");
    ctl.fail = quota();
    guarded.setItem("k", "after");
    expect(data.get("k")).toBe("before");
  });

  it("recovers as soon as a save lands again", () => {
    const { storage, ctl } = fakeStorage();
    const guarded = guardedStorage(storage);
    ctl.fail = quota();
    guarded.setItem("k", "big");
    ctl.fail = null;
    guarded.setItem("k", "small");
    expect(getSaveStatus()).toBe("ok");
  });

  it("never throws on a read or a remove either", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage;
    const guarded = guardedStorage(broken);
    expect(guarded.getItem("k")).toBeNull();
    expect(() => guarded.removeItem("k")).not.toThrow();
  });
});

describe("subscribers", () => {
  it("hear a change of status once, and not a repeat of the same one", () => {
    // Every keystroke on an oversized workbook fails to save. Re-rendering the notice on each of
    // them would be work for nothing, and re-announcing it would be noise.
    const { storage, ctl } = fakeStorage();
    const guarded = guardedStorage(storage);
    let calls = 0;
    const off = subscribeSaveStatus(() => calls++);
    ctl.fail = quota();
    guarded.setItem("k", "1");
    guarded.setItem("k", "2");
    guarded.setItem("k", "3");
    expect(calls).toBe(1);
    ctl.fail = null;
    guarded.setItem("k", "4");
    expect(calls).toBe(2);
    off();
    ctl.fail = quota();
    guarded.setItem("k", "5");
    expect(calls).toBe(2);
  });
});
