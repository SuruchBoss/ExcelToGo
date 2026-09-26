// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { needsRaisedMarks, planThaiMarks } from "./thaiMarks";

describe("needsRaisedMarks", () => {
  it("spots a tone mark stacked on an upper vowel", () => {
    // ที่ = ท + ี (upper vowel) + ่ (tone). This is the case that renders as "ที".
    for (const word of ["ที่", "นี่", "ดื่ม", "ซื้อ", "ที่นี่", "หนึ่ง", "มั่น"]) {
      expect(needsRaisedMarks(word), word).toBe(true);
    }
  });

  it("leaves alone the marks that are already in the right place", () => {
    // ป่า: tone straight on the consonant. ผู้: tone over a *lower* vowel. ดี: vowel, no tone.
    for (const word of ["ป่า", "ผู้", "ดี", "กาแฟ", "ขนมปัง", "รวม", "ABC123", ""]) {
      expect(needsRaisedMarks(word), word).toBe(false);
    }
  });
});

describe("planThaiMarks", () => {
  it("returns the string untouched when nothing collides", () => {
    expect(planThaiMarks("ป่า")).toEqual({ base: "ป่า", raised: [] });
  });

  it("pulls the colliding mark out and remembers what comes before it", () => {
    const plan = planThaiMarks("ที่");
    expect(plan.base).toBe("ที"); // drawn normally
    expect(plan.raised).toEqual([{ char: "่", prefix: "ที" }]);
  });

  it("keeps the rest of the word after the lifted mark", () => {
    const plan = planThaiMarks("ดื่ม");
    expect(plan.base).toBe("ดืม");
    expect(plan.raised).toEqual([{ char: "่", prefix: "ดื" }]);
  });

  it("handles more than one collision in a string", () => {
    const plan = planThaiMarks("ที่นี่");
    expect(plan.base).toBe("ทีนี");
    expect(plan.raised).toEqual([
      { char: "่", prefix: "ที" },
      { char: "่", prefix: "ทีนี" },
    ]);
  });

  it("does not lift a mark that follows a lower vowel", () => {
    // ผู้ = ผ + ู (below) + ้ — already clear of the consonant, so it stays put.
    expect(planThaiMarks("ผู้")).toEqual({ base: "ผู้", raised: [] });
  });

  it("puts back exactly the original characters", () => {
    for (const word of ["ที่", "ดื่ม", "ที่นี่ดื่มซื้อ", "ป่า"]) {
      const { base, raised } = planThaiMarks(word);
      const sorted = (s: string) => [...s].sort().join("");
      expect(sorted(base + raised.map((r) => r.char).join("")), word).toBe(sorted(word));
    }
  });

  it("leaves a lone mark with no vowel before it alone", () => {
    expect(planThaiMarks("่")).toEqual({ base: "่", raised: [] });
  });
});
