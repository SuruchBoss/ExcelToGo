# ExcelToGo — QA Handoff รอบที่ 2 และลำดับงานแก้

| | |
|---|---|
| **สำหรับ** | Product Owner (ExcelToGo) |
| **วันที่** | 2026-09-27 |
| **ผู้ทำ** | QA (health audit รอบ 2 + functional QA survey) |
| **Build ที่ทดสอบ** | `a7e0c5a` |
| **สถานะ issue ณ** | main `0baa2c5` (หลัง merge Sprint A และ #23) |
| **ใช้แทน** | handoff rev. 2 ของรอบแรก — ฉบับนี้รวม issue ที่ยังเปิดจากทั้งสองรอบไว้ในแผนเดียว |
| **รายงานฉบับเต็ม** | `health-audit-2026-09-27.md` · `bug-report-2026-09-27.md` (โฟลเดอร์เดียวกัน) |

**หลักฐาน:** ทุก bug ถูกทำซ้ำอย่างน้อยสองครั้งจาก browser context ใหม่ และข้อหลักทุกข้อ QA lead รันซ้ำเอง

---

## 0. เกิดอะไรขึ้นหลังการทดสอบ

- **Sprint A** (`4fbac05`) และงาน **#23** (`0baa2c5`) merge เข้า main หลังจากที่ build `a7e0c5a` ถูกทดสอบ ปิด issue จากรอบแรกไป 9 ใบ:
  - #20 SSRF
  - #21, #22 เอกสาร
  - #23 เลขศูนย์นำหน้า
  - #24, #26, #27, #28 คณิต
  - #31 README gate
- **issue จากรอบ 2 (#40–#77) ยังเปิดอยู่ทั้งหมด** ก่อนลงมือแก้ใบไหน ให้ยืนยันก่อนว่ายังทำซ้ำได้บน main ปัจจุบัน
- **QA ยังไม่ได้ทดสอบซ้ำ (regression) งานที่ Sprint A แก้** ควรจัดรอบ regression check ของ #20–#31 และงาน #23 แยกไว้

---

## 1. TL;DR

**สถานะตอนทดสอบ:**
- **Gate ยังเขียวครบ:** lint, readme, screens, deps, **1,399 tests**, mutants, build, a11y, e2e แต่รอบนี้เจอ **bug ที่ gate ไม่ได้จับ 64 ข้อ**
- **เอนจินสูตรและตัวหน้าเว็บแข็งแรงมาก** หน้าโหลดได้ใน 0.2–0.3 วินาที และตัวเลข performance ที่ README อ้างไว้ยังจริง

**ความเสี่ยงหลัก — "ชั้นที่ถือข้อมูล"** (store, clipboard, import/export, autosave):
- bug ระดับ Critical ทั้ง 8 ตัวเป็นข้อมูลหายแบบเงียบ และไม่มีตัวไหนมีเทสต์คุม

**สามเรื่องที่ควรทำก่อน:**
1. Critical #40–#47
2. #67 — แก้ระดับ S แล้วหายอาการค้าง 9–17 วินาทีทุกครั้งที่เปิดแอปกับชีตใหญ่
3. #68 — Node 20 หมดอายุแล้ว

**คะแนน health (เต็ม 5):**

| Architecture | Cleanliness | Design | **State** | Tests | Errors | Perf | Deps | Standards |
|---|---|---|---|---|---|---|---|---|
| 3 | 4 | 3 | **2** | 3 | 3 | 3 | 3 | 4 |

---

## 2. สิ่งที่รอ PO / owner ตัดสินใจหรือลงมือเอง

| # | เรื่อง | ใครทำ | เหตุผล |
|---|---|---|---|
| 1 | ยื่น security advisory ที่ QA ส่งให้แบบส่วนตัว ผ่าน Security → Report a vulnerability | owner | ตามกติกาใน AGENTS.md เรื่องความปลอดภัยไม่อยู่ในโฟลเดอร์นี้หรือใน issue สาธารณะ และ QA ไม่มีเครื่องมือสร้าง private advisory |
| 2 | ยืนยันว่า **#61** (template lock ถูกข้ามได้) และ **M11 ใน #70** (validation ถูกข้ามด้วย paste/fill) เปิดเป็นสาธารณะได้ | PO | QA มองว่าเป็นตัวกันผู้ใช้แก้ผิด ไม่ใช่ขอบเขตความปลอดภัย |
| 3 | ต่อยอด **ชนิดของเซลล์** จากงาน #23: วันที่ (#45), TRUE/FALSE (#70-M10), ตัวเลขที่มีจุลภาค/%/สกุลเงิน (#52) และ #38 ที่รอ PO ตัดสินใจอยู่แล้ว | PO + Dev | #23 วาง `literalValue` ตัวเดียวและรูปแบบ "Text" ไว้แล้ว ที่เหลือควรใช้กติกาเดียวกัน |
| 4 | ตรวจว่า Vercel production รัน Node รุ่นไหน | owner | ต้องรู้ก่อนปิด #68 |
| 5 | (ไม่บังคับ) ตั้งสี label `sev:*` / `area:*` | owner | label ถูกสร้างอัตโนมัติเป็นสีเทาทั้งหมด |
| 6 | สั่งรอบ **regression check** ของงาน Sprint A และ #23 | PO | ยังไม่มีใครทดสอบซ้ำหลัง merge |

---

## 3. ต้นเหตุร่วม — แก้ครั้งเดียว ปิดได้หลายใบ

| ธีม | ต้นเหตุ | Issue ที่ปิดได้ | แรงที่ใช้ |
|---|---|---|---|
| **T1 ชนิดของเซลล์ยังไม่ครบ** | #23 แก้เลขศูนย์นำหน้าแล้ว แต่วันที่, boolean และตัวเลขที่มีรูปแบบยังถูกเดาชนิด | #45, #52, #38, #70-M10 | M–L (ต่อยอดจาก #23) |
| **T2 การแก้โครงสร้างไม่พาโครงสร้างข้างเคียงไปด้วย** | แทรก/ลบแถว, sort และ cut ไม่ขยับ live block, สูตร, comment หรือ reference ตาม | #46, #48, #51, #69-M6, #71-M20 | M — รวมเข้ากับ #34 เป็น pipeline กลาง |
| **T3 state ไม่ประสานกัน** | undo ไม่เก็บชีตที่เปิดอยู่ · แท็บบันทึกทับกัน · บันทึกทุกครั้งที่ state เปลี่ยน · formula bar ไม่ sync | #40, #47, #72, #42 | S–M ต่อใบ |
| **T4 ทิ้งข้อมูลเงียบ ๆ** | ตัดแถว, ตัดตาราง หรือ export ล้มโดยไม่บอกผู้ใช้ | #43 (+ #10 เดิม), #56, #54, #75-L9 | S ต่อใบ |
| **T5 คำนวณโดยไม่มี workbook resolver** | export, pivot และ sort เรียก `computeSheet` เปล่า ๆ | #58 | S — helper ตัวเดียว + guard |
| **T6 ตัวจับคำของ AI** | จับคำย่อยในคำอื่น · ตัดเงื่อนไขทิ้ง · สร้างสูตรบนแถวหัวตาราง | #62, #63, #64 | M |

---

## 4. ลำดับความสำคัญ — issue ของ QA ที่ยังเปิด (46 ใบ)

**Effort:** S ไม่เกิน 2 ชม. · M ประมาณครึ่งวัน · L ประมาณ 1–2 วัน
**🔒** = การตัดสินใจเดิมของ PO

### 🔴 ทำทันที

| ลำดับ | Issue | เรื่อง | Sev | Effort |
|---|---|---|---|---|
| 1 | [#40](https://github.com/SuruchBoss/ExcelToGo/issues/40) | undo แล้วแก้อะไรต่อก็หายหมด | **Critical** | S |
| 2 | [#41](https://github.com/SuruchBoss/ExcelToGo/issues/41) | cut ข้ามชีตลบข้อมูลชีตปลายทาง | **Critical** | S |
| 3 | [#42](https://github.com/SuruchBoss/ExcelToGo/issues/42) | formula bar เขียนค่าเก่าทับเซลล์ | **Critical** | S |
| 4 | [#43](https://github.com/SuruchBoss/ExcelToGo/issues/43) | import ตัดแถว/คอลัมน์ทิ้ง (แก้คู่กับ #10) | **Critical** | S |
| 5 | [#44](https://github.com/SuruchBoss/ExcelToGo/issues/44) | shared formula กลายเป็นตัวเลข | **Critical** | S |
| 6 | [#67](https://github.com/SuruchBoss/ExcelToGo/issues/67) | render ครั้งแรกใส่ทุกแถวลง DOM ค้าง 9–17 วินาที | High | **S** |
| 7 | [#68](https://github.com/SuruchBoss/ExcelToGo/issues/68) | เลิกรองรับ Node 20 (หมดอายุแล้ว) | High | S |
| 8 | [#46](https://github.com/SuruchBoss/ExcelToGo/issues/46) | live block ลบแถวของผู้ใช้หลังแทรก/ลบแถว | **Critical** | M |
| 9 | [#47](https://github.com/SuruchBoss/ExcelToGo/issues/47) | สองแท็บทับงานกัน | **Critical** | M |
| 10 | [#45](https://github.com/SuruchBoss/ExcelToGo/issues/45) | วันที่กลายเป็นข้อความ และเวลาหาย (T1) | **Critical** | M |

### 🟠 สปรินต์นี้

| Issue | เรื่อง | Sev | Effort |
|---|---|---|---|
| [#58](https://github.com/SuruchBoss/ExcelToGo/issues/58) | สูตรข้ามชีตเป็น #REF! ใน CSV/PDF/pivot | High | S |
| [#55](https://github.com/SuruchBoss/ExcelToGo/issues/55) · [#56](https://github.com/SuruchBoss/ExcelToGo/issues/56) · [#57](https://github.com/SuruchBoss/ExcelToGo/issues/57) · [#59](https://github.com/SuruchBoss/ExcelToGo/issues/59) | merged ×n · pivot ถูกตัด · pivot นับช่องว่าง · กราฟชี้คอลัมน์ผิด | High | S ทุกใบ |
| [#49](https://github.com/SuruchBoss/ExcelToGo/issues/49) · [#50](https://github.com/SuruchBoss/ExcelToGo/issues/50) · [#65](https://github.com/SuruchBoss/ExcelToGo/issues/65) | หัวตารางหลุดตอน sort · filter ลบแถวที่ซ่อน · list ว่างของข้อมูลสด | High | S ทุกใบ |
| [#52](https://github.com/SuruchBoss/ExcelToGo/issues/52) · [#38](https://github.com/SuruchBoss/ExcelToGo/issues/38) | ตัวเลขที่มีจุลภาค/%/สกุลเงิน · ช่วงที่นับข้อความ (T1 ต่อจาก #23) | High | M |

### 🟡 รอบหน้า

| Issue | เรื่อง | Sev | Effort |
|---|---|---|---|
| [#48](https://github.com/SuruchBoss/ExcelToGo/issues/48) · [#51](https://github.com/SuruchBoss/ExcelToGo/issues/51) (T2) | sort ทำสูตรในแถวผิด (รวมถึงชีตตัวอย่าง) · cut ไม่ย้าย reference | High | M ทุกใบ |
| [#53](https://github.com/SuruchBoss/ExcelToGo/issues/53) · [#54](https://github.com/SuruchBoss/ExcelToGo/issues/54) · [#60](https://github.com/SuruchBoss/ExcelToGo/issues/60) · [#61](https://github.com/SuruchBoss/ExcelToGo/issues/61) | percent/สกุลเงิน · ชื่อชีตซ้ำ · named range · template lock | High | M ทุกใบ |
| [#62](https://github.com/SuruchBoss/ExcelToGo/issues/62) · [#63](https://github.com/SuruchBoss/ExcelToGo/issues/63) · [#64](https://github.com/SuruchBoss/ExcelToGo/issues/64) (T6) | AI ตอบผิดอย่างมั่นใจ · Insert เขียนสูตรอ้างตัวเอง | High | M รวม |
| [#66](https://github.com/SuruchBoss/ExcelToGo/issues/66) · [#72](https://github.com/SuruchBoss/ExcelToGo/issues/72) | แก้เซลล์ช้าแบบกำลังสองของจำนวนแถว · autosave ทุกครั้งที่กดปุ่ม | High / Med | M / S–M |
| [#25](https://github.com/SuruchBoss/ExcelToGo/issues/25) · [#73](https://github.com/SuruchBoss/ExcelToGo/issues/73) | `-2^2` · งานดูแล dependency | Med | M / S |
| [#18](https://github.com/SuruchBoss/ExcelToGo/issues/18) + [#19](https://github.com/SuruchBoss/ExcelToGo/issues/19) 🔒 | ข้อมูลสด: ไม่มีเพดานขนาด · timeout ไม่ครอบ body (เรื่อง reliability) | Low | M |

### ⚪ Backlog

| Issue | เรื่อง | Effort |
|---|---|---|
| [#69](https://github.com/SuruchBoss/ExcelToGo/issues/69) · [#70](https://github.com/SuruchBoss/ExcelToGo/issues/70) · [#71](https://github.com/SuruchBoss/ExcelToGo/issues/71) | ใบรวม Medium: grid 9 ข้อ · import/export 7 ข้อ · AI/ข้อมูลสด 6 ข้อ | S–M ต่อข้อ |
| [#74](https://github.com/SuruchBoss/ExcelToGo/issues/74) · [#75](https://github.com/SuruchBoss/ExcelToGo/issues/75) · [#76](https://github.com/SuruchBoss/ExcelToGo/issues/76) · [#77](https://github.com/SuruchBoss/ExcelToGo/issues/77) | ใบรวม Low | S ต่อข้อ |
| [#29](https://github.com/SuruchBoss/ExcelToGo/issues/29) · [#30](https://github.com/SuruchBoss/ExcelToGo/issues/30) | TEXT ไม่ใช้ format string · alert() ในชั้น store | M |
| [#33](https://github.com/SuruchBoss/ExcelToGo/issues/33) → [#34](https://github.com/SuruchBoss/ExcelToGo/issues/34) → [#35](https://github.com/SuruchBoss/ExcelToGo/issues/35) | tech debt (#34 คือที่ลงของ pipeline กลาง T2) | M / L / L |

---

## 5. แผนสปรินต์ที่แนะนำ

**สปรินต์ 1 — "หยุดทำข้อมูลหาย"**
1. Critical ที่แก้ได้ในระดับ S: #40, #41, #42, #43 (พ่วง #10), #44 — ทุกใบต้องมี**เทสต์ระดับ store/integration** ของตัวเอง
2. #67 (S) — ผลต่อผู้ใช้สูงสุดเมื่อเทียบกับแรงที่ใช้
3. #68 (S) — ต้องทำก่อน Vitest 5
4. regression check ของงาน Sprint A และ #23

**สปรินต์ 2 — "ตัวเลขต้องถูก"**
1. #46, #47 (Critical, M)
2. T1 ต่อจาก #23: #45, #52, #38 ตามที่ PO ตัดสินใจ
3. S ชุดใหญ่: #58, #55, #56, #57, #59, #49, #50, #65

**สปรินต์ 3 — "ย้ายและจัดเรียงได้โดยไม่พัง"**
1. T2: #48, #51 — วางรากฐาน pipeline ของ structural edit เพื่อต่อยอดเป็น #34
2. #53, #54, #60, #61
3. T6: #62–#64
4. #66, #72, #73, #25, #18 + #19

**Backlog:** ใบรวม Medium/Low ให้ทำตามพื้นที่งานที่กำลังแตะอยู่ (boy-scout rule) ส่วน tech debt ทำตามลำดับ #33 → #34 → #35

---

## 6. เงื่อนไข "เสร็จ" (ทุก ticket)

ตามกติกาใน AGENTS.md:
- [ ] **`npm run verify` เขียวครบ 10 ด่าน** ก่อน push (ห้ามใช้แค่ `verify:quick`)
- [ ] มี **regression test** ที่ตรึงพฤติกรรมไว้
  - Critical ทุกใบต้องมีเทสต์ระดับ store หรือ e2e
  - ค่าที่คาดหวังต้องเป็นผลของ Excel หรือคำนวณด้วยมือ
- [ ] README ทั้งสองภาษา ถ้าพฤติกรรมหรือข้อจำกัดเปลี่ยน
- [ ] ticket ด้าน performance แนบตัวเลข before/after เป็น**อัตราส่วน**
- [ ] ข้อเสนอให้ปิดช่องที่ gate ไม่ได้จับ:
  - เพิ่มสถานะ "AI แสดงคำตอบแล้ว" ใน `OPENED_STATES` ของ `check:a11y` (#71-M17)
  - เพิ่ม e2e flow ของ undo→แก้ต่อ, cut ข้ามชีต และการ import ไฟล์ Excel จริง

---

## 7. ที่ไม่ได้เปิด ticket (ตั้งใจ)

- **เรื่องความปลอดภัย** — ส่งแบบส่วนตัวตามกติกาใน AGENTS.md
- **ข้อจำกัดที่ README/SECURITY.md เขียนไว้แล้ว**
  - โน้ตบนเซลล์ว่างหายตอน re-import
  - pie chart วาดได้ชุดข้อมูลเดียว และกราฟใน PDF เป็นภาพ
  - การ shaping ภาษาไทยใน PDF
  - filter ไม่ถูกบันทึกข้ามการ reload
  - DNS rebinding race
- **พฤติกรรมที่ตรงกับ Excel อยู่แล้ว**
  - นำเข้า CSV แล้ว `007` กลายเป็น `7`
  - `1e5` เป็นตัวเลข
  - AutoSum หยุดที่ช่องว่าง
- **ยังไม่ได้ทดสอบ**
  - Cloud save และการแก้พร้อมกันหลายคน — ต้องมี Supabase
  - ฐานข้อมูลโดยตรง — ตรวจแค่ระดับโค้ดในรอบแรก

---

## 8. ส่วนที่ยืนยันแล้วว่าแข็งแรง (อย่าทำพังตอน refactor)

- **เอนจิน**
  - ผลคำนวณตรวจด้วยมือแล้ว และ array/spill ถูกต้อง
  - incremental กับการคำนวณใหม่ทั้งชีตได้ผลตรงกัน (0 mismatch)
  - ตัวเลข performance ใน README ยังจริงที่ 1k/3k แถว
- **หน้าเว็บ**
  - LCP 224–284 ms และโหลด JS แค่ 271 KB ก่อนใช้งานได้
  - ExcelJS กับ Supabase ถูก lazy-load
  - scroll ได้ p95 16.8 ms และพิมพ์ใน editor ได้ 16–32 ms ต่อปุ่ม
- **ความทนทาน** — การแจ้งเตือนเมื่อบันทึกไม่ลง, crash rescue และโหมด offline ทำงานตามที่ README บอก
- **BYOK** — key อยู่แค่ใน `sessionStorage` ไม่หลุดไปที่หน้าเว็บหรือ console
- **สองภาษา** — ไม่เจอข้อความที่ลืมแปล และไม่มี layout ล้นที่ 390px / 1280px
- **Dependency** — Dependabot, CodeQL และ gate advisory ที่มีวันหมดอายุทำงานอยู่ ตำแหน่ง dependency ถูกต้อง

---

## 9. บันทึกกระบวนการ

- **ทำตามกติกาใหม่ใน AGENTS.md**
  - เรื่องความปลอดภัยส่งแบบส่วนตัว
  - ร่าง issue ถูก**อนุมัติก่อนเปิดทุกใบ**: เปิด 38 ใบ (#40–#77) และคอมเมนต์หลักฐานเพิ่มใน #23, #13 และ #30
- **เหตุระหว่างทดสอบ**
  - agent ตัวหนึ่งใช้ `pkill -f next-server` ซึ่งฆ่า server ของ agent ตัวอื่นไปด้วย
  - ทุกตัวเปิด server ใหม่และรันซ้ำแล้ว ไม่มีผลในรายงานที่มาจากเหตุนี้
  - บทเรียน: หยุด server ด้วยพอร์ตหรือ PID ของตัวเองเท่านั้น

---

*จัดทำโดย ExcelToGo QA · 2026-09-27*
