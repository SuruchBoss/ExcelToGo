import { describe, expect, it } from "vitest";
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
