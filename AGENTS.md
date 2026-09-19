# ExcelToGo — กติกาของโปรเจกต์นี้ / House rules

## ก่อน push ทุกครั้ง: เช็กและอัปเดต README เสมอ
## Before every push: check and update the README

รันคำสั่งเดียวจบ — ต้องเขียวทั้งหมดก่อน commit:
Run one command and get it green before committing:

```bash
npm run verify     # lint → check:readme → test → build → check:a11y → check:e2e
```

GitHub Actions รันหกด่านเดียวกันนี้ทุก push และทุก PR (`.github/workflows/ci.yml`, Node 20.19 / 22.12 / 24;
ด่าน a11y กับ e2e แยกเป็น job ของตัวเองเพราะต้องใช้เบราว์เซอร์) —
รันเองก่อนยังคงเร็วกว่ารอ CI บอกว่าพัง
GitHub Actions runs the same six gates on every push and PR (Node 20.19 / 22.12 / 24; the a11y and e2e gates
are jobs of their own because they need a browser) — running them yourself
first is still faster than waiting for CI to tell you.

`npm run check:a11y` รัน axe บนทั้งสองหน้า ที่ **390px และ 1280px** (WCAG 2.0/2.1/2.2 A+AA) แล้วเช็ก
ว่าไม่มีการเลื่อนแนวนอนที่ 360/390/820/1280/1440 — สองความกว้างเพราะเคยพลาดมาแล้ว: audit ที่รัน
เฉพาะความกว้างเดสก์ท็อปรายงาน 0 violations ทั้งที่ต่ำกว่า 640px มีปุ่มไม่มีชื่อ 8 ปุ่ม (ข้อความถูกซ่อนด้วย `sm:`)
`npm run check:a11y` runs axe on both pages at **390px and 1280px** (WCAG 2.0/2.1/2.2 A+AA), then checks
for sideways scroll at 360/390/820/1280/1440. Two widths because one was not enough: an audit run only at
desktop width reported zero violations while eight buttons below 640px had no accessible name at all.

ด่านนี้ยัง **เปิดพาเนลขึ้นมาตรวจด้วย** ไม่ใช่สแกนแค่หน้าตอนโหลด — พาเลตสูตร, AI, ข้อมูลสด, conditional
formatting, กราฟ, pivot, ค้นหา/แทนที่ และหน้าคีย์ลัด รวม 30 checks **เพิ่มพาเนลใหม่เมื่อไร เติมใน
`OPENED_STATES` เมื่อนั้น** และสถานะที่เปิดไม่ขึ้นถือว่าด่านตก ไม่ใช่ข้าม
The gate also **opens panels before scanning them** rather than only scanning the page as it loads — the
formula palette, AI, live data, conditional formatting, charts, pivots, find/replace and the shortcut
dialog, 30 checks in all. **A new panel means a new entry in `OPENED_STATES`**, and a state that will not
open fails the gate rather than being skipped.

`npm run check:e2e` ขับแอปจริงในเบราว์เซอร์ 8 flow — พิมพ์สูตรแล้วดูค่าขยับ, ส่งออก `.xlsx` แล้วนำกลับเข้ามา,
เดินด้วยคีย์บอร์ดล้วน, undo, "เปลี่ยนอะไรไกลจากเคอร์เซอร์แล้วพูดออกมาไหม", ผู้ช่วย AI (stub route ไว้
ทั้งกรณีตอบปกติและกรณีโดน rate limit) และ CSP (header มาจริง, ยิงออกนอก policy ไม่ได้, แอปเองไม่สะดุด) เกณฑ์เลือก flow มีข้อเดียว:
**unit test จับได้อยู่แล้วหรือเปล่า** ถ้าจับได้ ไม่ต้องอยู่ที่นี่ ที่เหลือคือรอยต่อ ซึ่งเป็นที่ที่บั๊กของโปรเจกต์นี้อยู่ทุกตัว
`npm run check:e2e` drives the real app in a browser through 8 flows — type a formula and watch the value
move, export `.xlsx` and import it back, keyboard only, undo, whether a change away from the cursor is
announced, the AI assistant with its route stubbed (both a normal answer and a rate limit), and the CSP
(served, blocking exfiltration, and not tripping the app up). Flows are picked by one rule: **would a unit test already catch it?** If yes it does not belong
there. What is left is the seams, which is where every bug in this project has actually lived.

`npm run check:readme` (ไม่มี dependency เพิ่ม) จับสิ่งที่ตาคนมักพลาด:
`npm run check:readme` is dependency-free and catches what the eye misses:

- ลิงก์ `#anchor` ภายใน README ชี้ไปหัวข้อที่มีจริงไหม (รองรับสระ/วรรณยุกต์ไทย)
- ภาพที่อ้างถึงมีอยู่จริง และไม่มีภาพกำพร้าใน `public/screenshots/`
- จำนวนเทสต์ที่เขียนไว้ (badge, TL;DR, ตารางคำสั่ง, หัวข้อการทดสอบ) ตรงกับของจริง
- โมดูลใหม่ใน `src/lib/` ถูกเขียนถึงในผังโครงสร้างของ README ทั้งสองภาษา
- ฟีเจอร์ใน README ไทยกับอังกฤษมีจำนวนเท่ากัน (ไม่แปลตกหล่น)
- ทุกหัวข้อฟีเจอร์ถูกลิงก์จากสารบัญ — เคยเกิดขึ้นแล้วว่าเขียนฟีเจอร์ไว้ครบแต่หาไม่เจอ
- ตัวเลขบนการ์ด link preview (`src/app/opengraph-image.tsx`) ตรงกับของจริง — การ์ดที่เรนเดอร์ถูกไม่มีใครอ่านซ้ำ
  เลขเก่าจึงอยู่ได้นานที่สุดตรงนั้น (เคยเขียน "505 automated tests" ค้างไว้ข้ามหลายร้อยเทสต์)
- `public/social-preview.png` มีอยู่จริงและยังเป็น 1280×640 (ขนาดที่ GitHub crop) — ตัวเลขบนภาพตรวจไม่ได้
  จึงให้ `npm run build:social` นับจากซอร์สแทนการพิมพ์ใส่ดีไซน์ เปลี่ยนตัวเลขเมื่อไรรันใหม่เมื่อนั้น
  **ตัวเลขทั้งหมดมาจาก `scripts/counts.mjs` ที่เดียว** — เคยแยกเป็นสองสำเนา แล้วเติมไฟล์เทสต์ความปลอดภัย
  ลงแค่สำเนาเดียว การ์ดจึงเขียน 91 ทั้งที่ทุกที่อื่นเขียน 103 และไม่มีด่านไหนจับได้เพราะการ์ดเป็น PNG
  เพิ่มไฟล์เทสต์ความปลอดภัยใหม่ ให้เติมใน `SECURITY_TEST_FILES` ของไฟล์นั้นที่เดียว
- จำนวน *ไฟล์* เทสต์ที่เขียนไว้ตรงกับของจริง (เคยเขียน 27 ทั้งที่มี 35)

### สิ่งที่สคริปต์เช็กแทนไม่ได้ — ต้องอ่านเอง
### What the script can't check — read it yourself

- **ฟีเจอร์ใหม่ที่ผู้ใช้เห็น ต้องมีหัวข้อของตัวเองในหัวข้อ "ฟีเจอร์"** พร้อมภาพถ้าเป็นเรื่องของหน้าตา
  A new user-facing feature needs its own section under Features, with a screenshot if it's visual.
- **คำโปรยเปิดกับ English TL;DR ยังบรรยายสิ่งที่แอปเป็นอยู่จริงไหม** ไม่ใช่แค่ตอนเริ่มโปรเจกต์
  Does the opening pitch still describe what the app is now, not what it was at the start?
- **ข้อจำกัดต้องเขียนให้ชัด** — "ยังไม่รองรับ X" มีค่ามากกว่าการเงียบไว้
  State the limits plainly; "X isn't supported" is worth more than silence.
- **roadmap ในหัวข้อ "สิ่งที่จะทำต่อ"** ติ๊กของที่ทำเสร็จ และเพิ่มช่องว่างใหม่ที่เพิ่งเจอ
  Tick off what shipped, and add the gaps the work just revealed.
- **README ทั้งสองภาษาต้องแก้คู่กันเสมอ** (`README.md` ไทย · `README.en.md` อังกฤษ)
  Both READMEs change together, always.
- **ตัวเลขที่เคลมต้องนับมาจริง** เช่น จำนวนสูตร/ฟังก์ชัน — เคยเขียนผิดมาแล้ว (22/41 ทั้งที่จริงคือ 25/42)
  Counts must come from counting. A wrong one shipped before: 22/41 claimed, 25/42 actual.
- **ภาพหน้าจอก็เคลมตัวเลขได้ และไม่มีด่านไหนอ่านมันออก** — `check:readme` นับเทสต์จาก *ข้อความ* ภาพ
  landing page ที่เขียนว่า "519 เทสต์" จึงผ่านทุกด่านอยู่หลายวันทั้งที่จริงเป็น 577 เปลี่ยน UI หรือตัวเลขที่
  โชว์อยู่ในภาพเมื่อไร ต้องถ่ายใหม่เมื่อนั้น
  A screenshot makes claims too, and no gate can read it. `check:readme` counts tests in *text*, so a
  landing-page image reading "519 tests" passed every gate for days while the real figure was 577.
  Change the UI or a number it shows, and the screenshot has to be retaken.

### เรื่องอื่นที่ทำเป็นปกติ / Other habits

- ภาพหน้าจอถ่ายจาก **production build** (`npm run build && npm run start`) ไม่ใช่ `next dev`
  เพราะ dev overlay จะติดมาในภาพ — และเก็บไว้ที่ `public/screenshots/` ที่เดียว ใช้ร่วมกันทั้ง
  landing page และ README
- ยืนยันฟีเจอร์ที่เห็นด้วยตาด้วย Playwright แล้ว **ลบสคริปต์ชั่วคราวก่อน commit** — `package.json`/lockfile
  ต้องไม่มี diff **แต่ playwright กับ `@axe-core/playwright` เป็น devDependency จริงแล้ว** (ด่าน `check:a11y`)
  จึงห้าม `npm uninstall` สองตัวนี้ ส่วนเครื่องมือชั่วคราวอย่างอื่น (pdfjs-dist, openpyxl ฯลฯ) ยังต้องถอนเหมือนเดิม
- พัฒนาบนบรานช์ `claude/excel-sheet-ui-builder-8ooz26` และ merge เข้า `main` เฉพาะตอนที่สั่งเท่านั้น

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
