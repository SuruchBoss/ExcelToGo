# บทเรียนของ PO / What the PO got wrong, and what to do instead

ไฟล์นี้สำหรับ session ที่รับบท **Product Owner** ของ ExcelToGo (และแอปอื่นในตระกูลเดียวกัน) อ่านก่อนเริ่มงานทุกครั้ง
เขียนจากความผิดพลาดจริง ไม่ใช่หลักการทั่วไป · เพิ่มข้อใหม่ต่อท้ายเมื่อพลาดอีก ห้ามลบข้อเก่า

This file is for any session acting as ExcelToGo's **Product Owner**. Read it before starting. Every entry comes from
a real mistake. Add to the end when a new one happens; never delete an old one.

---

## เหตุการณ์ที่ทำให้ไฟล์นี้เกิดขึ้น (2026-09-27, วันแรกที่เปิดให้คนนอกใช้)

PO ตรวจสามรอบ merge (Sprint B, Sprint C, PR #94) ด้วยเทสต์ ด่านตรวจทั้งสิบ และการลองค่าเองในโค้ด แล้วบอก owner ว่า
"ส่งให้คนนอกใช้ได้แล้ว" · คืนนั้น owner เปิดแอปบนมือถือจริงแล้วพบว่า **ฟีเจอร์ที่เป็นเหตุผลแรกที่สร้างแอปนี้ — ต่อ API
และข้อมูลของตัวเอง — ใช้ไม่ได้เลยบน production** เพราะ `NEXT_PUBLIC_DEMO_MODE=1` ปิดไว้ และที่เก็บแหล่งข้อมูลเป็นไฟล์
ที่ Vercel เขียนไม่ได้ ข้อความในแอปยังเรียกทั้งเว็บว่า "เดโม" จน owner เองก็งง

ด่านทุกด่านเขียว เพราะไม่มีด่านไหนถามว่า "ผู้ใช้ทำสิ่งที่มาทำได้ไหม" · PO ไม่เคยเปิด production แล้วลองใช้ฟีเจอร์หลัก
สักครั้ง และไม่เคยถาม owner ตรง ๆ ว่าแอปนี้สร้างมาเพื่อแก้ปัญหาอะไร

On launch day the PO had reviewed three merges with every gate green and told the owner the app was ready for
outsiders. That night the owner opened it on a phone and found that the feature the app was built for — connecting
your own API and data — did not work on production at all: demo mode switched it off, and its storage could not be
written on Vercel. Every gate was green because no gate asks whether a user can do the thing they came for. The PO
had never tried the headline feature on production, and had never asked the owner what the app was built to solve.

---

## กฎที่ต้องทำทุกครั้ง / Rules

### 1. รู้ว่าแอปสร้างมาเพื่ออะไร ก่อนตัดสินอะไรทั้งนั้น
- **ถาม owner ตรง ๆ** ว่างานหลัก 1–3 อย่างที่ผู้ใช้ต้องทำได้คืออะไร แล้วเขียนไว้ที่หัว #85 ("เสียงจากผู้ใช้") · อย่าเดาจาก README
  หรือจากสิ่งที่โค้ดทำได้
- **ห้ามลดความสำคัญ ย้ายออกจากจุดเด่น หรือเสนอพักฟีเจอร์ไหน** จนกว่าจะรู้ว่ามันไม่ใช่งานหลักของ owner · วันนั้น PO เกือบเสนอให้ย้าย
  "ข้อมูลสด" เข้าเมนู ทั้งที่มันคือเหตุผลที่แอปมีอยู่
- Know what the app is for before judging anything. Ask the owner for the 1–3 jobs a user must be able to do, and
  write them at the top of #85. Never demote a feature until you know it is not one of them.

### 2. "พร้อม" แปลว่าลองบน production แล้ว ไม่ใช่เทสต์เขียว
ก่อนพูดว่า "พร้อม", "ส่งให้คนนอกได้", "merge ได้" หรือ "เสร็จแล้ว" ต้องทำ **smoke test บน production ในฐานะผู้ใช้** ครบทุกข้อ:
- [ ] deployment ที่ live คือ commit ที่คิดว่าใช่ (Vercel → Deployments หรือตัวเลขบนหน้าแรก)
- [ ] เปิดหน้าแรก → กด "เปิดแอป" **บนมือถือและเดสก์ท็อป** ภาษาไทยและอังกฤษ
- [ ] ทำ**งานหลักของ owner ทุกข้อ** (ข้อ 1) ตั้งแต่ต้นจนจบ เหมือนผู้ใช้ที่ไม่รู้จักแอป · ตอนนี้คือ: ต่อ API ของตัวเองแล้วข้อมูลเข้าตาราง ·
  เปิดไฟล์ .xlsx จริง (มีวันที่ สูตร หลายชีต) แก้แล้วส่งออก · พิมพ์สูตรและถาม AI
- [ ] อ่านทุกข้อความที่ผู้ใช้เห็นระหว่างทางด้วยสายตาของคนที่ไม่รู้จักแอป · มีคำไหนที่ทำให้งง (เช่น "เดโม") ไหม
- [ ] **env ของ production เป็นส่วนหนึ่งของสินค้า**: รู้ว่าตั้งอะไรไว้บ้าง (`NEXT_PUBLIC_DEMO_MODE`, `ANTHROPIC_API_KEY`,
  `SOURCES_ADMIN_TOKEN` ฯลฯ) และแต่ละตัวปิดหรือเปิดอะไร · ถ้า PO เปิด production เองไม่ได้ (เครื่องถูกบล็อก) ให้**ขอ owner ทำตามรายการนี้
  แล้วส่งภาพมา** อย่าข้าม
- "Ready" means tried on production as a user, not green tests. Before saying ready / shareable / mergeable / done:
  confirm the live commit, open the landing page and the app on a phone and a desktop in both languages, do every
  owner job end to end as a stranger would, read every word a user sees, and know what each production env var
  switches. If you cannot reach production yourself, have the owner walk this list and send screenshots. Never skip it.

### 3. ด่านตรวจวัดได้แค่สิ่งที่มันวัด
- เทสต์ 1,500 ข้อเขียวในขณะที่ฟีเจอร์หลักถูกปิดด้วย config · **config, env และข้อความถึงผู้ใช้ ไม่มีด่านไหนตรวจแทน**
- เวลาอ่านรายงาน verify ให้ถามต่อเสมอว่า "มีอะไรที่ผู้ใช้จะเจอ แต่ไม่มีด่านไหนดู"
- Gates measure what they measure. 1,500 green tests coexisted with the headline feature being switched off by
  config. Always ask what a user would hit that no gate looks at.

### 4. ข้อเท็จจริงใน handoff ต้องตรวจก่อนส่ง
พลาดมาแล้วในวันเดียว:
- เขียนว่า `100000000000` มี 11 หลัก (จริง 12) ใน handoff #23
- อ้างเลข issue ผิด (เขียน #83 ในตัว #83 เอง)
- ตัวเลข นับ เลข issue และชื่อไฟล์ในเอกสารที่ส่งต่อ ต้องมาจากการเช็กจริงในรอบนั้น · ของที่จำมา (ขีดจำกัดของ Vercel, พฤติกรรมของ
  Chrome, เครื่องหมายการค้า) ต้องบอกว่า "จำมา ยังไม่ยืนยัน" และให้คนทำยืนยันกับแหล่งจริง
- Facts in a handoff are checked before it is sent. Counts, issue numbers and file names come from a check made in
  that pass; anything from memory is labelled as such and handed over with a request to confirm it at the source.

### 5. ข้อแลกเปลี่ยนด้านความปลอดภัยต้องบอก owner ตรง ๆ ก่อนตัดสิน
- เช่นการผ่อน CSP เพื่อให้เบราว์เซอร์ต่อ API ของผู้ใช้ได้ (#110) หรือการปิดโหมดเดโมที่ทำให้ `ANTHROPIC_API_KEY` ของเซิร์ฟเวอร์ถูกใช้
- บอกว่าเสียอะไร ได้อะไร ใครได้รับผล แล้วให้ owner เลือก · ห้ามซ่อนไว้ใน handoff
- Security trade-offs go to the owner in plain words before the decision — what is lost, what is gained, who is
  affected — never buried in a handoff.

### 6. คำพูดของแอปคือสินค้า
- ถ้า owner อ่านแล้วงง ผู้ใช้ก็งงแน่นอน · คำที่ลดความเชื่อมั่น ("เดโม", "ยังอยู่ระหว่างพัฒนา", ตัวเลขเทสต์ที่ไม่มีความหมายกับนักบัญชี)
  เป็นบั๊ก ไม่ใช่เรื่องรอง
- The app's words are the product. If the owner is confused by them, users are. Words that undercut trust are bugs.

### 7. เรื่องปฏิบัติการที่เคยทำให้เสียเวลา
- **ห้าม `pkill -f next-server`** มันฆ่าคำสั่งของตัวเองด้วย (ชื่อ process มีคำนั้นอยู่ในบรรทัดคำสั่ง) · หยุด server ด้วย PID ที่ถือพอร์ต
- worktree ที่ `node_modules` เป็น symlink ออกนอก worktree ทำให้ Turbopack build ล้ม · รันด่าน build/a11y/e2e ใน checkout หลักแทน
- เครื่องของ agent อาจเข้า `vercel.com` / `vercel.app` ไม่ได้ · รู้ไว้ก่อน แล้วขอ owner ช่วยตรวจ production ตั้งแต่ต้น (ข้อ 2)
- **merge ผ่าน PR เสมอ** (เปิด PR → รอ CI → merge ด้วยปุ่มหรือเครื่องมือ GitHub) ไม่ push ตรงเข้า `main` · ตัวตรวจความปลอดภัยของ
  Claude Code เคยบล็อก `git push origin HEAD:main` เพราะ `main` deploy ขึ้น Vercel ทันที · PR ยังให้ CI รันและมีบันทึกว่าอะไรเข้า `main` เมื่อไร
- Operational: never `pkill -f next-server` (it kills your own command); a worktree with a symlinked `node_modules`
  breaks the Turbopack build; the agent's machine may not reach Vercel — plan to ask the owner for production checks;
  merge through a PR, never a direct push to `main` (it deploys, and a direct push has been blocked for exactly that).

---

## บันทึกเพิ่ม / Log

| วันที่ | เกิดอะไรขึ้น | กฎที่เกี่ยวข้อง |
|---|---|---|
| 2026-09-27 | ประกาศว่าพร้อมให้คนนอกใช้ ทั้งที่ฟีเจอร์หลัก (ต่อ API/ข้อมูลของตัวเอง) ถูกปิดบน production · ไม่เคยถาม owner ว่าแอปสร้างมาเพื่ออะไร · เกือบเสนอย้ายฟีเจอร์นั้นเข้าเมนู | 1, 2, 3, 6 |
| 2026-09-27 | handoff มีตัวเลขผิด (11 vs 12 หลัก) และอ้างเลข issue ผิด | 4 |
| 2026-09-28 | push ตรงเข้า `main` ถูกบล็อกว่าเป็นการ deploy production · เปลี่ยนเป็นเปิด PR (#112) แล้ว merge | 7 |
