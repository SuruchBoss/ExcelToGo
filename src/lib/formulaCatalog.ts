export type ParamType = "range" | "cell" | "number" | "text" | "boolean";

export interface FormulaParam {
  key: string;
  label: string;
  type: ParamType;
  placeholder?: string;
  optional?: boolean;
  defaultValue?: string;
  /** For boolean params rendered as a select, e.g. exact vs approximate match. */
  options?: { value: string; label: string }[];
}

export interface FormulaDef {
  id: string;
  name: string;
  category: string;
  syntax: string;
  description: string;
  example: string;
  params: FormulaParam[];
  build: (values: Record<string, string>) => string;
}

export const CATEGORIES = [
  "คณิตศาสตร์",
  "สถิติ",
  "ตรรกะ",
  "ข้อความ",
  "วันที่",
  "ค้นหา",
] as const;

function req(key: string, label: string, type: ParamType, placeholder = ""): FormulaParam {
  return { key, label, type, placeholder };
}
function opt(key: string, label: string, type: ParamType, placeholder = "", defaultValue = ""): FormulaParam {
  return { key, label, type, placeholder, optional: true, defaultValue };
}

export const FORMULA_CATALOG: FormulaDef[] = [
  {
    id: "SUM",
    name: "SUM - รวมตัวเลข",
    category: "คณิตศาสตร์",
    syntax: "SUM(range)",
    description: "รวมค่าตัวเลขทั้งหมดในช่วงที่เลือก",
    example: "=SUM(A1:A10)",
    params: [req("range", "ช่วงเซลล์", "range", "เช่น A1:A10")],
    build: (v) => `SUM(${v.range})`,
  },
  {
    id: "AVERAGE",
    name: "AVERAGE - ค่าเฉลี่ย",
    category: "สถิติ",
    syntax: "AVERAGE(range)",
    description: "คำนวณค่าเฉลี่ยของตัวเลขในช่วงที่เลือก",
    example: "=AVERAGE(B2:B20)",
    params: [req("range", "ช่วงเซลล์", "range", "เช่น B2:B20")],
    build: (v) => `AVERAGE(${v.range})`,
  },
  {
    id: "COUNT",
    name: "COUNT - นับตัวเลข",
    category: "สถิติ",
    syntax: "COUNT(range)",
    description: "นับจำนวนเซลล์ที่เป็นตัวเลขในช่วงที่เลือก",
    example: "=COUNT(A1:A20)",
    params: [req("range", "ช่วงเซลล์", "range")],
    build: (v) => `COUNT(${v.range})`,
  },
  {
    id: "COUNTA",
    name: "COUNTA - นับข้อมูลที่ไม่ว่าง",
    category: "สถิติ",
    syntax: "COUNTA(range)",
    description: "นับจำนวนเซลล์ที่มีข้อมูล (ไม่ว่าง) ในช่วงที่เลือก",
    example: "=COUNTA(A1:A20)",
    params: [req("range", "ช่วงเซลล์", "range")],
    build: (v) => `COUNTA(${v.range})`,
  },
  {
    id: "MIN",
    name: "MIN - ค่าต่ำสุด",
    category: "สถิติ",
    syntax: "MIN(range)",
    description: "หาค่าต่ำสุดในช่วงที่เลือก",
    example: "=MIN(A1:A10)",
    params: [req("range", "ช่วงเซลล์", "range")],
    build: (v) => `MIN(${v.range})`,
  },
  {
    id: "MAX",
    name: "MAX - ค่าสูงสุด",
    category: "สถิติ",
    syntax: "MAX(range)",
    description: "หาค่าสูงสุดในช่วงที่เลือก",
    example: "=MAX(A1:A10)",
    params: [req("range", "ช่วงเซลล์", "range")],
    build: (v) => `MAX(${v.range})`,
  },
  {
    id: "PRODUCT",
    name: "PRODUCT - คูณตัวเลข",
    category: "คณิตศาสตร์",
    syntax: "PRODUCT(range)",
    description: "คูณค่าตัวเลขทั้งหมดในช่วงที่เลือกเข้าด้วยกัน",
    example: "=PRODUCT(A1:A3)",
    params: [req("range", "ช่วงเซลล์", "range")],
    build: (v) => `PRODUCT(${v.range})`,
  },
  {
    id: "ROUND",
    name: "ROUND - ปัดเศษ",
    category: "คณิตศาสตร์",
    syntax: "ROUND(number, digits)",
    description: "ปัดเศษตัวเลขตามจำนวนหลักทศนิยมที่กำหนด",
    example: "=ROUND(A1,2)",
    params: [req("number", "เซลล์หรือค่า", "cell", "เช่น A1"), opt("digits", "จำนวนหลักทศนิยม", "number", "0", "0")],
    build: (v) => `ROUND(${v.number},${v.digits || "0"})`,
  },
  {
    id: "ABS",
    name: "ABS - ค่าสัมบูรณ์",
    category: "คณิตศาสตร์",
    syntax: "ABS(number)",
    description: "แปลงค่าติดลบให้เป็นค่าบวก",
    example: "=ABS(A1)",
    params: [req("number", "เซลล์หรือค่า", "cell")],
    build: (v) => `ABS(${v.number})`,
  },
  {
    id: "SUMIF",
    name: "SUMIF - รวมตามเงื่อนไข",
    category: "คณิตศาสตร์",
    syntax: "SUMIF(range, criteria, sum_range)",
    description: "รวมค่าตัวเลขเฉพาะแถวที่ตรงตามเงื่อนไขที่กำหนด",
    example: '=SUMIF(A1:A10,">100",B1:B10)',
    params: [
      req("range", "ช่วงที่ใช้ตรวจเงื่อนไข", "range", "เช่น A1:A10"),
      req("criteria", "เงื่อนไข", "text", 'เช่น >100 หรือ "ผลไม้"'),
      req("sumRange", "ช่วงที่ต้องการรวม", "range", "เช่น B1:B10"),
    ],
    build: (v) => `SUMIF(${v.range},${quoteIfNeeded(v.criteria)},${v.sumRange})`,
  },
  {
    id: "COUNTIF",
    name: "COUNTIF - นับตามเงื่อนไข",
    category: "สถิติ",
    syntax: "COUNTIF(range, criteria)",
    description: "นับจำนวนเซลล์ที่ตรงตามเงื่อนไขที่กำหนด",
    example: '=COUNTIF(A1:A10,"เสร็จแล้ว")',
    params: [req("range", "ช่วงเซลล์", "range"), req("criteria", "เงื่อนไข", "text", 'เช่น >=18 หรือ "ใช่"')],
    build: (v) => `COUNTIF(${v.range},${quoteIfNeeded(v.criteria)})`,
  },
  {
    id: "AVERAGEIF",
    name: "AVERAGEIF - ค่าเฉลี่ยตามเงื่อนไข",
    category: "สถิติ",
    syntax: "AVERAGEIF(range, criteria, average_range)",
    description: "หาค่าเฉลี่ยเฉพาะแถวที่ตรงตามเงื่อนไขที่กำหนด",
    example: '=AVERAGEIF(A1:A10,"ชาย",B1:B10)',
    params: [
      req("range", "ช่วงที่ใช้ตรวจเงื่อนไข", "range"),
      req("criteria", "เงื่อนไข", "text"),
      req("avgRange", "ช่วงที่ต้องการเฉลี่ย", "range"),
    ],
    build: (v) => `AVERAGEIF(${v.range},${quoteIfNeeded(v.criteria)},${v.avgRange})`,
  },
  {
    id: "VLOOKUP",
    name: "VLOOKUP - ค้นหาแนวตั้ง",
    category: "ค้นหา",
    syntax: "VLOOKUP(lookup_value, table, col_index, [exact])",
    description: "ค้นหาค่าจากคอลัมน์แรกของตาราง แล้วดึงค่าจากคอลัมน์ที่ต้องการในแถวเดียวกัน",
    example: "=VLOOKUP(A2,$D$1:$F$100,3,FALSE)",
    params: [
      req("lookup", "ค่าที่ต้องการค้นหา", "cell", "เช่น A2"),
      req("table", "ตารางข้อมูล", "range", "เช่น D1:F100"),
      req("colIndex", "ลำดับคอลัมน์ที่ต้องการดึง", "number", "เช่น 3"),
      {
        key: "exact",
        label: "รูปแบบการค้นหา",
        type: "boolean",
        optional: true,
        defaultValue: "FALSE",
        options: [
          { value: "FALSE", label: "ค้นหาตรงทั้งหมด (แนะนำ)" },
          { value: "TRUE", label: "ค้นหาแบบใกล้เคียง" },
        ],
      },
    ],
    build: (v) => `VLOOKUP(${v.lookup},${v.table},${v.colIndex},${v.exact || "FALSE"})`,
  },
  {
    id: "IF",
    name: "IF - เงื่อนไข",
    category: "ตรรกะ",
    syntax: "IF(condition, value_if_true, value_if_false)",
    description: "ตรวจสอบเงื่อนไข แล้วคืนค่าตามจริงหรือเท็จ",
    example: '=IF(A1>=50,"ผ่าน","ไม่ผ่าน")',
    params: [
      req("cond", "เงื่อนไข", "text", "เช่น A1>=50"),
      req("ifTrue", "ค่าเมื่อเป็นจริง", "text", 'เช่น "ผ่าน"'),
      req("ifFalse", "ค่าเมื่อเป็นเท็จ", "text", 'เช่น "ไม่ผ่าน"'),
    ],
    build: (v) => `IF(${v.cond},${quoteIfNeeded(v.ifTrue)},${quoteIfNeeded(v.ifFalse)})`,
  },
  {
    id: "IFERROR",
    name: "IFERROR - จัดการค่าผิดพลาด",
    category: "ตรรกะ",
    syntax: "IFERROR(value, value_if_error)",
    description: "แสดงค่าสำรองเมื่อสูตรคำนวณผิดพลาด (เช่น หารด้วยศูนย์)",
    example: '=IFERROR(A1/B1,"-")',
    params: [
      req("value", "สูตรหรือค่า", "text", "เช่น A1/B1"),
      req("fallback", "ค่าเมื่อเกิดข้อผิดพลาด", "text", 'เช่น "-"'),
    ],
    build: (v) => `IFERROR(${v.value},${quoteIfNeeded(v.fallback)})`,
  },
  {
    id: "AND",
    name: "AND - เงื่อนไขทั้งหมดต้องจริง",
    category: "ตรรกะ",
    syntax: "AND(condition1, condition2, ...)",
    description: "คืนค่า TRUE เมื่อทุกเงื่อนไขเป็นจริง",
    example: "=AND(A1>0,B1>0)",
    params: [
      req("cond1", "เงื่อนไขที่ 1", "text", "เช่น A1>0"),
      opt("cond2", "เงื่อนไขที่ 2", "text", "เช่น B1>0"),
    ],
    build: (v) => `AND(${[v.cond1, v.cond2].filter(Boolean).join(",")})`,
  },
  {
    id: "OR",
    name: "OR - เงื่อนไขใดจริงก็ได้",
    category: "ตรรกะ",
    syntax: "OR(condition1, condition2, ...)",
    description: "คืนค่า TRUE เมื่ออย่างน้อยหนึ่งเงื่อนไขเป็นจริง",
    example: "=OR(A1=1,A1=2)",
    params: [
      req("cond1", "เงื่อนไขที่ 1", "text"),
      opt("cond2", "เงื่อนไขที่ 2", "text"),
    ],
    build: (v) => `OR(${[v.cond1, v.cond2].filter(Boolean).join(",")})`,
  },
  {
    id: "CONCATENATE",
    name: "CONCATENATE - ต่อข้อความ",
    category: "ข้อความ",
    syntax: "CONCATENATE(text1, text2, ...)",
    description: "รวมข้อความจากหลายเซลล์เข้าด้วยกัน",
    example: "=CONCATENATE(A1,\" \",B1)",
    params: [
      req("text1", "ข้อความ/เซลล์ที่ 1", "text", "เช่น A1"),
      req("text2", "ข้อความ/เซลล์ที่ 2", "text", 'เช่น " " หรือ B1'),
    ],
    build: (v) => `CONCATENATE(${v.text1},${v.text2})`,
  },
  {
    id: "UPPER",
    name: "UPPER - ตัวพิมพ์ใหญ่",
    category: "ข้อความ",
    syntax: "UPPER(text)",
    description: "แปลงข้อความเป็นตัวพิมพ์ใหญ่ทั้งหมด",
    example: "=UPPER(A1)",
    params: [req("text", "ข้อความ/เซลล์", "cell")],
    build: (v) => `UPPER(${v.text})`,
  },
  {
    id: "LOWER",
    name: "LOWER - ตัวพิมพ์เล็ก",
    category: "ข้อความ",
    syntax: "LOWER(text)",
    description: "แปลงข้อความเป็นตัวพิมพ์เล็กทั้งหมด",
    example: "=LOWER(A1)",
    params: [req("text", "ข้อความ/เซลล์", "cell")],
    build: (v) => `LOWER(${v.text})`,
  },
  {
    id: "TRIM",
    name: "TRIM - ตัดช่องว่าง",
    category: "ข้อความ",
    syntax: "TRIM(text)",
    description: "ตัดช่องว่างส่วนเกินหน้า-หลังข้อความออก",
    example: "=TRIM(A1)",
    params: [req("text", "ข้อความ/เซลล์", "cell")],
    build: (v) => `TRIM(${v.text})`,
  },
  {
    id: "LEFT",
    name: "LEFT - ตัดข้อความด้านซ้าย",
    category: "ข้อความ",
    syntax: "LEFT(text, num_chars)",
    description: "ดึงตัวอักษรจำนวนที่กำหนดจากด้านซ้ายของข้อความ",
    example: "=LEFT(A1,3)",
    params: [req("text", "ข้อความ/เซลล์", "cell"), req("n", "จำนวนตัวอักษร", "number", "เช่น 3")],
    build: (v) => `LEFT(${v.text},${v.n})`,
  },
  {
    id: "RIGHT",
    name: "RIGHT - ตัดข้อความด้านขวา",
    category: "ข้อความ",
    syntax: "RIGHT(text, num_chars)",
    description: "ดึงตัวอักษรจำนวนที่กำหนดจากด้านขวาของข้อความ",
    example: "=RIGHT(A1,3)",
    params: [req("text", "ข้อความ/เซลล์", "cell"), req("n", "จำนวนตัวอักษร", "number", "เช่น 3")],
    build: (v) => `RIGHT(${v.text},${v.n})`,
  },
  {
    id: "TODAY",
    name: "TODAY - วันที่ปัจจุบัน",
    category: "วันที่",
    syntax: "TODAY()",
    description: "แสดงวันที่ปัจจุบัน",
    example: "=TODAY()",
    params: [],
    build: () => `TODAY()`,
  },
  {
    id: "NOW",
    name: "NOW - วันเวลาปัจจุบัน",
    category: "วันที่",
    syntax: "NOW()",
    description: "แสดงวันที่และเวลาปัจจุบัน",
    example: "=NOW()",
    params: [],
    build: () => `NOW()`,
  },
];

function quoteIfNeeded(text: string | undefined): string {
  const t = (text ?? "").trim();
  if (t === "") return '""';
  // Already looks like a reference, number, string literal, or expression: leave as-is.
  if (/^".*"$/.test(t)) return t;
  if (/^-?\d+(\.\d+)?$/.test(t)) return t;
  if (/^\$?[A-Za-z]{1,3}\$?\d+(:\$?[A-Za-z]{1,3}\$?\d+)?$/.test(t)) return t;
  if (/[+\-*/&()<>=]/.test(t)) return t;
  return `"${t.replace(/"/g, '""')}"`;
}

export function getCategories(): string[] {
  return [...CATEGORIES];
}

export const FORMULA_BY_ID: Record<string, FormulaDef> = Object.fromEntries(
  FORMULA_CATALOG.map((f) => [f.id, f])
);
