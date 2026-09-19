import { describe, expect, it } from "vitest";
import { createEmptySheet } from "./sheet";
import { withFreeze } from "./sheetFreeze";
import { pageLabel, pageSetupFor } from "./pageSetup";

const sheet = () => createEmptySheet(50, 30);

describe("which way up the page goes", () => {
  it("stays portrait for a sheet that fits", () => {
    expect(pageSetupFor(sheet(), 5).orientation).toBe("portrait");
  });

  it("turns the page for a wide one", () => {
    expect(pageSetupFor(sheet(), 12).orientation).toBe("landscape");
  });
});

describe("how small the type gets", () => {
  it("leaves a narrow sheet at a readable size", () => {
    // Shrinking a four-column sheet to fit would be making it worse for no reason.
    expect(pageSetupFor(sheet(), 4).fontSize).toBe(8);
  });

  it("comes down as the sheet gets wider", () => {
    const narrow = pageSetupFor(sheet(), 6).fontSize;
    const wide = pageSetupFor(sheet(), 20).fontSize;
    expect(wide).toBeLessThan(narrow);
  });

  it("stops shrinking rather than producing a grey rectangle", () => {
    // Past a point the page says nothing whatever the size, and going smaller only makes the
    // document look like it is trying to hide something.
    expect(pageSetupFor(sheet(), 200).fontSize).toBe(5);
    expect(pageSetupFor(sheet(), 5000).fontSize).toBe(5);
  });

  it("gets more room from the turned page, and uses it", () => {
    // Nine columns tips into landscape, which is wider — so the type does not have to shrink as
    // far as the same nine columns would need in portrait.
    expect(pageSetupFor(sheet(), 9).fontSize).toBeGreaterThanOrEqual(pageSetupFor(sheet(), 8).fontSize - 1);
  });
});

describe("what gets repeated at the top of every page", () => {
  it("repeats nothing when the sheet has not said what its heading is", () => {
    expect(pageSetupFor(sheet(), 5).headerRows).toBe(0);
  });

  it("takes the answer from the frozen rows rather than asking again", () => {
    // Somebody who froze two rows has already said which rows are the heading.
    expect(pageSetupFor(withFreeze(sheet(), { rows: 2, cols: 0 }), 5).headerRows).toBe(2);
  });

  it("ignores frozen columns, which are not a heading", () => {
    expect(pageSetupFor(withFreeze(sheet(), { rows: 0, cols: 3 }), 5).headerRows).toBe(0);
  });

  it("caps it, because a heading that fills a quarter of the page is not a heading", () => {
    expect(pageSetupFor(withFreeze(sheet(), { rows: 9, cols: 0 }), 5).headerRows).toBe(3);
  });
});

describe("page numbers", () => {
  it("says which page of how many, in the reader's language", () => {
    // A twelve-page export with nothing on it to say which came first is a pile, not a report.
    expect(pageLabel(2, 7, "th")).toBe("หน้า 2 / 7");
    expect(pageLabel(2, 7, "en")).toBe("Page 2 of 7");
  });
});
