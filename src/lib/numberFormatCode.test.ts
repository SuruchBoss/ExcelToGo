// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { formatNumberCode, isPercentCode } from "./numberFormatCode";

/**
 * Number-format codes as Excel shows them (#53). Expected values are Excel's own: type the value,
 * set Format Cells → Custom to the code, read the cell.
 */
describe("the codes #53 found shown wrongly", () => {
  it("shows the issue's table the way Excel does", () => {
    expect(formatNumberCode(0.07, "0%")).toBe("7%");
    expect(formatNumberCode(0.125, "0.0%")).toBe("12.5%");
    expect(formatNumberCode(0.5, "0.00%")).toBe("50.00%");
    expect(formatNumberCode(0.3846, "0.00%")).toBe("38.46%");
    expect(formatNumberCode(1234.5, '"$"#,##0.00')).toBe("$1,234.50");
    expect(formatNumberCode(1.2345, "0.000")).toBe("1.235");
    expect(formatNumberCode(12345, "#,##0")).toBe("12,345");
  });

  it("keeps the old app's literal percent as it was: no ×100", () => {
    expect(formatNumberCode(50, '0.00"%"')).toBe("50.00%");
    expect(isPercentCode('0.00"%"')).toBe(false);
    expect(isPercentCode("0.00%")).toBe(true);
  });
});

describe("the rest of the language numbers use", () => {
  it("negative and zero sections, and a minus sign when there is only one", () => {
    expect(formatNumberCode(-1234, "#,##0;(#,##0)")).toBe("(1,234)");
    expect(formatNumberCode(0, '#,##0;(#,##0);"-"')).toBe("-");
    expect(formatNumberCode(-5, '"$"#,##0')).toBe("-$5");
    expect(formatNumberCode(-0.001, "0.00")).toBe("0.00");
  });

  it("currency tags, colour tags, scaling commas and optional digits", () => {
    expect(formatNumberCode(1234.5, "[$€-407]#,##0.00")).toBe("€1,234.50");
    expect(formatNumberCode(-3, "[Red]0;[Blue]-0")).toBe("-3");
    expect(formatNumberCode(1500000, '#,##0.0,,"M"')).toBe("1.5M");
    expect(formatNumberCode(0.5, "#.##")).toBe(".5");
    expect(formatNumberCode(3, "#.##")).toBe("3.");
    expect(formatNumberCode(7, "000")).toBe("007");
    expect(formatNumberCode(1234567, "#,##0.00")).toBe("1,234,567.00");
  });

  it("literals between digits keep their places", () => {
    expect(formatNumberCode(812345678, "000-000-0000")).toBe("081-234-5678");
  });

  it("falls back to the plain number for fractions and scientific notation", () => {
    expect(formatNumberCode(0.25, "# ?/?")).toBe("0.25");
    expect(formatNumberCode(12345, "0.00E+00")).toBe("12345");
    expect(formatNumberCode(12.5, "General")).toBe("12.5");
  });
});
