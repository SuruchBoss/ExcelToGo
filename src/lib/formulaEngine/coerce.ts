// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { dateLiteral } from "../excelDate";
import { formattedNumber } from "../cellLiteral";
import { FormulaError, FormulaValue, isError, ERR_VALUE } from "./types";

export function toNumber(v: FormulaValue): number | FormulaError {
  if (isError(v)) return v;
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed === "") return 0;
    const n = Number(trimmed);
    if (!Number.isNaN(n)) return n;
    // `="1,250"*2` is 2500 in Excel: text a cell would read as a number counts as one here too (#52).
    const shown = formattedNumber(trimmed);
    if (shown) return shown.value;
    // `="2024-01-15"+1` is a date in Excel too: text that reads as one is its serial (#45).
    const date = dateLiteral(trimmed);
    return date ? date.serial : ERR_VALUE;
  }
  return ERR_VALUE;
}

export function toBoolean(v: FormulaValue): boolean | FormulaError {
  if (isError(v)) return v;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null || v === undefined) return false;
  if (typeof v === "string") {
    const upper = v.trim().toUpperCase();
    if (upper === "TRUE") return true;
    if (upper === "FALSE") return false;
    return v.length > 0;
  }
  return ERR_VALUE;
}

export function toDisplayString(v: FormulaValue): string {
  if (isError(v)) return v.toString();
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1e10) / 1e10);
  }
  return v;
}

export function isBlank(v: FormulaValue): boolean {
  return v === null || v === undefined || v === "";
}
