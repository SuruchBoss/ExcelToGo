// Keyword-based fallback used when no ANTHROPIC_API_KEY is configured, so the
// AI assistant panel still returns something useful out of the box.

interface Rule {
  keywords: string[];
  build: (range: string) => string;
  explain: string;
}

const RULES: Rule[] = [
  {
    keywords: ["รวม", "บวก", "sum", "total", "ยอดรวม"],
    build: (r) => `SUM(${r})`,
    explain: "รวมค่าตัวเลขทั้งหมดในช่วงที่เลือก",
  },
  {
    keywords: ["เฉลี่ย", "average", "avg", "ค่าเฉลี่ย"],
    build: (r) => `AVERAGE(${r})`,
    explain: "คำนวณค่าเฉลี่ยของตัวเลขในช่วงที่เลือก",
  },
  {
    keywords: ["มากที่สุด", "สูงสุด", "max", "highest"],
    build: (r) => `MAX(${r})`,
    explain: "หาค่าสูงสุดในช่วงที่เลือก",
  },
  {
    keywords: ["น้อยที่สุด", "ต่ำสุด", "min", "lowest"],
    build: (r) => `MIN(${r})`,
    explain: "หาค่าต่ำสุดในช่วงที่เลือก",
  },
  {
    keywords: ["นับจำนวนข้อความ", "counta", "นับที่ไม่ว่าง"],
    build: (r) => `COUNTA(${r})`,
    explain: "นับจำนวนเซลล์ที่มีข้อมูล (ไม่ว่าง)",
  },
  {
    keywords: ["นับ", "count", "จำนวน"],
    build: (r) => `COUNT(${r})`,
    explain: "นับจำนวนเซลล์ที่เป็นตัวเลขในช่วงที่เลือก",
  },
  {
    keywords: ["ค้นหา", "vlookup", "lookup"],
    build: (r) => `VLOOKUP(A1,${r},2,FALSE)`,
    explain: "ค้นหาค่า A1 ในคอลัมน์แรกของตาราง แล้วดึงค่าคอลัมน์ที่ 2 มาแสดง (ปรับเลขคอลัมน์ตามจริง)",
  },
  {
    keywords: ["เงื่อนไข", "ถ้า", "if"],
    build: () => `IF(A1>0,"ผ่าน","ไม่ผ่าน")`,
    explain: "ตรวจสอบเงื่อนไขแล้วคืนค่าตามจริงหรือเท็จ (ปรับเงื่อนไขและข้อความตามต้องการ)",
  },
  {
    keywords: ["ต่อข้อความ", "รวมข้อความ", "concatenate", "concat"],
    build: () => `CONCATENATE(A1," ",B1)`,
    explain: "รวมข้อความจากหลายเซลล์เข้าด้วยกัน",
  },
  {
    keywords: ["ตัวพิมพ์ใหญ่", "upper"],
    build: () => `UPPER(A1)`,
    explain: "แปลงข้อความเป็นตัวพิมพ์ใหญ่ทั้งหมด",
  },
  {
    keywords: ["วันที่ปัจจุบัน", "today", "วันนี้"],
    build: () => `TODAY()`,
    explain: "แสดงวันที่ปัจจุบัน",
  },
];

export function heuristicSuggest(question: string, range?: string): { formula: string; explanation: string } {
  const q = question.toLowerCase();
  const targetRange = range && /:/.test(range) ? range : range || "A1:A10";
  for (const rule of RULES) {
    if (rule.keywords.some((k) => q.includes(k.toLowerCase()))) {
      return { formula: `=${rule.build(targetRange)}`, explanation: rule.explain };
    }
  }
  return {
    formula: `=SUM(${targetRange})`,
    explanation:
      "ยังไม่ได้ตั้งค่า AI (ANTHROPIC_API_KEY) จึงแนะนำสูตรพื้นฐานให้ก่อน ลองเลือกสูตรจากแถบด้านซ้ายแทนได้ หรือใส่ API key เพื่อให้ AI แนะนำได้แม่นยำขึ้น",
  };
}
