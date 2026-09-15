import { describe, expect, it } from "vitest";
import { ChartData } from "./charts";
import {
  addAnchorsToDrawing,
  chartXml,
  colRef,
  drawingAnchorXml,
  emptyDrawingXml,
  esc,
  quoteSheetName,
  seriesRefsFrom,
  SeriesRef,
} from "./xlsxChartXml";
import { colToLetters } from "./formulaEngine/address";

const ser: SeriesRef = {
  name: "Sales",
  nameRef: "Sheet1!$B$1",
  categories: ["Jan", "Feb"],
  categoriesRef: "Sheet1!$A$2:$A$3",
  values: [10, 20],
  valuesRef: "Sheet1!$B$2:$B$3",
};

describe("quoteSheetName", () => {
  it("leaves a bare word alone", () => {
    expect(quoteSheetName("Sheet1")).toBe("Sheet1");
  });

  // Getting this wrong doesn't warn — it produces a chart whose series resolve to nothing.
  it("quotes anything else, including Thai and spaces", () => {
    expect(quoteSheetName("ยอดขาย")).toBe("'ยอดขาย'");
    expect(quoteSheetName("Q1 Sales")).toBe("'Q1 Sales'");
  });

  it("doubles an apostrophe inside the name", () => {
    expect(quoteSheetName("Bob's")).toBe("'Bob''s'");
  });
});

describe("esc", () => {
  it("escapes the characters that would break the XML", () => {
    expect(esc('a & b < c > "d" \'e\'')).toBe("a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;");
  });
});

describe("colRef", () => {
  it("builds an absolute single-column reference", () => {
    expect(colRef("Sheet1", "C", 2, 9)).toBe("Sheet1!$C$2:$C$9");
  });
});

describe("chartXml", () => {
  it("writes a bar chart with paired axis ids", () => {
    const xml = chartXml("bar", [ser]);
    expect(xml).toContain("<c:barChart>");
    // Both axes must exist and each must name the other, or the chart won't render.
    const ids = [...xml.matchAll(/<c:axId val="(\d+)"\/>/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
    expect(xml).toContain("<c:catAx>");
    expect(xml).toContain("<c:valAx>");
  });

  it("writes a line chart with axes and a pie chart without them", () => {
    expect(chartXml("line", [ser])).toContain("<c:lineChart>");
    const pie = chartXml("pie", [ser]);
    expect(pie).toContain("<c:pieChart>");
    expect(pie).not.toContain("<c:catAx>");
    expect(pie).not.toContain("<c:axId");
  });

  // A reader that doesn't recalculate — every previewer and converter — draws the cache. Writing
  // references alone gives a chart that is correct and blank.
  it("caches the values as well as referencing them", () => {
    const xml = chartXml("bar", [ser]);
    expect(xml).toContain("<c:f>Sheet1!$B$2:$B$3</c:f>");
    expect(xml).toContain("<c:numCache>");
    expect(xml).toContain('<c:pt idx="0"><c:v>10</c:v></c:pt>');
    expect(xml).toContain("<c:strCache>");
    expect(xml).toContain("<c:v>Jan</c:v>");
  });

  it("omits a cached point for a gap rather than writing a bogus number", () => {
    const withGap = chartXml("bar", [{ ...ser, values: [10, NaN, 30] }]);
    expect(withGap).toContain('<c:ptCount val="3"/>');
    expect(withGap).toContain("<c:v>10</c:v>");
    expect(withGap).toContain("<c:v>30</c:v>");
    expect(withGap).toContain('<c:dispBlanksAs val="gap"/>');
  });

  it("escapes a title and a series name", () => {
    expect(chartXml("bar", [{ ...ser, name: "A & B", nameRef: undefined }], "R&D")).toContain("<a:t>R&amp;D</a:t>");
  });

  it("marks the title deleted when there isn't one", () => {
    expect(chartXml("bar", [ser])).toContain('<c:autoTitleDeleted val="1"/>');
  });
});

describe("drawing parts", () => {
  it("anchors a chart between two cells and points at its relationship", () => {
    const xml = drawingAnchorXml({ fromCol: 4, fromRow: 1, toCol: 12, toRow: 16 }, "rId3", 2, "Chart 1");
    expect(xml).toContain("<xdr:col>4</xdr:col>");
    expect(xml).toContain("<xdr:row>16</xdr:row>");
    expect(xml).toContain('r:id="rId3"');
  });

  // An empty drawing is written self-closing, which has no end tag to insert before.
  it("reopens a self-closing drawing to add the first anchor", () => {
    const out = addAnchorsToDrawing(emptyDrawingXml(), ["<xdr:twoCellAnchor/>"]);
    expect(out).not.toMatch(/<xdr:wsDr[^>]*\/>/);
    expect(out).toContain("<xdr:twoCellAnchor/>");
    expect(out.trimEnd().endsWith("</xdr:wsDr>")).toBe(true);
  });

  it("appends to a drawing that already holds something", () => {
    const existing = emptyDrawingXml().replace(/\/>$/, "><xdr:oneCellAnchor/></xdr:wsDr>");
    const out = addAnchorsToDrawing(existing, ["<xdr:twoCellAnchor/>"]);
    expect(out).toContain("<xdr:oneCellAnchor/>");
    expect(out).toContain("<xdr:twoCellAnchor/>");
  });

  it("leaves the drawing untouched when there is nothing to add", () => {
    expect(addAnchorsToDrawing(emptyDrawingXml(), [])).toBe(emptyDrawingXml());
  });
});

describe("seriesRefsFrom", () => {
  const data: ChartData = {
    labels: ["Jan", "Feb", "Mar"],
    series: [
      { name: "Sales", points: [1, 2, 3] },
      { name: "Profit", points: [4, 5, 6] },
    ],
    usedHeaderRow: true,
    usedLabelColumn: true,
  };
  const range = { startRow: 0, startCol: 0, endRow: 3, endCol: 2 };

  it("skips the header row and the label column when the data used them", () => {
    const [sales, profit] = seriesRefsFrom(data, "Sheet1", range, colToLetters);
    // Labels in column A, series in B and C, data starting on row 2 (header is row 1).
    expect(sales.categoriesRef).toBe("Sheet1!$A$2:$A$4");
    expect(sales.valuesRef).toBe("Sheet1!$B$2:$B$4");
    expect(sales.nameRef).toBe("Sheet1!$B$1");
    expect(profit.valuesRef).toBe("Sheet1!$C$2:$C$4");
  });

  it("starts at the first row when there was no header", () => {
    const [s] = seriesRefsFrom({ ...data, usedHeaderRow: false }, "Sheet1", range, colToLetters);
    expect(s.valuesRef).toBe("Sheet1!$B$1:$B$4");
    expect(s.nameRef).toBeUndefined();
  });

  it("takes only the chosen series for a pie", () => {
    const refs = seriesRefsFrom(data, "Sheet1", range, colToLetters, 1, true);
    expect(refs).toHaveLength(1);
    expect(refs[0].name).toBe("Profit");
    expect(refs[0].valuesRef).toBe("Sheet1!$C$2:$C$4");
  });

  it("quotes a Thai sheet name in every reference it builds", () => {
    const [s] = seriesRefsFrom(data, "ยอดขาย", range, colToLetters);
    expect(s.valuesRef.startsWith("'ยอดขาย'!")).toBe(true);
    expect(s.categoriesRef!.startsWith("'ยอดขาย'!")).toBe(true);
  });
});
