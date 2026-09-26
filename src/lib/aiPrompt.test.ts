// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { FUNCTIONS } from "./formulaEngine/functions";
import { SYSTEM_PROMPTS, buildUserMessage, parseFormulaReply, parseLocale } from "./aiPrompt";

describe("the user message", () => {
  it("carries the question on its own when nothing else is known", () => {
    expect(buildUserMessage("sum the column")).toBe("User's request: sum the column");
  });

  it("adds the selection and the headers when they exist", () => {
    const msg = buildUserMessage("sum sales", "C2:C11", ["Item", "Price"]);
    expect(msg).toContain("Selected cell range: C2:C11");
    expect(msg).toContain("Column headers: Item, Price");
  });

  it("leaves out an empty header list rather than sending an empty line", () => {
    expect(buildUserMessage("sum", "A1:A5", [])).not.toContain("Column headers");
  });
});

describe("parsing the reply", () => {
  it("reads the formula and the explanation", () => {
    expect(parseFormulaReply('{"formula":"=SUM(A1:A9)","explanation":"adds them up"}')).toEqual({
      formula: "=SUM(A1:A9)",
      explanation: "adds them up",
    });
  });

  it("finds the object even when the model wraps it in prose or a fence", () => {
    const reply = '```json\n{"formula":"=MAX(B:B)","explanation":"largest"}\n```';
    expect(parseFormulaReply(reply).formula).toBe("=MAX(B:B)");
  });

  it("tolerates a missing explanation", () => {
    expect(parseFormulaReply('{"formula":"=NOW()"}').explanation).toBe("");
  });

  it("refuses a formula that does not start with =", () => {
    // It would be inserted into a cell verbatim, and text that looks like a formula but is not
    // reads as a broken app rather than a bad answer.
    expect(() => parseFormulaReply('{"formula":"SUM(A1:A9)"}')).toThrow("invalid_formula");
  });

  it("refuses a reply with no JSON at all", () => {
    expect(() => parseFormulaReply("I'm not sure what you mean.")).toThrow("no_json_in_response");
  });

  it("keeps the formula when the reply was cut off mid-explanation", () => {
    // What a `stop_reason: "max_tokens"` reply looks like: the formula is complete because it is
    // the first field, the explanation is not, and there is no closing brace. Measured against the
    // real API — "how many unique branch names are there" came back exactly like this.
    const truncated = '{"formula": "=COUNTA(UNIQUE(B2:B100))", "explanation": "Note: the range must not contain blank';
    expect(parseFormulaReply(truncated)).toEqual({
      formula: "=COUNTA(UNIQUE(B2:B100))",
      explanation: "",
    });
  });

  it("unescapes a salvaged formula rather than handing back its escaping", () => {
    const truncated = '{"formula": "=SUMIF(B:B,\\"north\\",E:E)", "explanation": "Adds up the';
    expect(parseFormulaReply(truncated).formula).toBe('=SUMIF(B:B,"north",E:E)');
  });

  it("still refuses a cut-off reply whose formula is not a formula", () => {
    expect(() => parseFormulaReply('{"formula": "SUM(A1:A2)", "explanation": "no equals')).toThrow("invalid_formula");
  });
});

describe("locale", () => {
  it("is Thai unless English is asked for", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("th")).toBe("th");
    expect(parseLocale(undefined)).toBe("th");
    expect(parseLocale("fr")).toBe("th");
  });

  it("tells the model which language to explain in", () => {
    expect(SYSTEM_PROMPTS.th).toContain("ภาษาไทยเสมอ");
    expect(SYSTEM_PROMPTS.en).toContain("must always be in English");
  });
});

describe("the function list the model is given", () => {
  /**
   * Asked with a real key, the model answered fourteen ordinary questions with six formulas this
   * engine cannot run — TEXTJOIN, CHAR, FIND, RANK.EQ, SUMPRODUCT, CEILING. All valid Excel, all
   * `#NAME?` in the cell, after the user clicked a button labelled "insert". Telling the model what
   * exists here is the fix; these tests are so the telling cannot go stale or go missing.
   */
  it("names every function the engine actually has", () => {
    for (const name of Object.keys(FUNCTIONS)) {
      expect(SYSTEM_PROMPTS.th, `th prompt is missing ${name}`).toContain(name);
      expect(SYSTEM_PROMPTS.en, `en prompt is missing ${name}`).toContain(name);
    }
  });

  it("names nothing the engine does not have", () => {
    // The list is generated from FUNCTIONS, so this only fails if someone hand-writes an addition —
    // which is exactly the drift worth catching, because the model would then be told to use it.
    const known = new Set(Object.keys(FUNCTIONS));
    for (const prompt of [SYSTEM_PROMPTS.th, SYSTEM_PROMPTS.en]) {
      const listed = prompt.split("#NAME?")[1] ?? "";
      for (const word of listed.match(/\b[A-Z][A-Z0-9.]{2,}\b/g) ?? []) {
        if (word === "NAME" || word === "JSON" || word === "SUM") continue;
        expect(known.has(word), `prompt offers ${word}, which the engine cannot evaluate`).toBe(true);
      }
    }
  });

  it("tells the model to warn rather than substitute something unrelated", () => {
    // The first attempt at this rule said "give the closest formula the list allows", and the model
    // answered "join these names" with =SUM(A2:A20) — 0 in the cell, no error, no way for anyone to
    // notice. A visible #NAME? is better than a plausible wrong number.
    expect(SYSTEM_PROMPTS.en).toContain("Never substitute an unrelated function");
    expect(SYSTEM_PROMPTS.en).toContain("still give the correct Excel formula");
    expect(SYSTEM_PROMPTS.th).toContain("ห้ามเปลี่ยนไปใช้ฟังก์ชันอื่นที่ไม่ตรงโจทย์");
  });
});
