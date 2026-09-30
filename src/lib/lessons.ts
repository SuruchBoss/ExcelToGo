// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

import { computeSheet, createEmptySheet, type SheetModel } from "./sheet";
import { cellRef, parseCellRef } from "./formulaEngine/address";

/**
 * One formula taught on a page of its own (#149), in Thai.
 *
 * What a lesson holds is what only a person can write: the sentence that answers the question, a
 * small table someone would really have, the formula, and the mistakes people really make. What it
 * does **not** hold is any result. Every number a page shows comes from putting the table and the
 * formula through the same engine the app uses, when the page renders — so a lesson cannot say
 * "450" while the app says something else, and a wrong example shows what the engine really does
 * with it rather than what the writer expected.
 *
 * The name, the syntax and what each argument means come from the formula palette
 * (`formulaCatalog` + `i18n`), so the page and the app describe a formula in the same words.
 */
export interface Lesson {
  /** The page's address under /formulas: the palette id, lower case. */
  slug: string;
  /** The palette id this lesson teaches. A test fails if the palette has no such formula. */
  id: string;
  /** What it does, in a few words — the second half of the page title. */
  short: string;
  /** The first sentence on the page, and its meta description: the answer, before any detail. */
  lead: string;
  example: {
    caption: string;
    /** The table, row by row, as typed into cells: text, numbers, and one or more formulas. */
    grid: string[][];
    /** The cell whose value the example is about, e.g. "C7". It holds the formula being taught. */
    result: string;
    /** Rows the formula picks out, shaded on the page (1-based, like the row numbers shown). */
    picked?: number[];
    explain: string;
  };
  mistakes: Mistake[];
  /** Palette ids worth reading next. Only those with a page of their own become links. */
  related: string[];
}

export interface Mistake {
  title: string;
  /** The formula as people get it wrong, put in the example's result cell. Absent: the formula is
   *  right and the table is what went wrong (`cells`). */
  formula?: string;
  /** Cells changed from the example to set up the mistake, by address. */
  cells?: Record<string, string>;
  why: string;
}

export const LESSONS: Lesson[] = [
  {
    slug: "sum",
    id: "SUM",
    short: "รวมตัวเลขทั้งช่วง",
    lead: "SUM รวมตัวเลขทุกเซลล์ในช่วงที่เลือก เช่น ยอดขายทั้งสัปดาห์ในคอลัมน์เดียว ใส่ช่วงครั้งเดียวแทนการบวกทีละเซลล์",
    example: {
      caption: "รวมยอดขายทั้งสัปดาห์",
      grid: [
        ["วัน", "ยอดขาย"],
        ["จันทร์", "1200"],
        ["อังคาร", "950"],
        ["พุธ", "1430"],
        ["พฤหัสบดี", "800"],
        ["ศุกร์", "1620"],
        ["รวม", "=SUM(B2:B6)"],
      ],
      result: "B7",
      picked: [2, 3, 4, 5, 6],
      explain: "B2:B6 คือช่วงตั้งแต่ B2 ถึง B6 SUM เอาตัวเลขทุกเซลล์ในช่วงนั้นมาบวกกัน เพิ่มวันใหม่ในช่วงเมื่อไรผลก็เปลี่ยนตาม",
    },
    mistakes: [
      {
        title: "บวกทีละเซลล์แล้วตกไปหนึ่งเซลล์",
        formula: "=B2+B3+B4+B5",
        why: "สูตรยาว ๆ ที่บวกทีละเซลล์พลาดง่าย และพอเพิ่มแถวใหม่ก็ไม่รวมให้ ใช้ SUM กับช่วงแทน",
      },
      {
        title: "ตัวเลขที่พิมพ์หน่วยติดมาด้วย",
        cells: { B4: "1430 บาท" },
        why: "\"1430 บาท\" เป็นข้อความ ไม่ใช่ตัวเลข SUM จึงข้ามไปเงียบ ๆ ผลรวมขาดไปโดยไม่มีอะไรเตือน พิมพ์แค่ตัวเลข แล้วใช้รูปแบบตัวเลขแสดงหน่วยแทน",
      },
    ],
    related: ["SUMIF", "AVERAGE", "COUNT"],
  },
  {
    slug: "sumif",
    id: "SUMIF",
    short: "รวมเฉพาะแถวที่ตรงเงื่อนไข",
    lead: "SUMIF รวมตัวเลขเฉพาะแถวที่ตรงเงื่อนไข เช่น ยอดขายของสาขาเหนืออย่างเดียว โดยไม่ต้องกรองหรือแยกตารางก่อน",
    example: {
      caption: "รวมยอดขายของสาขาเหนือ",
      grid: [
        ["สาขา", "สินค้า", "ยอดขาย"],
        ["เหนือ", "ปากกา", "120"],
        ["ใต้", "ดินสอ", "80"],
        ["เหนือ", "สมุด", "250"],
        ["กลาง", "ปากกา", "90"],
        ["เหนือ", "ยางลบ", "80"],
        ["รวมเหนือ", "", '=SUMIF(A2:A6,"เหนือ",C2:C6)'],
      ],
      result: "C7",
      picked: [2, 4, 6],
      explain: "ตรวจคอลัมน์ A ทีละแถว แถวไหนเป็น \"เหนือ\" ก็เอาค่าในคอลัมน์ C ของแถวนั้นมารวม แถวอื่นข้ามไป",
    },
    mistakes: [
      {
        title: "ใช้ SUM รวมทั้งคอลัมน์",
        formula: "=SUM(C2:C6)",
        why: "SUM ไม่ดูเงื่อนไข จึงรวมทุกสาขา ได้ยอดขายทั้งหมดแทนยอดของสาขาเหนือ ถ้าจะเลือกแถวต้องใช้ SUMIF",
      },
      {
        title: "สลับช่วงที่ตรวจกับช่วงที่รวม",
        formula: '=SUMIF(C2:C6,"เหนือ",A2:A6)',
        why: "ช่วงแรกคือที่ตรวจเงื่อนไข ช่วงสุดท้ายคือที่รวม สลับกันแล้วสูตรไปหา \"เหนือ\" ในคอลัมน์ยอดขาย ซึ่งไม่มี ผลเลยเป็น 0",
      },
    ],
    related: ["SUM", "COUNTIF", "SUMIFS", "IF"],
  },
  {
    slug: "countif",
    id: "COUNTIF",
    short: "นับเฉพาะเซลล์ที่ตรงเงื่อนไข",
    lead: "COUNTIF นับว่ามีกี่เซลล์ที่ตรงเงื่อนไข เช่น มีกี่คนที่ส่งงานแล้ว หรือมีกี่รายการที่ราคาเกิน 100",
    example: {
      caption: "นับคนที่ส่งงานแล้ว",
      grid: [
        ["ชื่อ", "สถานะ"],
        ["มานี", "ส่งแล้ว"],
        ["ปิติ", "ยังไม่ส่ง"],
        ["ชูใจ", "ส่งแล้ว"],
        ["วีระ", "ส่งแล้ว"],
        ["มานะ", "ยังไม่ส่ง"],
        ["ส่งแล้ว", '=COUNTIF(B2:B6,"ส่งแล้ว")'],
      ],
      result: "B7",
      picked: [2, 4, 5],
      explain: "ดูคอลัมน์ B ทีละเซลล์ นับเฉพาะเซลล์ที่เป็น \"ส่งแล้ว\" ทุกตัวอักษร เงื่อนไขเป็นตัวเลขก็ได้ เช่น \">100\"",
    },
    mistakes: [
      {
        title: "มีช่องว่างเกินท้ายคำในตาราง",
        cells: { B4: "ส่งแล้ว " },
        why: "\"ส่งแล้ว \" ที่มีช่องว่างต่อท้ายไม่เท่ากับ \"ส่งแล้ว\" จึงไม่ถูกนับ ทั้งที่บนจอดูเหมือนกัน เจอบ่อยในข้อมูลที่คัดลอกมาจากที่อื่น",
      },
      {
        title: "ใช้ COUNT นับข้อความ",
        formula: "=COUNT(B2:B6)",
        why: "COUNT นับเฉพาะเซลล์ที่เป็นตัวเลข คอลัมน์ที่เป็นข้อความจึงได้ 0 เสมอ นับตามคำต้องใช้ COUNTIF",
      },
    ],
    related: ["SUMIF", "COUNT", "COUNTA", "IF"],
  },
  {
    slug: "if",
    id: "IF",
    short: "เลือกผลตามเงื่อนไขจริงหรือเท็จ",
    lead: "IF ตรวจเงื่อนไขหนึ่งข้อ แล้วเลือกผลว่าจะแสดงอะไรเมื่อจริง และอะไรเมื่อเท็จ เช่น คะแนนตั้งแต่ 50 ขึ้นไปขึ้นว่า \"ผ่าน\"",
    example: {
      caption: "ตัดสินผ่านหรือไม่ผ่านจากคะแนน",
      grid: [
        ["ชื่อ", "คะแนน", "ผล"],
        ["มานี", "72", '=IF(B2>=50,"ผ่าน","ไม่ผ่าน")'],
        ["ปิติ", "50", '=IF(B3>=50,"ผ่าน","ไม่ผ่าน")'],
        ["ชูใจ", "41", '=IF(B4>=50,"ผ่าน","ไม่ผ่าน")'],
        ["วีระ", "88", '=IF(B5>=50,"ผ่าน","ไม่ผ่าน")'],
      ],
      result: "C3",
      explain: "ถ้าคะแนนใน B3 ตั้งแต่ 50 ขึ้นไป ได้ \"ผ่าน\" ถ้าไม่ใช่ ได้ \"ไม่ผ่าน\" ทุกแถวใช้สูตรเดียวกัน แค่เลขแถวเปลี่ยนตาม",
    },
    mistakes: [
      {
        title: "ใช้ > ทั้งที่ตั้งใจให้ 50 ผ่าน",
        formula: '=IF(B3>50,"ผ่าน","ไม่ผ่าน")',
        why: "> แปลว่ามากกว่า 50 เท่านั้น คนที่ได้ 50 พอดีจึงไม่ผ่าน ถ้า 50 ต้องผ่านให้ใช้ >= (มากกว่าหรือเท่ากับ)",
      },
      {
        title: "ลืมเครื่องหมายคำพูดรอบข้อความผล",
        formula: "=IF(B3>=50,ผ่าน,ไม่ผ่าน)",
        why: "ข้อความที่จะแสดงต้องอยู่ในเครื่องหมายคำพูด ส่วนตัวเลขไม่ต้อง",
      },
    ],
    related: ["IFERROR", "AND", "COUNTIF"],
  },
  {
    slug: "vlookup",
    id: "VLOOKUP",
    short: "ค้นหาค่าจากตารางด้วยรหัส",
    lead: "VLOOKUP หาค่าในคอลัมน์แรกของตาราง แล้วดึงค่าจากคอลัมน์อื่นในแถวเดียวกันมา เช่น พิมพ์รหัสสินค้าแล้วได้ราคา",
    example: {
      caption: "ดึงราคาจากรหัสสินค้า",
      grid: [
        ["รหัส", "สินค้า", "ราคา"],
        ["P03", "สมุด", "35"],
        ["P01", "ปากกา", "15"],
        ["P04", "ยางลบ", "10"],
        ["P02", "ดินสอ", "8"],
        ["", "", ""],
        ["P03", "ราคา", "=VLOOKUP(A7,A2:C5,3,FALSE)"],
      ],
      result: "C7",
      picked: [2],
      explain: "หา P03 (ค่าใน A7) ในคอลัมน์แรกของ A2:C5 เจอที่แถว 2 แล้วดึงค่าจากคอลัมน์ที่ 3 ของตาราง คือราคา FALSE แปลว่าต้องตรงทุกตัวอักษร",
    },
    mistakes: [
      {
        title: "ลืมใส่ FALSE ท้ายสูตร",
        formula: "=VLOOKUP(A7,A2:C5,3)",
        why: "ถ้าไม่ใส่ FALSE สูตรจะค้นหาแบบใกล้เคียง ซึ่งถือว่าคอลัมน์แรกเรียงจากน้อยไปมากแล้ว ตารางที่ไม่ได้เรียงจึงได้ค่าจากแถวผิดโดยไม่มีอะไรเตือน",
      },
      {
        title: "นับเลขคอลัมน์จากขอบชีต ไม่ใช่จากตาราง",
        formula: "=VLOOKUP(A7,A2:C5,2,FALSE)",
        why: "เลขคอลัมน์นับจากคอลัมน์แรกของตารางที่เลือก ไม่ใช่จากคอลัมน์ A ของชีต ตารางนี้ราคาอยู่คอลัมน์ที่ 3 ใส่ 2 เลยได้ชื่อสินค้าแทน",
      },
    ],
    related: ["XLOOKUP", "IFERROR", "SUMIF"],
  },
];

export function lessonBySlug(slug: string): Lesson | undefined {
  return LESSONS.find((l) => l.slug === slug);
}

/** The lesson for a palette id, if that formula has a page. */
export function lessonForId(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function lessonPath(lesson: Pick<Lesson, "slug">): string {
  // The same address `lessonCanonical` in seo.ts builds, which cannot import this file (see there).
  return `/formulas/${lesson.slug}`;
}

/** The example as a sheet the app can open: exactly the cells the page shows, nothing more. */
export function lessonSheet(lesson: Lesson, overrides: Record<string, string> = {}): SheetModel {
  const { grid } = lesson.example;
  const cols = Math.max(...grid.map((r) => r.length));
  const sheet = createEmptySheet(Math.max(grid.length, 12), Math.max(cols, 6));
  grid.forEach((row, r) => row.forEach((raw, c) => (sheet.cells[r][c] = raw)));
  for (const [ref, raw] of Object.entries(overrides)) {
    const at = parseCellRef(ref);
    if (at) sheet.cells[at.row][at.col] = raw;
  }
  return sheet;
}

export interface LessonTable {
  /** What each cell shows, as the app would show it. */
  display: string[][];
  /** What the result cell shows. */
  result: string;
  /** Whether the result cell is an error such as #NAME?. */
  isError: boolean;
}

/** The engine's answer for the example, or for the example with a mistake put in. */
export function computeLesson(lesson: Lesson, mistake?: Mistake): LessonTable {
  const at = parseCellRef(lesson.example.result);
  if (!at) throw new Error(`lesson ${lesson.slug}: bad result cell ${lesson.example.result}`);
  const overrides = { ...(mistake?.cells ?? {}) };
  if (mistake?.formula) overrides[lesson.example.result] = mistake.formula;
  const sheet = lessonSheet(lesson, overrides);
  const computed = computeSheet(sheet);
  const { grid } = lesson.example;
  const cols = Math.max(...grid.map((r) => r.length));
  const display = grid.map((_, r) => Array.from({ length: cols }, (__, c) => computed.display[r]?.[c] ?? ""));
  const result = computed.display[at.row]?.[at.col] ?? "";
  return { display, result, isError: result.startsWith("#") };
}

/** The formula the example teaches, as typed in its result cell. */
export function lessonFormula(lesson: Lesson): string {
  const at = parseCellRef(lesson.example.result)!;
  return lesson.example.grid[at.row][at.col];
}

/** Column letters for the example's table header: A, B, C… */
export function lessonColumns(lesson: Lesson): string[] {
  const cols = Math.max(...lesson.example.grid.map((r) => r.length));
  return Array.from({ length: cols }, (_, c) => cellRef(0, c).replace(/\d+$/, ""));
}
