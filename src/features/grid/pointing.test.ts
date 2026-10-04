// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it } from "vitest";
import { formulaInEditor, noteFormulaText, pointingFormula, registerFormulaEditor, unregisterFormulaEditor } from "./pointing";

// The rules read only the input's text, so a plain object stands in for one: the suite runs without a DOM.
const input = (value: string) => ({ value }) as HTMLInputElement;
const editorOn = (el: HTMLInputElement, edited?: boolean) => ({ input: el, commit: () => {}, cancel: () => {}, edited });

describe("a tap points only into a formula somebody is building (#201)", () => {
  let current: HTMLInputElement | null = null;
  afterEach(() => {
    if (current) unregisterFormulaEditor(current);
    current = null;
  });

  it("does not point into a saved formula only opened to look at, as Enter in the formula bar left it", () => {
    current = input("=A1*2");
    registerFormulaEditor(editorOn(current));
    expect(pointingFormula()).toBeNull();
  });

  it("points once something is typed into it", () => {
    current = input("=A1*2");
    registerFormulaEditor(editorOn(current));
    current.value = "=A1*2+";
    noteFormulaText(current, current.value);
    expect(pointingFormula()?.input).toBe(current);
  });

  it("points at once into an editor opened by typing `=`", () => {
    current = input("=");
    registerFormulaEditor(editorOn(current, true));
    expect(pointingFormula()?.input).toBe(current);
  });

  it("still lets the bar's keys type into a formula only opened, and never points into a value", () => {
    current = input("=SUM(A1:A3");
    registerFormulaEditor(editorOn(current));
    expect(formulaInEditor()?.input).toBe(current);
    unregisterFormulaEditor(current);

    current = input("599");
    registerFormulaEditor(editorOn(current, true));
    expect(pointingFormula()).toBeNull();
    expect(formulaInEditor()).toBeNull();
  });
});
