// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { th } from "@/i18n/th";
import { en } from "@/i18n/en";
import { sourceErrorText } from "./sourceError";

/**
 * The server stops a refresh on purpose in two ways and says so with a code; the panel says it in
 * the reader's language. "response_too_large" on a red line is a bare 502 by another name.
 */
describe("what a stopped refresh says to the person reading it", () => {
  it("explains a response that was too large, with the limit it hit, in both languages", () => {
    expect(sourceErrorText("response_too_large", en.data)).toContain("49 MB");
    expect(sourceErrorText("response_too_large", th.data)).toContain("49 MB");
    expect(sourceErrorText("response_too_large", en.data)).not.toContain("response_too_large");
  });

  it("explains a source that took too long, with the limit it hit, in both languages", () => {
    expect(sourceErrorText("timed_out", en.data)).toContain("15s");
    expect(sourceErrorText("timed_out", th.data)).toContain("15 วินาที");
  });

  it("passes every other message through as the server wrote it", () => {
    expect(sourceErrorText("HTTP 404 Not Found", en.data)).toBe("HTTP 404 Not Found");
    expect(sourceErrorText("Response is not valid JSON", th.data)).toBe("Response is not valid JSON");
  });
});
