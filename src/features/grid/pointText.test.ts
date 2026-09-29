// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { closeBrackets, pointInto, typeInto, widenPoint } from "./pointText";

describe("a tap on a cell while a formula is typed", () => {
  it("puts the address in at the caret — the #99 case", () => {
    expect(pointInto("=", 1, 1, "C5").text).toBe("=C5");
    expect(pointInto("=SUM(", 5, 5, "C2").text).toBe("=SUM(C2");
  });

  it("replaces the address the last tap put there, rather than running into it", () => {
    const first = pointInto("=", 1, 1, "C5");
    const second = pointInto(first.text, first.span.end, first.span.end, "D7", first.span);
    expect(second.text).toBe("=D7");
    expect(second.span).toEqual({ start: 1, end: 3, ref: "D7" });
  });

  it("adds a new address once something has been typed after the last one", () => {
    const first = pointInto("=", 1, 1, "C5");
    const typed = "=C5+";
    expect(pointInto(typed, 4, 4, "D7", first.span).text).toBe("=C5+D7");
  });

  it("replaces an address typed by hand right before the caret", () => {
    expect(pointInto("=A1", 3, 3, "B2").text).toBe("=B2");
    expect(pointInto("=SUM(A1", 7, 7, "B2").text).toBe("=SUM(B2");
  });

  it("adds after a value that is not an address, rather than replacing it", () => {
    expect(pointInto("=10*", 4, 4, "B2").text).toBe("=10*B2");
  });

  it("replaces a selection, and works in the middle of the text", () => {
    expect(pointInto("=SUM(A1:A3)", 5, 10, "C2:C9").text).toBe("=SUM(C2:C9)");
    expect(pointInto("=SUM()", 5, 5, "C2").text).toBe("=SUM(C2)");
  });

  it("widens the address it put in into a range when the grip is dragged", () => {
    const first = pointInto("=SUM(", 5, 5, "C2");
    const wide = widenPoint(first.text, first.span, "C2:C10");
    expect(wide.text).toBe("=SUM(C2:C10");
    expect(wide.span.end).toBe(11);
  });

  it("leaves the text alone if the address was typed over before the drag", () => {
    const first = pointInto("=SUM(", 5, 5, "C2");
    expect(widenPoint("=SUM(X9", first.span, "C2:C10").text).toBe("=SUM(X9");
  });
});

describe("the pointing bar's keys", () => {
  it("type at the caret and move it past what they typed", () => {
    expect(typeInto("=SUM", 4, 4, "(")).toEqual({ text: "=SUM(", caret: 5 });
    expect(typeInto("=A1B2", 3, 3, ":")).toEqual({ text: "=A1:B2", caret: 4 });
  });
});

describe("Done closes the brackets a formula is missing", () => {
  it("adds as many as are open", () => {
    expect(closeBrackets("=SUM(C2:C10")).toBe("=SUM(C2:C10)");
    expect(closeBrackets("=ROUND(SUM(A1:A3")).toBe("=ROUND(SUM(A1:A3))");
  });

  it("leaves a balanced formula, plain text and extra closers alone", () => {
    expect(closeBrackets("=SUM(A1)")).toBe("=SUM(A1)");
    expect(closeBrackets("(not a formula")).toBe("(not a formula");
    expect(closeBrackets("=A1)")).toBe("=A1)");
  });

  it("does not count brackets inside a string", () => {
    expect(closeBrackets('=CONCAT("(", A1')).toBe('=CONCAT("(", A1)');
  });
});
