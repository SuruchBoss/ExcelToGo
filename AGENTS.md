# ExcelToGo — กติกาของโปรเจกต์นี้ / House rules

## ก่อน push ทุกครั้ง: เช็กและอัปเดต README เสมอ
## Before every push: check and update the README

รันคำสั่งเดียวจบ — ต้องเขียวทั้งหมดก่อน commit:
Run one command and get it green before committing:

```bash
npm run verify     # lint → check:readme → test → build
```

`npm run check:readme` (ไม่มี dependency เพิ่ม) จับสิ่งที่ตาคนมักพลาด:
`npm run check:readme` is dependency-free and catches what the eye misses:

- ลิงก์ `#anchor` ภายใน README ชี้ไปหัวข้อที่มีจริงไหม (รองรับสระ/วรรณยุกต์ไทย)
- ภาพที่อ้างถึงมีอยู่จริง และไม่มีภาพกำพร้าใน `public/screenshots/`
- จำนวนเทสต์ที่เขียนไว้ (badge, TL;DR, ตารางคำสั่ง, หัวข้อการทดสอบ) ตรงกับของจริง
- โมดูลใหม่ใน `src/lib/` ถูกเขียนถึงในผังโครงสร้างของ README ทั้งสองภาษา
- ฟีเจอร์ใน README ไทยกับอังกฤษมีจำนวนเท่ากัน (ไม่แปลตกหล่น)
- ทุกหัวข้อฟีเจอร์ถูกลิงก์จากสารบัญ — เคยเกิดขึ้นแล้วว่าเขียนฟีเจอร์ไว้ครบแต่หาไม่เจอ

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

### เรื่องอื่นที่ทำเป็นปกติ / Other habits

- ภาพหน้าจอถ่ายจาก **production build** (`npm run build && npm run start`) ไม่ใช่ `next dev`
  เพราะ dev overlay จะติดมาในภาพ — และเก็บไว้ที่ `public/screenshots/` ที่เดียว ใช้ร่วมกันทั้ง
  landing page และ README
- ยืนยันฟีเจอร์ที่เห็นด้วยตาด้วย Playwright ชั่วคราว แล้ว **ลบสคริปต์กับ `npm uninstall playwright`
  ก่อน commit** — `package.json`/lockfile ต้องไม่มี diff
- พัฒนาบนบรานช์ `claude/excel-sheet-ui-builder-8ooz26` และ merge เข้า `main` เฉพาะตอนที่สั่งเท่านั้น

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
