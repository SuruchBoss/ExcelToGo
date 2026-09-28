// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { awaitsOperand } from "./openFormula";

describe("a formula waiting for a cell address", () => {
  it("is waiting right after = (the #99 case), an opening bracket, a separator or an operator", () => {
    for (const draft of ["=", "=SUM(", "=SUM(A1,", "=SUM(A1;", "=A1:", "=A1+", "=A1-", "=A1*", "=A1/", "=A1^", "=A1&", "=A1<", "=A1>", "=-"]) {
      expect(awaitsOperand(draft), draft).toBe(true);
    }
  });

  it("ignores spaces after the last operator", () => {
    expect(awaitsOperand("=SUM(A1, ")).toBe(true);
  });

  it("is not waiting once the formula could be finished, so a click still saves it and moves", () => {
    for (const draft of ["=SUM(A1:A3)", "=A1", "=A1+B2", "=10", '="a,b"', "=TODAY()"]) {
      expect(awaitsOperand(draft), draft).toBe(false);
    }
  });

  it("is never true for plain text, an empty draft or nothing at all", () => {
    for (const draft of ["hello", "a+", "", " =", null, undefined]) {
      expect(awaitsOperand(draft), String(draft)).toBe(false);
    }
  });

  it("treats a comma inside an unclosed string as text", () => {
    expect(awaitsOperand('="a,')).toBe(false);
    expect(awaitsOperand('=CONCAT("a",')).toBe(true);
  });
});
