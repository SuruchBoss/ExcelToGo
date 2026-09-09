# 📊 ExcelToGo — แปลงตาราง Excel ให้เป็น UI กรอกง่าย

**ภาษา:** ไทย · [English](README.en.md)

> Excel บนคอมกรอกยาก จำสูตรไม่ได้ ลากจอไปมาแล้วงงว่าอยู่แถว/คอลัมน์ไหน — โปรเจกต์นี้แก้ตรงนั้น:
> ตารางกรอกข้อมูลแบบ Excel พร้อม**สูตรลากวาง**แทนการจำสูตร, **ผู้ช่วย AI** แนะนำสูตรจากคำถามภาษาคน,
> และ**เอนจินคำนวณสูตรที่เขียนขึ้นเอง** (ไม่พึ่งไลบรารีสำเร็จรูป) รองรับ Excel ทุกฟีเจอร์หลักที่ใช้จริง

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Zustand" src="https://img.shields.io/badge/Zustand-5-443E38">
  <img alt="Vitest" src="https://img.shields.io/badge/tests-78%20passing-2F9E44?logo=vitest&logoColor=white">
</p>

**English TL;DR** — A Next.js web app that turns an Excel-style grid into a friendlier UI: drag-and-drop
ready-made formulas instead of memorizing syntax, an AI assistant that suggests formulas from a natural-language
question (Thai or English), and a hand-written formula engine (tokenizer → parser → evaluator, no third-party
formula library) supporting cell/range references, relative & structural reference adjustment, circular-reference
detection, multi-sheet workbooks, and full-fidelity Excel/PDF export. Bilingual UI (Thai/English), 78 automated tests.

---

## 📸 หน้าตาแอป

<p align="center"><b>หน้าจอหลัก</b> — ตารางกรอกข้อมูลพร้อมแถบสูตรลากวางด้านขวา</p>
<p align="center"><img src="docs/screenshots/01-overview.png" width="820"></p>

<table>
<tr>
<td width="50%" align="center"><b>แผงกรอกพารามิเตอร์สูตร</b><br><sub>เลือกช่วง C2:C4 จากตารางโดยตรง ไม่ต้องพิมพ์ที่อยู่เซลล์เอง</sub><br><br>
<img src="docs/screenshots/02-formula-panel.png" width="380"></td>
<td width="50%" align="center"><b>ผลลัพธ์หลังใส่สูตร</b><br><sub>SUM(C2:C4) คำนวณเป็น 100 ทันทีที่กดยืนยัน</sub><br><br>
<img src="docs/screenshots/03-after-insert.png" width="380"></td>
</tr>
<tr>
<td width="50%" align="center"><b>ผู้ช่วย AI หาสูตร</b><br><sub>ถามเป็นประโยคภาษาคน ได้สูตรพร้อมคำอธิบายกลับมา</sub><br><br>
<img src="docs/screenshots/04-ai-assistant.png" width="380"></td>
<td width="50%" align="center"><b>หลายชีตในไฟล์เดียว</b><br><sub>สลับ/เพิ่ม/เปลี่ยนชื่อชีตได้จากแถบด้านล่าง</sub><br><br>
<img src="docs/screenshots/05-sheet-tabs.png" width="380"></td>
</tr>
</table>

<p align="center"><b>จัดรูปแบบเซลล์ + กรองข้อมูล</b> — ตัวหนา, รูปแบบตัวเลข (สกุลเงิน), และตัวกรองแบบติ๊กเลือกค่าต่อคอลัมน์</p>
<p align="center"><img src="docs/screenshots/06-format-filter.png" width="820"></p>

<p align="center"><b>สลับภาษาได้ทั้งแอปในคลิกเดียว</b> — เมนู ปุ่ม ชื่อ/คำอธิบายสูตร และคำตอบจาก AI เปลี่ยนตามทันที</p>
<p align="center"><img src="docs/screenshots/07-english-ui.png" width="820"></p>

---

## 📋 สารบัญ

- [หน้าตาแอป](#-หน้าตาแอป)
- [ทำไมถึงทำโปรเจกต์นี้](#-ทำไมถึงทำโปรเจกต์นี้)
- [วิธีรัน](#-วิธีรัน)
- [ฟีเจอร์](#-ฟีเจอร์)
- [เทคโนโลยีที่ใช้](#-เทคโนโลยีที่ใช้)
- [สถาปัตยกรรม](#-สถาปัตยกรรม)
- [โครงสร้างโปรเจกต์](#-โครงสร้างโปรเจกต์)
- [เอนจินคำนวณสูตร](#-เอนจินคำนวณสูตร)
- [ระบบสองภาษา (i18n)](#-ระบบสองภาษา-i18n)
- [การทดสอบ](#-การทดสอบ)
- [สิ่งที่จะทำต่อ](#-สิ่งที่จะทำต่อ)

---

## 🎯 ทำไมถึงทำโปรเจกต์นี้

จุดตั้งต้นคือ pain point จริงตอนใช้ Excel: **บนคอม/ออนไลน์กรอกยาก, UI ไม่ friendly, จำสูตรไม่ได้, ลากจอไปมา
แล้วงงว่าอยู่แถวไหนคอลัมน์ไหน** โปรเจกต์นี้เลยตั้งใจแก้ปัญหานั้นตรงๆ แทนที่จะทำ "โปรแกรมคำนวณ" ทั่วไป
จึงมีรายละเอียดที่ต้องคิดมากกว่าที่เห็น:

- ผู้ใช้ควรพิมพ์สูตรเองได้ **หรือ** ลากวางแบบไม่ต้องจำ syntax เลยก็ได้ — ต้องรองรับทั้งสองทาง
- สูตรต้องเลื่อนอ้างอิงถูกต้องเวลาคัดลอก/ลากลงทั้งคอลัมน์ (relative) **และ** เวลาแทรก/ลบแถว-คอลัมน์
  (structural) ซึ่งเป็นอัลกอริทึมคนละแบบกัน — พลาดจุดนี้ตารางจะคำนวณผิดโดยผู้ใช้ไม่รู้ตัว
- สูตรอ้างอิงกันเป็นวงกลมได้ ต้องตรวจจับไม่ให้ค้าง
- แก้ไขทุกอย่าง (พิมพ์ค่า, ใส่สูตร, จัดรูปแบบ) ต้อง undo/redo ได้ แต่การเลื่อน selection หรือสลับแท็บ
  **ไม่ควร** นับเป็นประวัติที่ต้อง undo — ไม่งั้นกด Ctrl+Z ทีเดียวจะย้อนแค่ตำแหน่งเมาส์ ไม่ย้อนเนื้อหาจริง
- นำเข้า/ส่งออกไฟล์ Excel ต้องคง **สูตรต้นฉบับ + รูปแบบ (ตัวหนา/สี/จัดตำแหน่ง)** ไว้ ไม่ใช่แค่ค่าตัวเลข
- อยากรองรับทั้งคนไทยและคนอังกฤษ โดยไม่ต้องมี route แยกภาษา (`/en/...`) เพราะแอปนี้ render ฝั่ง client ล้วน

โฟกัสของโปรเจกต์จึงอยู่ที่ **ความถูกต้องของตรรกะคำนวณ + สถาปัตยกรรมที่ดูแลต่อได้** มากกว่าฟีเจอร์เยอะๆ
แบบผิวเผิน — ดูหัวข้อ [เอนจินคำนวณสูตร](#-เอนจินคำนวณสูตร) สำหรับรายละเอียดเชิงลึก

---

## 🚀 วิธีรัน

> ใช้เวลาประมาณ 2 นาที · ไม่ต้องมีฐานข้อมูลหรือ backend แยก ทุกอย่างรันอยู่ใน Next.js เดียว

### ขั้นที่ 0 — ดาวน์โหลดโค้ด

```bash
git clone https://github.com/SuruchBoss/ExcelToGo.git
cd ExcelToGo
```

### ขั้นที่ 1 — ติดตั้งและรัน

**ต้องมี:** [Node.js](https://nodejs.org) 18.18 ขึ้นไป (แนะนำ 20 หรือ 22) และ npm

```bash
npm install
npm run dev
```

เปิดเบราว์เซอร์ไปที่ **http://localhost:3000** จะเห็นตารางตัวอย่างพร้อมใช้งานทันที ไม่ต้องตั้งค่าอะไรเพิ่ม
(ข้อมูลตัวอย่างเป็นบิลขายกาแฟ/ขนมปัง/นม พร้อมสูตรคำนวณยอดรวมให้ดูของจริง)

คำสั่งอื่นๆ ที่มีให้:

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run dev` | รันโหมดพัฒนา (hot reload) |
| `npm run build` | build เป็นเวอร์ชัน production |
| `npm run start` | รันเวอร์ชันที่ build แล้ว (ต้อง `npm run build` ก่อน) |
| `npm run lint` | ตรวจสอบคุณภาพโค้ดด้วย ESLint |
| `npm test` | รัน unit test 78 เคสด้วย Vitest |

### ขั้นที่ 2 — ตั้งค่าผู้ช่วย AI ให้ใช้ Claude จริง (ไม่บังคับ)

ค่าเริ่มต้น ผู้ช่วย AI แนะนำสูตรจาก **การจับคำสำคัญในเครื่อง** (ทำงานได้ทันทีไม่ต้องตั้งค่าอะไร แต่ตีความ
คำถามได้จำกัด) ถ้าต้องการให้ AI เข้าใจภาษาธรรมชาติได้ยืดหยุ่นกว่าเดิม ให้เชื่อมต่อ Claude API:

```bash
cp .env.example .env.local
```

เปิด `.env.local` ใส่ค่า:

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
```

(ขอ API key ได้ที่ [console.anthropic.com](https://console.anthropic.com)) แล้วรัน `npm run dev` ใหม่
ระบบจะสลับไปใช้ Claude โดยอัตโนมัติเมื่อเจอค่านี้ — ไม่ต้องแก้โค้ด

### ขั้นที่ 3 — Deploy ขึ้นเว็บจริง

เป็น Next.js มาตรฐาน deploy ได้กับทุกแพลตฟอร์มที่รองรับ Next.js:

- **[Vercel](https://vercel.com)** (แนะนำ ง่ายสุด): เชื่อม repo นี้เข้ากับ Vercel แล้วกด Deploy ได้เลย
  ไม่ต้องตั้งค่าอะไรเพิ่ม ถ้าต้องการ AI จริงให้เพิ่ม Environment Variable ชื่อ `ANTHROPIC_API_KEY`
  ในหน้า Project Settings → Environment Variables
- Self-host ด้วย Docker/Node server ทั่วไป: `npm run build` แล้วรันด้วย `npm run start`

### 🔧 แก้ปัญหาที่พบบ่อย

<details>
<summary><b>กดดูวิธีแก้</b></summary>

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| `Error: listen EADDRINUSE :::3000` | มีโปรแกรมอื่นใช้พอร์ต 3000 อยู่ | รันด้วยพอร์ตอื่น: `PORT=3001 npm run dev` |
| นำเข้าไฟล์ Excel แล้วขึ้น error | ไฟล์เสียหาย, ล็อกรหัสผ่าน หรือเป็น `.xls` แบบเก่ามาก | ลองเปิดไฟล์ใน Excel แล้ว "บันทึกเป็น" `.xlsx` ใหม่ก่อนนำเข้า |
| ผู้ช่วย AI ตอบแนะนำสูตรง่ายๆ ไม่ตรงคำถาม | ยังไม่ได้ตั้งค่า `ANTHROPIC_API_KEY` (ใช้ heuristic จับคำสำคัญแทน) | ตั้งค่า API key ตาม [ขั้นที่ 2](#ขั้นที่-2--ตั้งค่าผู้ช่วย-ai-ให้ใช้-claude-จริง-ไม่บังคับ) |
| ใส่สูตรแล้วเซลล์ขึ้น `#CIRCULAR!` | สูตรอ้างอิงกลับมาที่ตัวเองทางอ้อม (เช่น A1 อ้าง B1, B1 อ้าง A1) | แก้สูตรให้ไม่วนกลับหากัน |
| ข้อมูลหายหลังรีเฟรชหรือเปิดเครื่องอื่น | ข้อมูลบันทึกอัตโนมัติลง `localStorage` ของเบราว์เซอร์/เครื่องนั้นเท่านั้น ไม่ sync ข้ามเครื่อง | กด **"ส่งออก Excel"** เพื่อได้ไฟล์เก็บไว้เสมอ แล้วนำเข้าใหม่ที่เครื่องอื่น |
| กด Ctrl+Z แล้วไม่มีอะไรเกิดขึ้น | focus ยังอยู่ในช่องพิมพ์ข้อความ (กำลังแก้เซลล์ค้าง หรืออยู่ในช่องถาม AI) | กด Enter/Escape ออกจากการแก้ไขก่อน หรือกดปุ่ม ↶ บน toolbar แทน |

</details>

---

## ✨ ฟีเจอร์

### 📐 ตารางกรอกข้อมูล (Spreadsheet Grid)

- คลิกเลือกเซลล์, **ดับเบิลคลิก**/**F2** เพื่อแก้ไข, หรือพิมพ์ทับได้ทันทีโดยไม่ต้องดับเบิลคลิกก่อน
- **แถบสูตร (formula bar)** แสดงที่อยู่ + เนื้อหาดิบของเซลล์ที่เลือกตลอดเวลาเหมือน Excel แก้ไขจากแถบนี้ได้เลย
- เลื่อนเซลล์ด้วยลูกศร/Enter/Tab, ลบเนื้อหาด้วย Delete/Backspace (คงรูปแบบไว้)
- เลือกทั้งช่วงด้วยการลากเมาส์หรือ Shift+คลิก, คลิกหัวแถว/หัวคอลัมน์เพื่อเลือกทั้งแถว/คอลัมน์
- หัวแถว/หัวคอลัมน์ปักหมุด (sticky) และไฮไลต์สีฟ้าตามตำแหน่งที่เลือก — แก้ปัญหา "เลื่อนจอแล้วงงว่าอยู่แถวไหน"

### 💾 บันทึกอัตโนมัติ + Undo/Redo

- ทุกการแก้ไข (พิมพ์ค่า, ใส่สูตร, จัดรูปแบบ, นำเข้าไฟล์) บันทึกลง `localStorage` ทันทีอัตโนมัติ ปิดแท็บ/รีเฟรช
  ข้อมูลยังอยู่ (ผูกกับเบราว์เซอร์/เครื่องนั้นเท่านั้น ไม่ sync ข้ามเครื่อง)
- **Ctrl+Z** / **Ctrl+Y** (หรือ Ctrl+Shift+Z) ย้อน/ทำซ้ำการแก้ไขเนื้อหาตาราง — เฉพาะเนื้อหาจริงเท่านั้น
  การเลื่อน selection หรือสลับแท็บชีตไม่ถูกนับเป็นประวัติ

### ✂️ คัดลอก / ตัด / วาง

- **Ctrl+C / Ctrl+X / Ctrl+V** พร้อมเส้นประไฮไลต์บอกสถานะ (ฟ้า = คัดลอก, ส้ม = ตัด)
- วางสูตรที่คัดลอกมา ระบบปรับการอ้างอิงแบบ relative ให้อัตโนมัติเหมือน Excel
- วางข้อความจากที่อื่นได้ (เช่นจาก Excel จริงหรือ Google Sheets) แยกคอลัมน์/แถวตาม Tab/บรรทัดใหม่ให้เอง
  พร้อมขยายตารางถ้าข้อมูลใหญ่กว่าที่มีอยู่

### 🎨 จัดรูปแบบเซลล์

ตัวหนา, จัดตำแหน่งข้อความ (ซ้าย/กลาง/ขวา), สีข้อความ, รูปแบบตัวเลข (ทั่วไป / ทศนิยม 2 ตำแหน่ง / เปอร์เซ็นต์ /
สกุลเงิน ฿) — ติดไปกับเซลล์เวลาคัดลอก/วางและส่งออกเป็น Excel ด้วย

### ➕ แทรก/ลบแถว-คอลัมน์

คลิกขวาที่หัวแถว/หัวคอลัมน์เพื่อแทรกหรือลบ ระบบ**ปรับสูตรทุกเซลล์ในตารางให้อ้างอิงตำแหน่งใหม่ถูกต้องอัตโนมัติ**
สูตรที่อ้างอิงถึงแถว/คอลัมน์ที่ถูกลบไปพอดีจะกลายเป็น `#REF!` ให้เห็นชัดเจนเหมือน Excel

### 🔤 เรียงลำดับและกรองข้อมูล

- **เรียงลำดับ** (A-Z/Z-A): เลือกเซลล์เดียวก็เดาขอบเขตตารางให้อัตโนมัติ พร้อมข้ามแถวหัวตารางให้ถ้าตรวจพบว่า
  เป็นข้อความอยู่เหนือข้อมูลตัวเลข
- **กรองข้อมูล**: ไอคอนกรวยที่หัวคอลัมน์ ติ๊กเลือกค่าที่จะแสดง/ซ่อนแถวได้ทันที

### 📑 หลายชีตในไฟล์เดียว

สลับ/เพิ่ม/เปลี่ยนชื่อ/ลบชีตจากแถบด้านล่างตาราง แต่ละชีตมีข้อมูล สูตร และรูปแบบแยกอิสระ แต่ **Undo/Redo และ
บันทึกอัตโนมัติครอบคลุมทุกชีตพร้อมกัน**

### 📥 นำเข้าไฟล์ Excel ที่มีอยู่แล้ว

อ่านค่าทุกเซลล์รวมถึง**สูตรและรูปแบบเดิม** เข้ามาแสดงพร้อมคำนวณผลลัพธ์ใหม่ทันที รองรับไฟล์หลายชีต
(นำเข้าเป็นแท็บแยกให้ครบ)

### 🧩 ใส่สูตรแบบลากวาง

ค้นหา/กรองตามหมวดหมู่ (คณิตศาสตร์ / สถิติ / ตรรกะ / ข้อความ / วันที่ / ค้นหา) แล้ว **ลากวาง** หรือ **คลิก**
การ์ดสูตร → เปิดแผงกรอกพารามิเตอร์พร้อมปุ่มเป้าเล็ง (🎯) ให้คลิก/ลากเลือกเซลล์จากตารางแทนการพิมพ์ที่อยู่เอง
เลือกได้ว่าจะใส่ที่**เซลล์นี้เท่านั้น / ทั้งแถว / ทั้งคอลัมน์ / ช่วงที่เลือกไว้** — ระบบปรับการอ้างอิงแบบ relative
ให้อัตโนมัติเหมือนลาก fill handle ใน Excel (อ้างอิงแบบ absolute ด้วย `$` จะไม่เลื่อนตาม)

### 🤖 ถาม AI หาสูตร

พิมพ์สิ่งที่ต้องการเป็นประโยคภาษาไทยหรืออังกฤษ เช่น _"อยากรวมยอดขายทั้งหมดในคอลัมน์นี้"_ ระบบส่งคำถาม
พร้อมช่วงเซลล์ที่เลือกอยู่ไปให้ AI แนะนำสูตร พร้อมคำอธิบายสั้นๆ กดปุ่มเดียวเพื่อใส่สูตรลงเซลล์ทันที

### 📤 ส่งออกไฟล์

- **Excel**: ไฟล์ `.xlsx` เดียวที่มี**ทุกชีต**ครบ พร้อมสูตรต้นฉบับและรูปแบบ (เปิดต่อใน Excel/Google Sheets ได้ปกติ)
- **PDF**: เฉพาะชีตที่เปิดอยู่ แสดงค่าที่คำนวณแล้วพร้อมหัวแถว/คอลัมน์ เหมาะสำหรับพิมพ์/ส่งให้คนอื่นดู

### 🌐 สองภาษา (ไทย / English)

กดปุ่ม **EN**/**ไทย** มุมขวาบนเพื่อสลับ UI ทั้งแอปทันที — เมนู ปุ่ม ชื่อ/คำอธิบายสูตรทั้ง 25 ตัว ข้อความแจ้งเตือน
และคำตอบจาก AI (ทั้ง heuristic และ Claude จริง) เปลี่ยนตามภาษาที่เลือกเสมอ จำภาษาไว้ในเบราว์เซอร์ ดูรายละเอียด
สถาปัตยกรรมที่ [ระบบสองภาษา (i18n)](#-ระบบสองภาษา-i18n)

---

## 🛠 เทคโนโลยีที่ใช้

### Framework / ภาษา

| เทคโนโลยี | เวอร์ชัน | ใช้ทำอะไร |
|---|---|---|
| [Next.js](https://nextjs.org) | 16 (App Router) | เฟรมเวิร์กหลัก ทั้งหน้าเว็บ (client component ล้วน) และ API route เดียว (`/api/ai/formula`) |
| [React](https://react.dev) | 19 | UI library |
| [TypeScript](https://www.typescriptlang.org) | 5 (strict mode) | type safety ทั้งโปรเจกต์ รวมเอนจินคำนวณสูตรและ dictionary ภาษาที่บังคับคีย์ให้ตรงกัน |
| [Tailwind CSS](https://tailwindcss.com) | 4 | จัดสไตล์ทั้งหมดแบบ utility-class |

### ไลบรารีหลัก

| ไลบรารี | ใช้ทำอะไร |
|---|---|
| `zustand` | จัดการ state ส่วนกลาง (`sheetStore` — ตาราง/selection/แผงสูตร, `localeStore` — ภาษา) พร้อม middleware `persist` บันทึกอัตโนมัติลง `localStorage` |
| `zundo` | ต่อยอด zustand เก็บประวัติแก้ไขตาราง ทำ Undo/Redo (เฉพาะเนื้อหาตาราง ไม่รวม selection/UI ชั่วคราว) |
| `exceljs` | อ่าน/สร้างไฟล์ `.xlsx` คงสูตรและรูปแบบเดิมไว้ (เลือกแทน `xlsx`/SheetJS เพราะเวอร์ชัน npm ของ `xlsx` มีช่องโหว่ความปลอดภัยที่ยังไม่แพตช์) |
| `jspdf` + `jspdf-autotable` | สร้างไฟล์ PDF จากตารางที่คำนวณค่าแล้ว |
| `@anthropic-ai/sdk` | เชื่อมต่อ Claude API สำหรับผู้ช่วย AI |
| `lucide-react` | ไอคอน UI |
| `clsx` | รวม className แบบมีเงื่อนไข |
| `vitest` | unit test เอนจินคำนวณสูตรและตรรกะเรียงข้อมูล (78 เคส) |

> **หมายเหตุ:** ไม่ได้ใช้ไลบรารีคำนวณสูตรสำเร็จรูป (เช่น HyperFormula) แต่เขียน **เอนจินคำนวณสูตรขึ้นเอง**
> ทั้ง tokenizer, parser, evaluator และฟังก์ชันต่างๆ เพื่อควบคุมพฤติกรรมได้เต็มที่ ดูรายละเอียดที่หัวข้อ
> [เอนจินคำนวณสูตร](#-เอนจินคำนวณสูตร)

### เครื่องมือ

- **Node.js 18.18+** (แนะนำ 20 หรือ 22) และ npm
- **ESLint 9** (`eslint-config-next`) ตรวจโค้ด, รวมกฎเฉพาะของ React 19 (`react-hooks/set-state-in-effect`, `react-hooks/refs`)
- **Vitest 3** unit test
- ไม่ต้องมีฐานข้อมูลหรือ backend แยก — ทุกอย่างรันใน Next.js เดียว

---

## 🏛 สถาปัตยกรรม

### ภาพรวมระบบ

แอปนี้เป็น **client-rendered ล้วน** (ทุกหน้าคือ `"use client"`) มีจุดเดียวที่แตะเซิร์ฟเวอร์จริงๆ คือ endpoint
ผู้ช่วย AI — ข้อมูลตารางทั้งหมดอยู่ในเบราว์เซอร์ ไม่มีฐานข้อมูลฝั่งเซิร์ฟเวอร์

```mermaid
flowchart LR
    subgraph browser["เบราว์เซอร์ผู้ใช้"]
        UI["หน้าเว็บ (React, client component ล้วน)"]
        Store["Zustand stores<br/>sheetStore + localeStore"]
        LS[("localStorage<br/>ตาราง + ภาษา")]
        Engine["Formula Engine<br/>คำนวณสูตรทั้งหมดในเครื่อง"]
    end

    subgraph server["Next.js Server"]
        API["/api/ai/formula<br/>(จุดเดียวที่มี server-side logic)"]
    end

    Claude[("Claude API")]

    UI <--> Store
    Store <--> LS
    UI --> Engine
    UI -->|"POST คำถาม + selection + locale"| API
    API -->|"มี ANTHROPIC_API_KEY"| Claude
    API -->|"ไม่มี key"| Heuristic["จับคำสำคัญในเครื่อง (heuristic)"]
    Claude --> API
    Heuristic --> API
    API -->|"สูตร + คำอธิบาย"| UI
```

### State management

`sheetStore` เป็นแหล่งความจริงเดียวของทั้งแอป ต่อ middleware สองชั้น: `persist` (บันทึกอัตโนมัติ) ครอบ
`temporal` จาก `zundo` (undo/redo) — แต่ละชั้น "เห็น" state คนละส่วน เพื่อไม่ให้ selection หรือ UI ชั่วคราว
ปนเข้าไปในประวัติ undo หรือไฟล์ที่บันทึก:

```mermaid
flowchart TB
    Components["Components (features/*)<br/>อ่าน/แก้ state ผ่าน useSheetStore โดยตรง"]

    subgraph sheetStore["sheetStore"]
        direction TB
        Full["state เต็ม: sheets, activeSheetId,<br/>selectionBySheetId, filtersBySheetId,<br/>pending, clipboard, sidebarMode, busy"]
        Temporal["temporal (zundo) เห็นแค่: sheets<br/>→ ประวัติ undo/redo"]
        Persist["persist เห็นแค่: sheets, activeSheetId<br/>→ บันทึกอัตโนมัติ"]
    end

    Components --> Full
    Full -.->|partialize| Temporal
    Full -.->|partialize| Persist
    Temporal --> History[("ประวัติ undo/redo<br/>ในหน่วยความจำ")]
    Persist --> LS[("localStorage:<br/>exceltogo-sheet-v2")]

    LocaleStore["localeStore (แยกต่างหาก)<br/>persist เท่านั้น ไม่มี undo"] --> LS2[("localStorage:<br/>exceltogo-locale")]
```

**ทำไมต้องแยกแบบนี้:** ช่วงหนึ่งของการพัฒนา เคยเก็บ `selection` ไว้ใน `sheets` ตรงๆ ผลคือ**คลิกเลือกเซลล์เฉยๆ
ก็ถูกนับเป็นประวัติ undo** (เพราะ zundo มองว่า state เปลี่ยน) แก้โดยย้าย `selectionBySheetId`/`filtersBySheetId`
ออกมาเป็น field แยกนอก `sheets` แล้วให้ `partialize` ของทั้ง `temporal` และ `persist` มองเห็นเฉพาะ `sheets`
(และ `activeSheetId` สำหรับ persist) เท่านั้น

### Clean layering ของ `src/lib/`

โค้ดที่ไม่ผูกกับ React/UI แยกออกมาทั้งหมด ทดสอบได้อิสระโดยไม่ต้องเปิดเบราว์เซอร์:

```
sheetStore.ts (Zustand actions)
      │
      ▼
sheet.ts / sheetClipboard.ts / sheetSort.ts   ← โมเดลข้อมูลตาราง + การคำนวณทั้งชีต
      │
      ▼
formulaEngine/ (tokenizer → parser → evaluator → functions)
```

`sheet.ts` เดิมเคยเป็นไฟล์เดียวที่รวมทั้งโมเดล, clipboard, TSV, และการเรียงลำดับ — แยกออกเป็น 3 ไฟล์ตามหน้าที่
(`sheetClipboard.ts`, `sheetSort.ts`) โดย `sheet.ts` ยัง re-export ทั้งคู่ไว้ เพื่อให้โค้ดที่ import `@/lib/sheet`
จุดเดียวใช้งานได้เหมือนเดิมทุกที่ ไม่ต้องแก้ import ทั่วโปรเจกต์

---

## 📁 โครงสร้างโปรเจกต์

```
src/
  app/
    page.tsx                 # หน้าเว็บหลัก แค่ประกอบคอมโพเนนต์ตาม state จาก store (ไม่ถือ state เอง)
    api/ai/formula/route.ts  # API endpoint ให้ AI แนะนำสูตร (ใช้ Claude หรือ heuristic fallback)
  store/
    sheetStore.ts            # Zustand store หลัก — sheets, activeSheetId, selection/ตัวกรองต่อชีต,
                              # แผงสูตรที่กำลังกรอก, แถบข้างที่เปิดอยู่ + action ทั้งหมด ต่อด้วย
                              # persist (บันทึกอัตโนมัติ) + zundo (undo/redo) ครอบคลุมทุกชีตร่วมกัน
    localeStore.ts           # Zustand store แยกสำหรับภาษา UI ที่เลือก (th/en) — persist เหมือนกัน
                              # แต่ไม่ผูกกับ undo/redo ของตาราง
  i18n/                      # ข้อความ UI ทั้งหมด แยกตามภาษา (ไม่ใช้ไลบรารี i18n สำเร็จรูป)
    types.ts                 # type `Messages` กลาง — TypeScript บังคับให้ th.ts/en.ts มีคีย์ตรงกันทุกตัว
    th.ts, en.ts              # dictionary ข้อความจริง (ปุ่ม/label/ชื่อ-คำอธิบายสูตร/ข้อความแจ้งเตือน ฯลฯ)
    messages.ts               # map locale -> Messages เปล่าๆ ใช้ได้จากทั้ง client และ server (API route)
    index.ts                  # useT()/useLocale() (hook สำหรับ component) + getMessages() (ใช้ใน store)
  features/
    grid/SpreadsheetGrid.tsx        # ตารางหลัก (เลือกเซลล์, แก้ไข, sticky header, คลิกขวาแทรก/ลบแถว-คอลัมน์,
                                     # ซ่อนแถวที่ถูกกรอง, drag-drop รับสูตร)
    grid/useHeaderContextMenu.ts    # hook: state + เปิด/ปิดเมนูคลิกขวาที่หัวแถว/คอลัมน์
    grid/useColumnFilterPopoverState.ts # hook: state + เปิด/ปิด/สลับป็อปอัปตัวกรองคอลัมน์
    grid/useClickAway.ts            # hook กลาง: ปิดป็อปอัป/เมนูเมื่อคลิกหรือ scroll ออกนอกพื้นที่
    grid/FormulaBar.tsx             # แถบสูตรด้านบนตาราง
    grid/SheetTabs.tsx              # แถบแท็บชีตด้านล่างตาราง
    grid/ColumnFilterPopover.tsx    # ป็อปอัปตัวกรองต่อคอลัมน์
    formulas/FormulaPalette.tsx     # แถบรายการสูตร ค้นหา/กรองหมวดหมู่/ลากวาง
    formulas/FormulaParamPanel.tsx  # แผงกรอกพารามิเตอร์สูตร + เลือกช่วงจากตาราง + เลือก scope
    ai/AIAssistantPanel.tsx         # แชทถาม AI หาสูตร
    toolbar/Toolbar.tsx             # แถบเครื่องมือด้านบน
    toolbar/FormatBar.tsx           # แถบจัดรูปแบบเซลล์ + ปุ่มเรียงลำดับ
    toolbar/LanguageToggle.tsx      # ปุ่มสลับภาษา UI
  lib/                       # ตรรกะหลักของโดเมน ไม่ผูกกับ React/UI แก้ไข/ทดสอบแยกจาก UI ได้อิสระ
    formulaEngine/           # เอนจินคำนวณสูตรที่เขียนเอง — tokenizer.ts, parser.ts, ast.ts, evaluator.ts,
                              # functions.ts, coerce.ts, address.ts, shift.ts, structuralShift.ts
                              # พร้อม unit test คู่กันทุกไฟล์ (*.test.ts, รันด้วย Vitest)
    formulaCatalog.ts        # โครงสร้างรายการสูตรสำเร็จรูป (id/พารามิเตอร์/วิธีประกอบสูตร) — ชื่อ/คำอธิบาย/
                              # label ที่แสดงจริงมาจาก src/i18n/th.ts,en.ts ตามภาษาที่เลือก
    cellFormat.ts            # รูปแบบเซลล์ (ตัวหนา/สี/จัดตำแหน่ง/รูปแบบตัวเลข) + แปลงเป็น/จาก numFmt ของ Excel
    aiHeuristic.ts           # ตรรกะแนะนำสูตรจากคำสำคัญ (ใช้เมื่อไม่มี ANTHROPIC_API_KEY) แบบสองภาษา
    sheet.ts                 # โมเดลข้อมูลตารางหลัก, คำนวณค่าทั้งชีต, ใส่สูตรตาม scope ต่างๆ, แทรก/ลบแถว-คอลัมน์
    sheetClipboard.ts        # คัดลอก/ตัด/วาง, แปลงเป็น/จาก TSV (สำหรับ paste ข้ามแอป)
    sheetSort.ts             # ตรวจจับช่วงที่จะเรียง + เรียงลำดับข้อมูล
    excelIO.ts                # นำเข้า/ส่งออก workbook หลายชีต (.xlsx) ด้วย exceljs พร้อมรูปแบบเซลล์
    pdfExport.ts              # ส่งออก PDF ด้วย jspdf + jspdf-autotable
  types/
    sheet-ui.ts               # types สำหรับ selection ของตารางฝั่ง UI
```

ทุกคอมโพเนนต์ใน `features/` อ่าน/แก้ state ผ่าน `useSheetStore` โดยตรง (ไม่ผ่าน props จาก `page.tsx`) จึงไม่ต้อง
ส่ง props เป็นทอดๆ (prop drilling) และเพิ่มฟีเจอร์ใหม่ได้ง่ายในที่เดียวคือ `store/sheetStore.ts`

---

## 🧮 เอนจินคำนวณสูตร

ส่วนที่ตั้งใจทำมากที่สุดของโปรเจกต์ เพราะเป็นจุดที่ผิดพลาดแล้วผู้ใช้จะไม่รู้ตัว (ตัวเลขผิดเงียบๆ)

### Pipeline

```mermaid
flowchart LR
    Raw["สูตรดิบ<br/>เช่น =SUM(A1:A10)*2"] --> Tok["tokenizer.ts<br/>แยกเป็น token"]
    Tok --> Par["parser.ts<br/>สร้าง AST (recursive descent)"]
    Par --> Eval["evaluator.ts<br/>เดิน AST คำนวณผล"]
    Eval -->|"เรียกฟังก์ชัน"| Fn["functions.ts<br/>42 ฟังก์ชัน"]
    Eval -->|"getCell(row, col)"| Sheet[("ค่า/สูตรของ<br/>เซลล์อื่นในชีต")]
    Sheet -.-> Eval
    Eval --> Result["ค่าตัวเลข/ข้อความ<br/>หรือ FormulaError"]
```

- **Tokenizer** แยกสตริงสูตรเป็น token (ตัวเลข, ข้อความ, cell ref `A1`, range ref `A1:B10`, ฟังก์ชัน,
  ตัวดำเนินการ) รองรับ absolute reference (`$A$1`) และ literal `#REF!`
- **Parser** เป็น recursive-descent parser ธรรมดา จัดลำดับความสำคัญตัวดำเนินการถูกต้อง (`^` ทำก่อน `* /`
  ก่อน `+ -` ก่อนเปรียบเทียบ) และ `^` เป็น right-associative
- **Evaluator** เดิน AST คำนวณผล แยกผลลัพธ์เป็น scalar หรือ range (ให้ฟังก์ชันอย่าง `VLOOKUP`/`SUMIF` รู้ว่า
  arg ไหนเป็นช่วง) และตรวจ **circular reference** ด้วย `Set` ของเซลล์ที่กำลังคำนวณอยู่ — ถ้าวนกลับมาเจอตัวเอง
  จะคืนค่า `#CIRCULAR!` แทนที่จะ stack overflow

### สองอัลกอริทึมสำหรับปรับการอ้างอิงในสูตร

จุดที่คนมักมองข้าม: "เลื่อนสูตรตอนคัดลอก" กับ "เลื่อนสูตรตอนแทรก/ลบแถว-คอลัมน์" เป็นคนละอัลกอริทึมกัน
ทำผิดฝั่งใดฝั่งหนึ่งจะได้สูตรที่ผิดแบบเงียบๆ:

| | `shift.ts` (relative shift) | `structuralShift.ts` (structural shift) |
|---|---|---|
| ใช้ตอนไหน | คัดลอก/วาง, ลาก fill handle | แทรก/ลบแถวหรือคอลัมน์ |
| อ้างอิงแบบ `$A$1` (absolute) | **ไม่เลื่อนตาม** (พฤติกรรมมาตรฐานของ Excel) | เลื่อนตามเสมอ (แถวถูกแทรกจริง ทุกอ้างอิงต้องขยับ) |
| อ้างอิงชนตำแหน่งที่ถูกลบพอดี | ไม่เกิดกรณีนี้ | กลายเป็น `#REF!` |
| ช่วง (range) ที่คร่อมตำแหน่งแทรก/ลบ | เลื่อนทั้งช่วงเท่ากัน | **ขยาย/หด** ตามจริง (แทรกกลางช่วง → ช่วงยาวขึ้น, ลบขอบช่วงจนว่าง → `#REF!`) |

### ฟังก์ชันที่รองรับ

แถบสูตรที่ลากวางได้แสดงแค่ **25 สูตร** ที่ใช้บ่อยที่สุด แต่ตัวเอนจินจริงรองรับ **42 ฟังก์ชัน** — ที่เหลือพิมพ์ตรง
ในเซลล์ได้เลยแม้ไม่มีการ์ดในแถบสูตร (เช่น `=MID(...)`, `=YEAR(...)`, `=PROPER(...)`):

| หมวดหมู่ | อยู่ในแถบสูตร (25) | พิมพ์ตรงในเซลล์ได้เพิ่ม |
|---|---|---|
| คณิตศาสตร์ | `SUM` `PRODUCT` `ROUND` `ABS` `SUMIF` | `ROUNDUP` `ROUNDDOWN` `SQRT` `POWER` `MOD` `INT` |
| สถิติ | `AVERAGE` `COUNT` `COUNTA` `MIN` `MAX` `COUNTIF` `AVERAGEIF` | `COUNTBLANK` |
| ตรรกะ | `IF` `IFERROR` `AND` `OR` | `NOT` `IFNA` |
| ข้อความ | `CONCATENATE` `UPPER` `LOWER` `TRIM` `LEFT` `RIGHT` | `CONCAT` `MID` `LEN` `PROPER` `TEXT` |
| วันที่ | `TODAY` `NOW` | `DAY` `MONTH` `YEAR` |
| ค้นหา | `VLOOKUP` | — |

รองรับตัวดำเนินการคำนวณ/เปรียบเทียบ/ต่อข้อความครบ (`+ - * / ^ = <> < > <= >= &`) และแจ้ง error แบบ Excel:
`#DIV/0!`, `#VALUE!`, `#NAME?`, `#N/A`, `#REF!`, `#CIRCULAR!`

ต้องการสูตรเพิ่มเติมในแถบลากวาง? เพิ่มฟังก์ชันจริงที่ `functions.ts` แล้วเพิ่มรายการ + คำแปล 2 ภาษาที่
`formulaCatalog.ts` + `i18n/th.ts`/`en.ts`

---

## 🌐 ระบบสองภาษา (i18n)

ไม่ได้ใช้ไลบรารี i18n สำเร็จรูป (เช่น next-intl) เพราะแอปนี้ render ฝั่ง client ทั้งหมดอยู่แล้วและไม่ต้องการ
routing ตาม locale (`/en/...`) — เขียน dictionary ของแอปเองแทน โดยให้ **TypeScript เป็นตัวคุมคุณภาพการแปล**:

```mermaid
flowchart LR
    Types["i18n/types.ts<br/>interface Messages (คีย์กลาง)"] -.implements.-> TH["i18n/th.ts"]
    Types -.implements.-> EN["i18n/en.ts"]
    TH --> Map["i18n/messages.ts<br/>Record&lt;Locale, Messages&gt;"]
    EN --> Map
    Map --> Hooks["i18n/index.ts<br/>useT() / useLocale() (client)<br/>getMessages() (server/store)"]
    Hooks --> Components["Components ทุกตัว"]
    Hooks --> Store["sheetStore actions<br/>(busy/error message)"]
    Map --> Route["/api/ai/formula<br/>(import ตรงจาก messages.ts<br/>ไม่พึ่ง Zustand)"]
```

- `th.ts`/`en.ts` ต้อง implement type `Messages` ตัวเดียวกัน — ลืมแปลคีย์ไหนแม้แต่คีย์เดียว **build จะแดง
  ทันที** (ไม่ใช่ไปพังตอนรันจริงแล้วเจอข้อความว่างๆ)
- แยก `messages.ts` (แค่ map เปล่าๆ ไม่มี dependency กับ Zustand/browser) ออกจาก `index.ts` (มี hook ที่ผูกกับ
  `localeStore`) เพื่อให้ **API route** (โค้ดฝั่งเซิร์ฟเวอร์) import ได้โดยไม่ลาก `localStorage`/React เข้าไปด้วย
- ผู้ช่วย AI เข้าใจคำถามได้ทั้งสองภาษาเสมอ (คำสำคัญของ heuristic ใส่ไว้ทั้งไทย/อังกฤษในลิสต์เดียว) แต่**คำตอบ
  ตอบเป็นภาษาที่ UI ตั้งไว้ตอนนั้นเสมอ** — ฝั่ง client ส่ง `locale` แนบไปกับคำถามทุกครั้ง ระบบเลือก system prompt
  ของ Claude หรือคำอธิบายของ heuristic ตามภาษานั้น
- ข้อมูลตัวอย่าง (seed data) ตอนเปิดแอปครั้งแรกยังคงเป็นภาษาไทย (ตาม default locale) **ตั้งใจไม่ทำให้
  regenerate ตามภาษาที่สลับ** เพราะจะเสี่ยงเขียนทับข้อมูลจริงของผู้ใช้โดยไม่ตั้งใจ

---

## 🧪 การทดสอบ

```bash
npm test      # 78 เคส ใน 7 ไฟล์ ด้วย Vitest
```

โฟกัสเทสต์ไปที่ **เอนจินคำนวณสูตรและตรรกะเรียงข้อมูล** — ส่วนที่เป็น pure function ล้วน ไม่ต้องพึ่ง React/DOM
จึงเทสต์ได้เร็วและมั่นใจได้สูง ส่วน UI/interaction verify ด้วย Playwright แบบ manual ระหว่างพัฒนาแต่ละฟีเจอร์
(ไม่ได้ commit สคริปต์ไว้ในโปรเจกต์ เพราะเป็นเครื่องมือช่วยตรวจสอบชั่วคราว ไม่ใช่ regression suite ถาวร)

| ไฟล์ | เคส | ทดสอบอะไร |
|---|---|---|
| `tokenizer.test.ts` | 8 | literal, cell/range ref (รวม absolute `$`), operator, การ escape string, token `#REF!` |
| `parser.test.ts` | 14 | ลำดับความสำคัญ/associativity ของตัวดำเนินการ, range, function call, syntax error |
| `evaluator.test.ts` | 10 | เลขคณิต, เปรียบเทียบ, ต่อข้อความ, อ่านค่าเซลล์/ช่วง, การกระจาย error |
| `functions.test.ts` | 16 | ฟังก์ชันกลุ่มรวม/ปัดเศษ/ตรรกะ/ข้อความ/ค้นหา ทั้งไลบรารี (SUM, VLOOKUP, SUMIF, IFERROR ฯลฯ) |
| `shift.test.ts` | 8 | การเลื่อนอ้างอิงแบบ relative ตอนคัดลอก/วาง, absolute ไม่เลื่อน |
| `structuralShift.test.ts` | 15 | การปรับอ้างอิงตอนแทรก/ลบแถว-คอลัมน์ รวม `#REF!` และการขยาย/หดของช่วง |
| `sheetSort.test.ts` | 7 | ฮิวริสติกตรวจจับขอบเขต+หัวตาราง และการเรียงลำดับ (รวมกรณีค่าว่าง, จำกัดคอลัมน์ที่ย้าย) |

CI: `npm run lint` → `npm run build` (บังคับ type-check เต็มโปรเจกต์ รวม parity ของ `Messages` สองภาษา) →
`npm test` — รันด้วยมือทุกครั้งก่อน commit (ยังไม่ได้ตั้ง GitHub Actions อัตโนมัติ ดู [สิ่งที่จะทำต่อ](#-สิ่งที่จะทำต่อ))

---

## 🔭 สิ่งที่จะทำต่อ

สิ่งที่ยังไม่ได้ทำและเหตุผล — เพื่อให้เห็นว่ารู้ตัวว่าอะไรยังขาด ไม่ใช่ลืม

- [ ] **CI อัตโนมัติ (GitHub Actions)** — ตอนนี้ lint/build/test รันด้วยมือก่อน push ทุกครั้ง ยังไม่ได้ตั้ง workflow
- [ ] **บันทึกลงคลาวด์ / sync ข้ามเครื่อง** — ตอนนี้ข้อมูลอยู่ใน `localStorage` ของเบราว์เซอร์เดียวเท่านั้น
  ต้องกด "ส่งออก Excel" เพื่อย้ายไฟล์เอง (ไม่มีบัญชีผู้ใช้/ฐานข้อมูลฝั่งเซิร์ฟเวอร์ในสโคปปัจจุบัน)
- [ ] **กราฟ/แผนภูมิ** จากข้อมูลในตาราง
- [ ] **รวมเซลล์ (merge cells)** และการ freeze เพิ่มเติมนอกเหนือจากหัวแถว/หัวคอลัมน์ที่ sticky อยู่แล้ว
- [ ] **คอมเมนต์ในเซลล์** และ conditional formatting (ไฮไลต์ตามเงื่อนไข)
- [ ] **ฟังก์ชันเพิ่มเติม** เช่น `INDEX`/`MATCH`, `SUMIFS`/`COUNTIFS` (หลายเงื่อนไข), ฟังก์ชันวันที่แบบคำนวณ
  ระยะห่าง (`DATEDIF` ฯลฯ)
- [ ] **รองรับมือถือ/แท็บเล็ต** — ตอนนี้ออกแบบมาสำหรับหน้าจอคอมพิวเตอร์เป็นหลัก ยังไม่ได้ปรับ layout/touch
  สำหรับจอเล็ก
- [ ] **Import/Export CSV** โดยตรง (ตอนนี้ผ่าน `.xlsx` เท่านั้น)

**ตั้งใจไม่ทำในสโคปนี้:**

- **แก้ไขพร้อมกันหลายคน (real-time collaboration)** — ต้องมี backend + WebSocket ซึ่งขัดกับการออกแบบที่ตั้งใจ
  ให้เป็นเครื่องมือส่วนตัวรันในเบราว์เซอร์ล้วนๆ ไม่มี backend
- **ใช้ไลบรารีคำนวณสูตรสำเร็จรูป** — ตั้งใจเขียนเอนจินเองเพื่อควบคุมพฤติกรรมได้เต็มที่ (ดู
  [เอนจินคำนวณสูตร](#-เอนจินคำนวณสูตร)) แม้จะได้ฟังก์ชันน้อยกว่าไลบรารีสำเร็จรูปอย่าง HyperFormula

---

## 📄 License

โปรเจกต์นี้ยังไม่ได้ระบุสัญญาอนุญาต (license) อย่างเป็นทางการ หากต้องการนำโค้ดไปใช้ต่อ ดัดแปลง หรือใช้ในเชิง
พาณิชย์ กรุณาติดต่อเจ้าของ repository ก่อน
