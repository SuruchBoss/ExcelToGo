// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { heuristicSuggest } from "./aiHeuristic";

describe("the keyword matcher", () => {
  it("uses the range it is given rather than inventing one", () => {
    expect(heuristicSuggest("รวมยอดขายทั้งหมด", "E2:E11", "th").formula).toBe("=SUM(E2:E11)");
  });

  it("matches English words typed into the Thai UI, and the other way round", () => {
    expect(heuristicSuggest("average of this column", "B2:B9", "th").formula).toBe("=AVERAGE(B2:B9)");
    expect(heuristicSuggest("หาค่ามากที่สุด", "B2:B9", "en").formula).toBe("=MAX(B2:B9)");
  });

  it("explains itself in the language it was asked in", () => {
    expect(heuristicSuggest("รวม", "A1:A5", "th").explanation).toMatch(/[฀-๿]/);
    expect(heuristicSuggest("รวม", "A1:A5", "en").explanation).not.toMatch(/[฀-๿]/);
  });

  it("writes the words an IF puts in the sheet in that language too", () => {
    // Not just the explanation: these land in cells, and an English sheet was getting "ผ่าน".
    expect(heuristicSuggest("if it is over zero", "A1:A5", "en").formula).toBe('=IF(A1>0,"Pass","Fail")');
    expect(heuristicSuggest("ถ้ามากกว่าศูนย์", "A1:A5", "th").formula).toBe('=IF(A1>0,"ผ่าน","ไม่ผ่าน")');
  });
});

describe("questions it cannot answer", () => {
  /**
   * The failure this suite exists for. Asked to join two text columns, the matcher used to reply
   * `=SUM(E2)` — because SUM was the catch-all for anything unrecognised. That lands 0 in the cell
   * with no error, which is the one wrong answer nobody notices. Measured on the public demo,
   * where this matcher is not a fallback but the only thing a visitor ever sees.
   */
  it("declines instead of guessing SUM", () => {
    const out = heuristicSuggest("อยากได้อะไรสักอย่างที่ไม่มีคำสำคัญเลย", "E2:E11", "th");
    expect(out.formula).toBeNull();
    expect(out.explanation).not.toBe("");
  });

  it("never answers a question about text with a formula that adds numbers", () => {
    for (const q of [
      "ต่อชื่อสินค้ากับหมวดหมู่เข้าด้วยกัน",
      "เชื่อมข้อความสองคอลัมน์",
      "join the first and last name",
      "concat these columns",
    ]) {
      expect(heuristicSuggest(q, "E2:E11", "th").formula, q).not.toMatch(/^=SUM/);
    }
  });

  it("reads 'รวมข้อความ' as joining text, not as adding up", () => {
    // Both rules' keywords appear in the sentence; the narrower one has to win.
    expect(heuristicSuggest("รวมข้อความสองช่องนี้", "A1:A5", "th").formula).toMatch(/^=CONCATENATE/);
  });

  it("still reads 'นับจำนวนข้อความ' as COUNTA, not COUNT", () => {
    expect(heuristicSuggest("นับจำนวนข้อความในคอลัมน์", "A1:A5", "th").formula).toBe("=COUNTA(A1:A5)");
  });
});
