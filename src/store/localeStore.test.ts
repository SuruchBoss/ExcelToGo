// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { pickLocale } from "./localeStore";

/** A first visit's language, from the browser's list (blind test U15: English browsers got Thai). */
describe("the language a first visit gets", () => {
  it("Thai when Thai is the browser's language, in any regional form", () => {
    expect(pickLocale(["th-TH"])).toBe("th");
    expect(pickLocale(["TH"])).toBe("th");
  });

  it("Thai when Thai is anywhere in the list, not only first", () => {
    expect(pickLocale(["en-US", "th"])).toBe("th");
  });

  it("English for everyone else, since English is the other language the app speaks", () => {
    expect(pickLocale(["en-US"])).toBe("en");
    expect(pickLocale(["ja-JP", "fr"])).toBe("en");
    expect(pickLocale([])).toBe("en");
  });
});
