// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * A number shown the way an Excel number-format code says (#53): `0%`, `0.0%`, `"$"#,##0.00`,
 * `0.000`, `#,##0`, `#,##0;(#,##0)`, `[$€-407]#,##0.00`.
 *
 * Files carry these codes, and collapsing them into the app's four presets is how an accountant's
 * VAT of 0.07 came up as "0.07%" instead of 7%, a dollar amount as baht, and 12345 without its comma.
 * So a code that came in with a file is kept and shown as written.
 *
 * The part of the language numbers use: up to four sections (positive; negative; zero; text), the
 * digit placeholders `0 # ?`, the decimal point, a thousands comma and trailing-comma scaling, `%`
 * (which multiplies by 100, as in Excel), quoted and escaped literals, `[$sym-lcid]` currency tags,
 * and colour/locale tags read past. Fractions and scientific notation fall back to the plain number
 * — they are rare in the files this app sees, and a wrong-looking fallback is still the right value.
 * Dates are `excelDate.ts`'s.
 */

type Token = { kind: "lit"; text: string } | { kind: "ph"; ch: "0" | "#" | "?" } | { kind: "dot" } | { kind: "comma" } | { kind: "pct" } | { kind: "at" };

function splitSections(code: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  let bracket = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === "\\" && !quoted) {
      cur += ch + (code[i + 1] ?? "");
      i++;
      continue;
    }
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "[") bracket = true;
    else if (!quoted && ch === "]") bracket = false;
    if (ch === ";" && !quoted && !bracket) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function tokenize(section: string): Token[] | null {
  const out: Token[] = [];
  for (let i = 0; i < section.length; i++) {
    const ch = section[i];
    if (ch === '"') {
      const end = section.indexOf('"', i + 1);
      out.push({ kind: "lit", text: section.slice(i + 1, end === -1 ? undefined : end) });
      i = end === -1 ? section.length : end;
    } else if (ch === "\\") {
      out.push({ kind: "lit", text: section[i + 1] ?? "" });
      i++;
    } else if (ch === "[") {
      const end = section.indexOf("]", i);
      const inner = section.slice(i + 1, end === -1 ? undefined : end);
      // `[$€-407]` is a currency symbol with a locale; `[Red]`, `[>100]` and `[$-409]` show nothing.
      const currency = /^\$([^-]*)/.exec(inner);
      if (currency && currency[1]) out.push({ kind: "lit", text: currency[1] });
      i = end === -1 ? section.length : end;
    } else if (ch === "_") {
      out.push({ kind: "lit", text: " " });
      i++;
    } else if (ch === "*") {
      i++;
    } else if (ch === "0" || ch === "#" || ch === "?") {
      out.push({ kind: "ph", ch });
    } else if (ch === ".") {
      out.push({ kind: "dot" });
    } else if (ch === ",") {
      out.push({ kind: "comma" });
    } else if (ch === "%") {
      out.push({ kind: "pct" });
    } else if (ch === "@") {
      out.push({ kind: "at" });
    } else if (ch === "/" || ch === "E" || ch === "e") {
      return null;
    } else {
      out.push({ kind: "lit", text: ch });
    }
  }
  return out;
}

const groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** The number as the code says, or the plain number for the parts of the language not covered. */
export function formatNumberCode(value: number, code: string): string {
  if (!Number.isFinite(value)) return String(value);
  const sections = splitSections(code);
  let section = sections[0];
  let abs = value;
  let sign = "";
  if (value < 0 && sections.length >= 2 && sections[1] !== "") {
    section = sections[1];
    abs = -value;
  } else if (value === 0 && sections.length >= 3 && sections[2] !== "") {
    section = sections[2];
  } else if (value < 0) {
    abs = -value;
    sign = "-";
  }
  if (/^general$/i.test(section.trim())) return sign + String(abs);

  const tokens = tokenize(section);
  if (!tokens) return String(value);
  const firstPh = tokens.findIndex((t) => t.kind === "ph");
  if (firstPh === -1) {
    // No digits at all: literals only (`"n/a"`), or `@`, which shows the value itself.
    return sign + tokens.map((t) => (t.kind === "lit" ? t.text : t.kind === "at" ? String(abs) : t.kind === "pct" ? "%" : "")).join("");
  }
  let lastPh = tokens.length - 1;
  while (tokens[lastPh].kind !== "ph") lastPh--;
  const dot = tokens.findIndex((t, i) => t.kind === "dot" && i > firstPh && i <= lastPh + 1);

  const numeric = tokens.slice(firstPh, lastPh + 1);
  const intTokens = dot === -1 ? numeric : tokens.slice(firstPh, dot);
  const decTokens = dot === -1 ? [] : tokens.slice(dot + 1, lastPh + 1);
  const intPh = intTokens.filter((t) => t.kind === "ph") as Extract<Token, { kind: "ph" }>[];
  const decPh = decTokens.filter((t) => t.kind === "ph") as Extract<Token, { kind: "ph" }>[];

  // A comma between integer placeholders groups thousands; commas right after the last one divide by 1000.
  let scaleCommas = 0;
  for (let i = (dot === -1 ? lastPh + 1 : dot) - 1; i >= firstPh && tokens[i].kind === "comma"; i--) scaleCommas++;
  const afterLast = tokens.slice(lastPh + 1);
  for (const t of afterLast) {
    if (t.kind === "comma") scaleCommas++;
    else break;
  }
  const grouping = intTokens.some((t, i) => t.kind === "comma" && intTokens.slice(i + 1).some((u) => u.kind === "ph"));
  const percents = tokens.filter((t) => t.kind === "pct").length;

  let scaled = abs * Math.pow(100, percents) / Math.pow(1000, scaleCommas);
  const decimals = decPh.length;
  // Rounded the way Excel does: to 15 significant digits first, so 1.2345 (stored as 1.23449999…)
  // shows as 1.235, then half away from zero at the shown precision.
  const precise = Number(scaled.toPrecision(15));
  const fixed =
    precise >= 1e15 ? precise.toFixed(decimals) : Number(`${Math.round(Number(`${precise}e${decimals}`))}e-${decimals}`).toFixed(decimals);
  const [intDigitsRaw, decDigitsRaw = ""] = fixed.split(".");
  scaled = Number(fixed);

  // Integer part: `0` places always show, `#` only when there is a digit, `?` a space in its stead.
  const minInt = intPh.filter((p) => p.ch === "0").length;
  let intDigits = intDigitsRaw === "0" && minInt === 0 ? "" : intDigitsRaw;
  if (intDigits.length < minInt) intDigits = intDigits.padStart(minInt, "0");
  const qPad = intPh.filter((p) => p.ch === "?").length - Math.max(intDigits.length, minInt);
  let intText = grouping ? groupThousands(intDigits) : intDigits;
  if (qPad > 0 && intDigits.length < intPh.length) intText = " ".repeat(Math.min(qPad, intPh.length - intDigits.length)) + intText;

  // Decimal part: trailing `#` digits that are zero drop, trailing `?` become spaces.
  let decText = "";
  if (dot !== -1) {
    const chars = decDigitsRaw.split("");
    for (let i = decPh.length - 1; i >= 0 && chars[i] === "0" && decPh[i].ch !== "0"; i--) chars[i] = decPh[i].ch === "?" ? " " : "";
    decText = "." + chars.join("");
  }

  // Literals sitting between integer placeholders (`000-0000`) keep their places, filled right to left.
  const innerLits = intTokens.some((t, i) => t.kind === "lit" && i > 0);
  if (innerLits && !grouping) {
    const digits = intDigits.split("");
    const out: string[] = [];
    for (let i = intTokens.length - 1; i >= 0; i--) {
      const t = intTokens[i];
      if (t.kind === "ph") {
        const isFirst = intTokens.findIndex((u) => u.kind === "ph") === i;
        if (isFirst) out.unshift(digits.join(""));
        else out.unshift(digits.length ? digits.pop()! : t.ch === "0" ? "0" : t.ch === "?" ? " " : "");
      } else if (t.kind === "lit") out.unshift(t.text);
    }
    intText = out.join("");
  }

  const lit = (list: Token[]) => list.map((t) => (t.kind === "lit" ? t.text : t.kind === "pct" ? "%" : t.kind === "at" ? String(value) : "")).join("");
  const prefix = lit(tokens.slice(0, firstPh));
  const suffix = lit(tokens.slice(lastPh + 1).filter((t) => t.kind !== "comma"));
  const decLits = lit(decTokens.filter((t) => t.kind === "lit" || t.kind === "pct"));
  const shownZero = scaled === 0;
  return (shownZero ? "" : sign) + prefix + intText + decText + decLits + suffix;
}

/** Whether a code shows its number multiplied by 100 — Excel's percent. */
export function isPercentCode(code: string): boolean {
  const first = splitSections(code)[0].replace(/"[^"]*"/g, "").replace(/\\./g, "").replace(/\[[^\]]*\]/g, "");
  return first.includes("%");
}
