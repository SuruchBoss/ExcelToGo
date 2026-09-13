import { describe, expect, it } from "vitest";
import { clampComments, commentKey, getComment, setComment, shiftComments } from "./cellComments";
import { createEmptySheet, deleteColumn, deleteRow, insertColumnBefore, insertRowBefore, SheetModel } from "./sheet";

describe("writing a note", () => {
  it("stores it against the cell", () => {
    const out = setComment(undefined, 2, 3, "รอบัญชียืนยัน");
    expect(getComment(out, 2, 3)).toBe("รอบัญชียืนยัน");
  });

  it("trims what was typed, so a stray space isn't a note", () => {
    expect(getComment(setComment(undefined, 0, 0, "  ตรวจแล้ว  "), 0, 0)).toBe("ตรวจแล้ว");
  });

  it("removes the note when the text is emptied", () => {
    // A marker on a cell with nothing behind it promises information that isn't there.
    const one = setComment(undefined, 1, 1, "x");
    expect(setComment(one, 1, 1, "   ")).toBeUndefined();
  });

  it("leaves other notes alone when one is removed", () => {
    let comments = setComment(undefined, 0, 0, "a");
    comments = setComment(comments, 5, 5, "b");
    comments = setComment(comments, 0, 0, "");
    expect(getComment(comments, 0, 0)).toBeUndefined();
    expect(getComment(comments, 5, 5)).toBe("b");
  });

  it("doesn't mutate what it was given", () => {
    const before = setComment(undefined, 0, 0, "a")!;
    setComment(before, 1, 1, "b");
    expect(Object.keys(before)).toEqual([commentKey(0, 0)]);
  });
});

describe("notes following edits to the sheet", () => {
  const comments = { [commentKey(3, 2)]: "note" };

  it("moves down when a row is inserted above", () => {
    expect(getComment(shiftComments(comments, "row", 1, 1), 4, 2)).toBe("note");
  });

  it("moves up when a row above is deleted", () => {
    expect(getComment(shiftComments(comments, "row", 1, -1), 2, 2)).toBe("note");
  });

  it("moves right when a column is inserted to its left", () => {
    expect(getComment(shiftComments(comments, "col", 0, 1), 3, 3)).toBe("note");
  });

  it("goes with the row it was written about when that row is deleted", () => {
    // A note is written *about* a cell, unlike a chart which is merely placed *near* one — so
    // re-pointing it at whatever slides into the gap would attach it to data it never described.
    expect(shiftComments(comments, "row", 3, -1)).toBeUndefined();
  });

  it("goes with its column when that column is deleted", () => {
    expect(shiftComments(comments, "col", 2, -1)).toBeUndefined();
  });

  it("stays put when the edit is below or to the right of it", () => {
    expect(shiftComments(comments, "row", 9, 1)).toEqual(comments);
    expect(shiftComments(comments, "col", 9, -1)).toEqual(comments);
  });

  it("keeps the other notes when one of several is deleted away", () => {
    const many = { [commentKey(0, 0)]: "a", [commentKey(3, 0)]: "b" };
    const out = shiftComments(many, "row", 3, -1);
    expect(getComment(out, 0, 0)).toBe("a");
    expect(Object.keys(out!)).toHaveLength(1);
  });
});

describe("notes outside the sheet", () => {
  it("are dropped", () => {
    expect(clampComments({ [commentKey(99, 0)]: "gone", [commentKey(1, 1)]: "kept" }, 10, 10)).toEqual({
      [commentKey(1, 1)]: "kept",
    });
  });
});

describe("wired into the sheet", () => {
  function sheetWithNote(row = 3, col = 2): SheetModel {
    const sheet = createEmptySheet(8, 5);
    sheet.comments = { [commentKey(row, col)]: "note" };
    return sheet;
  }

  it("follows a row inserted above it", () => {
    expect(getComment(insertRowBefore(sheetWithNote(), 0).comments, 4, 2)).toBe("note");
  });

  it("follows a deleted row above it", () => {
    expect(getComment(deleteRow(sheetWithNote(), 0).comments, 2, 2)).toBe("note");
  });

  it("follows a column inserted to its left", () => {
    expect(getComment(insertColumnBefore(sheetWithNote(), 0).comments, 3, 3)).toBe("note");
  });

  it("goes away with its own column", () => {
    expect(deleteColumn(sheetWithNote(), 2).comments).toBeUndefined();
  });
});
