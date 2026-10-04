// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

"use client";

import { create } from "zustand";
import { cellRef, rangeRefString } from "@/lib/formulaEngine/address";
import { pointInto, typeInto, widenPoint, type PointSpan } from "./pointText";

/**
 * Tapping cells into a formula on a phone (#99): the state shared between the two editors that
 * can hold a formula (the cell's own and the formula bar), the grid that is tapped, and the
 * pointing bar above the keyboard.
 *
 * Whichever editor has focus registers itself here. The grid and the bar then write into it the
 * way typing does — through the input's own value and an `input` event, so React sees an ordinary
 * edit and nothing about either editor needed a second way in. Saving stays with the editor.
 */

/** The editor a formula is being typed into, and how it saves or drops what it holds. */
export interface FormulaEditor {
  input: HTMLInputElement;
  /** Save this text into the cell the editor is for, and close. */
  commit: (text: string) => void;
  /** Drop the draft; the cell keeps what it had. */
  cancel: () => void;
  /**
   * Whether it already holds something typed rather than the cell's saved text — an editor opened
   * by typing `=`, say. Taps point only into a formula somebody is building (#201).
   */
  edited?: boolean;
}

export interface PointedRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

interface PointingState {
  editor: FormulaEditor | null;
  /** The editor's text as it stands, so the bar and the grid redraw as it changes. */
  text: string;
  /** Something has been typed into the editor since it opened (#201). */
  edited: boolean;
  /** Cells the last tap put into the formula, outlined on the grid, and where they sit in the text. */
  pointed: { range: PointedRange; span: PointSpan } | null;
}

export const usePointingStore = create<PointingState>(() => ({ editor: null, text: "", edited: false, pointed: null }));

export function registerFormulaEditor(editor: FormulaEditor) {
  usePointingStore.setState({ editor, text: editor.input.value, edited: editor.edited ?? false, pointed: null });
}

export function unregisterFormulaEditor(input: HTMLInputElement) {
  if (usePointingStore.getState().editor?.input === input) {
    usePointingStore.setState({ editor: null, text: "", edited: false, pointed: null });
  }
}

/**
 * Forgets an editor that has gone from the page without a blur — the cell's editor closed by Done,
 * Escape or Enter unmounts rather than blurs. Left registered, the pointing bar stayed up over
 * the bottom tabs with a formula that no longer existed.
 */
export function forgetClosedEditor() {
  const { editor } = usePointingStore.getState();
  if (editor && !editor.input.isConnected) usePointingStore.setState({ editor: null, text: "", edited: false, pointed: null });
}

/** Called from the editors' onChange, so typing keeps the bar and the outline current. */
export function noteFormulaText(input: HTMLInputElement, text: string) {
  const state = usePointingStore.getState();
  if (state.editor?.input !== input) return;
  // Typing over the address a tap put in ends the outline: it no longer says what the text says.
  const pointed = state.pointed && text.slice(state.pointed.span.start, state.pointed.span.end) === state.pointed.span.ref ? state.pointed : null;
  usePointingStore.setState({ text, edited: true, pointed });
}

/** A formula open in an editor, typed into or not: what the bar's keys type into. */
export function formulaInEditor(): FormulaEditor | null {
  const { editor } = usePointingStore.getState();
  return editor && editor.input.value.startsWith("=") ? editor : null;
}

/**
 * Whether a tap on the grid should point rather than select: a formula is open in an editor *and*
 * somebody has typed into it (#201).
 *
 * A formula merely shown was enough before. Enter in the formula bar moved it to the next cell's
 * formula and kept focus, so the next tap anywhere put that cell's address on the end of a formula
 * nobody was editing — `=A1*2` became `=A1*2B4` and `#SYNTAX!` with no word. A formula opened to
 * look at, or to replace, is not one being built; the first key typed makes it one.
 */
export function pointingFormula(): FormulaEditor | null {
  return usePointingStore.getState().edited ? formulaInEditor() : null;
}

// ── How the last press was made ──────────────────────────────────────────────────────────────
//
// A tap's mousedown arrives after its pointerdown, and only the pointerdown says it was a finger.
// Pointing is for touch (PO's decision 1); a mouse keeps the #99 guard until Excel's own rule
// comes later.
let lastPointer: string = "mouse";
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => (lastPointer = e.pointerType), { capture: true, passive: true });
}
export const lastPressWasTouch = () => lastPointer === "touch";

/** Writes `text` into the input as typing would, and puts the caret at `caret`. */
function write(input: HTMLInputElement, text: string, caret: number) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.setSelectionRange(caret, caret);
}

let composing = false;
if (typeof window !== "undefined") {
  window.addEventListener("compositionstart", () => (composing = true), true);
  window.addEventListener("compositionend", () => (composing = false), true);
}

/** A tap on (row, col) while a formula is open: its address goes into the formula. */
export function pointAt(row: number, col: number) {
  const editor = pointingFormula();
  // Not while a Thai (or any) input method is still composing: the tap would land in the middle of
  // a word it has not committed yet.
  if (!editor || composing) return;
  const { input } = editor;
  const last = usePointingStore.getState().pointed?.span ?? null;
  const ref = cellRef(row, col);
  const result = pointInto(input.value, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, ref, last);
  write(input, result.text, result.span.end);
  usePointingStore.setState({
    text: result.text,
    pointed: { range: { startRow: row, startCol: col, endRow: row, endCol: col }, span: result.span },
  });
}

/** The grip on the pointed cell dragged: the address in the formula becomes the range. */
export function widenPointed(range: PointedRange) {
  const editor = formulaInEditor();
  const { pointed } = usePointingStore.getState();
  if (!editor || !pointed) return;
  const ref =
    range.startRow === range.endRow && range.startCol === range.endCol
      ? cellRef(range.startRow, range.startCol)
      : rangeRefString(range.startRow, range.startCol, range.endRow, range.endCol);
  const result = widenPoint(editor.input.value, pointed.span, ref);
  if (result.text === editor.input.value && result.span === pointed.span) return;
  write(editor.input, result.text, result.span.end);
  usePointingStore.setState({ text: result.text, pointed: { range, span: result.span } });
}

/** One of the bar's keys: `(`, `)`, `,`, `:`, `+`, `-`. */
export function typeKey(chars: string) {
  const editor = formulaInEditor();
  if (!editor) return;
  const { input } = editor;
  const result = typeInto(input.value, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, chars);
  write(input, result.text, result.caret);
}
