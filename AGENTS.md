# ExcelToGo — กติกาของโปรเจกต์นี้ / House rules

## ก่อน push ทุกครั้ง: เช็กและอัปเดต README เสมอ
## Before every push: check and update the README

รันคำสั่งเดียวจบ — ต้องเขียวทั้งหมดก่อน commit:
Run one command and get it green before committing:

```bash
npm run verify       # lint → check:readme → check:screens → check:deps → test → check:mutants
                     #   → build → check:bundle → check:a11y → check:e2e          (~5 นาที)
npm run verify:quick # ด่านเดียวกัน ตัดสี่ด่านที่ช้าออก — 37 วินาที                   (ระหว่างเขียน)
node scripts/license-headers.mjs  # หัวไฟล์ลิขสิทธิ์/SPDX ครบไหม · every source file has its header
```

`verify:quick` มีไว้สำหรับลูประหว่างแก้โค้ด ไม่ใช่ตัวแทนของ `verify` ตอน push — มันตัด `check:mutants`,
`check:a11y`, `check:e2e` และ `check:deps` ออก ซึ่งสี่ด่านนั้นกิน **90% ของเวลา** และเป็นสี่ด่านที่จับบั๊กที่เหลือ
ทั้งหมดของโปรเจกต์นี้ · ก่อน push ยังต้องเขียวจาก `npm run verify` เต็ม ไม่มีข้อยกเว้น
`verify:quick` is for the edit loop, not a stand-in for `verify` before a push: it drops
`check:mutants`, `check:a11y`, `check:e2e` and `check:deps`, which are **90% of the time** and also
the four gates that have caught every remaining bug in this project. The full one still has to be
green before pushing.

GitHub Actions รันสิบด่านเดียวกันนี้ทุก push และทุก PR (`.github/workflows/ci.yml`, Node 22.12 / 24;
ด่าน a11y กับ e2e แยกเป็น job ของตัวเองเพราะต้องใช้เบราว์เซอร์ และ **a11y ยังแยกอีกเป็นสอง job ตามความกว้าง**
เพราะมันเคยเป็น job ที่ยาวที่สุด ทั้ง run จึงรอมันอยู่ job เดียว — `A11Y_WIDTH=390` หรือ `1280` เลือกครึ่งเดียว
ถ้าไม่ตั้งจะรันทั้งหมด ซึ่งเป็นสิ่งที่คนรันมือควรได้) — รันเองก่อนยังคงเร็วกว่ารอ CI บอกว่าพัง
GitHub Actions runs the same ten gates on every push and PR (Node 22.12 / 24; the a11y and e2e gates
are jobs of their own because they need a browser, and **a11y is two jobs split by width** because it was the
longest one and so the only thing the run waited on — `A11Y_WIDTH=390` or `1280` picks a half, unset runs
everything, which is what someone running it by hand should get) — running them yourself
first is still faster than waiting for CI to tell you.

`npm run check:a11y` รัน axe บนทั้งสองหน้า ที่ **390px และ 1280px** (WCAG 2.0/2.1/2.2 A+AA) แล้วเช็ก
ว่าไม่มีการเลื่อนแนวนอนที่ 360/390/820/1280/1440 — สองความกว้างเพราะเคยพลาดมาแล้ว: audit ที่รัน
เฉพาะความกว้างเดสก์ท็อปรายงาน 0 violations ทั้งที่ต่ำกว่า 640px มีปุ่มไม่มีชื่อ 8 ปุ่ม (ข้อความถูกซ่อนด้วย `sm:`)
`npm run check:a11y` runs axe on both pages at **390px and 1280px** (WCAG 2.0/2.1/2.2 A+AA), then checks
for sideways scroll at 360/390/820/1280/1440. Two widths because one was not enough: an audit run only at
desktop width reported zero violations while eight buttons below 640px had no accessible name at all.

ด่านนี้ยัง **เปิดพาเนลขึ้นมาตรวจด้วย** ไม่ใช่สแกนแค่หน้าตอนโหลด — พาเลตสูตร, AI, ข้อมูลสด, conditional
formatting, กราฟ, pivot, ค้นหา/แทนที่, จำกัดค่า, ชื่อช่วง, คอมเมนต์, หน้าคีย์ลัด, แถบเตือนตอนบันทึกไม่ลง ช่องสีพื้น หน้าต่างถามตอนเปิดไฟล์ทับงาน หน้าต่างถามก่อนเริ่มไฟล์ใหม่ หน้าต่างถามก่อนเรียงที่สูตรจะผิด รายงานสิ่งที่ไฟล์เก็บไว้ไม่ได้ หน้าต่างถามก่อนวางทับแถวที่ตัวกรองซ่อน ช่องแก้ชื่อชีตที่บอกว่าชื่อผิดกติกา Excel หน้าต่างถามของแท็บที่สองบนงานเดียวกันกับแถบของแท็บที่ดูอย่างเดียว การ์ดคำตอบของผู้ช่วย AI ทั้งแบบมีสูตรและแบบชี้ไปฟอร์ม แถบของแท็บที่แก้ต่อเพราะอีกแท็บปิด หน้ากู้งานหลังแอปพัง หน้าต่างแปลงเป็นวันที่ แถบของข้อมูลตัวอย่างหลังกดเปิด เมนูคลิกขวาที่เซลล์ การ์ดปัญหาบนหน้า landing ที่กางออก สองหน้าต่างของข้อมูลสด (เลือกข้อมูล · เพิ่มแหล่งข้อมูล) ฟอร์มต่อ API จากเบราว์เซอร์กับรายการตรวจสำหรับ IT ที่ขึ้นตอนต่อไม่ติด และห้าอย่างที่มีเฉพาะบนมือถือ (เมนู · เครื่องมือเซลล์ · แถบปุ่มตอนพิมพ์สูตร · แถบเลือกช่วงตอนกด ⌖ · ป้าย "แตะอีกครั้งเพื่อพิมพ์" หลังแตะครั้งเดียว สแกนเฉพาะที่ 390px ด้วยจอสัมผัส) กล่องจากสถานะบันทึก ข้อความลอยหลังเปิดไฟล์ และสองขนาดจอเตี้ย (มือถือแนวนอน 844×390 · ซูม 200% 195×422 ซึ่งตกด่านถ้าหน้าเลื่อนข้างได้) บนหน้า `/`, `/app`, `/guide`, หน้า 404 และหน้าสูตร (`/formulas` กับ `/formulas/sumif`) รวม 119 checks **เพิ่มพาเนลใหม่เมื่อไร เติมใน
`OPENED_STATES` เมื่อนั้น** และสถานะที่เปิดไม่ขึ้นถือว่าด่านตก ไม่ใช่ข้าม
The gate also **opens panels before scanning them** rather than only scanning the page as it loads — the
formula palette, AI, live data, conditional formatting, charts, pivots, find/replace and the shortcut
dialog, the validation, names and comment popovers, the alert shown when a save is refused, the fill swatches, the dialog asked when a file would open on top of work, the one asked before New file, the one asked before a sort that would get a formula wrong, the report of what an opened file cannot keep, a sheet-name editor saying why Excel would refuse the name, the one asked before a paste over rows a filter hides, the one a second tab on the same workbook asks and the notice on a tab that is only looking, the AI assistant's answer card and the one that declines and points at a form, the notice on a tab that edits again because the other closed, the rescue screen after a crash, the Convert to dates dialog, the sample's notice once it is opened, the cell menu, a landing problem card unfolded, the two live-data dialogs (the picker and adding a source), the connect-from-this-browser form and the checklist for IT it shows when a connection fails, and five things only a phone shows (the menu, cell tools, the keys bar while a formula is typed, the picking bar after ⌖ and the "tap again to type" label after one tap, scanned at 390px only with a touch screen), the save status's popover, the toast after a file opens, and two short screens (a phone on its side at 844×390, and 200% zoom at 195×422, which also fails on sideways scroll), across `/`, `/app`, `/guide`, the 404 page and the formula pages (`/formulas` and `/formulas/sumif`) — 119 checks in all. **A new panel means a new entry in `OPENED_STATES`**, and a state that will not
open fails the gate rather than being skipped.

`npm run check:e2e` ขับแอปจริงในเบราว์เซอร์ 55 flow — เปิดแผงถาม AI แล้วสิ่งที่พิมพ์ลงช่องคำถามไม่ลงเซลล์ที่ถูกบัง และ Esc ปิดแผงแล้ว focus กลับเซลล์เดิม, บนมือถือพิมพ์หลัง Enter ลงเซลล์ที่มีค่าแล้วแทนที่ค่าเดิม ไม่ต่อท้าย และแตะซ้ำยังแก้ต่อท้ายได้, พิมพ์ C02 ลงช่อง dropdown แล้วได้ C02 ไม่ใช่ตัวแรกที่ขึ้นต้นด้วย C ค่านอกรายการถูกปฏิเสธและบอกเหตุผล และเลือกจากรายการยังบันทึกได้ ทั้งที่ 1280 และ 390, เปิดไฟล์จริงที่มีรูป กราฟ และฟังก์ชันที่เอนจินไม่มีแล้วแอปบอกก่อนว่าจะหาย ปิดแล้วเปิดดูจากเมนูได้ ไฟล์ธรรมดาไม่เห็นอะไร และชื่อช่วงที่นำเข้าไม่ได้อยู่ในรายงานเดียวกัน ไม่ใช่ alert แยก, แหล่งข้อมูลสดที่ตอบหลังหน้าต่างเลือกข้อมูลเปิดไม่ทำให้เซลล์กลายเป็นช่องว่าง, หน้าสูตรกด "ลองในตาราง" แล้วค่าในเซลล์ตรงกับบนหน้า ชื่อบทเรียนหายจาก URL และบนงานที่มีอยู่ถามก่อนโดยตัวเลือกที่ focus เก็บงานไว้, งานเก่าที่ชื่อชีตซ้ำหรือผิดกติกา Excel เปิดมาแล้วชื่อถูกและสูตรชี้แท็บที่ถูก ตั้งชื่อผิดกติกาแล้วถูกปฏิเสธตรงที่พิมพ์ และส่งออกได้ไฟล์ที่ชื่อชีตกับสูตรถูกต้อง, ปิดแท็บที่แก้อยู่แล้วแท็บที่ดูอยู่แก้ต่อได้เองพร้อมงานครบ, แอปพังแล้วหน้ากู้งานขึ้น ไฟล์ที่โหลดมีงานครบ และลองอีกครั้งกลับมาที่ตารางเดิม, วันที่ พ.ศ. นับได้จริงและคำสั่งแปลงเป็นวันที่จากเมนูคลิกขวาแสดงตัวอย่างและ undo ครั้งเดียวกลับ, ผู้ช่วย AI ใส่ยอดรวมใต้คอลัมน์ไม่ทับสูตรเดิม และคำถามที่มีเงื่อนไขชี้ไปฟอร์ม SUMIF, ลากเลือกช่วงบนมือถือไม่เลยคอลัมน์และแตะระหว่างพิมพ์ `=` ไม่บันทึกทับ, แตะครั้งเดียวบนมือถือแค่เลือก ไม่มีคีย์บอร์ดค้าง เซลล์บอก "แตะอีกครั้งเพื่อพิมพ์" และสิ่งที่พิมพ์ไม่หายเงียบ, Enter หรือ ↓ ที่แถวสุดท้ายเพิ่มแถวโดยไม่มีค่าไหนถูกทับและ undo ครั้งเดียวเอาค่ากับแถวออกแล้วพิมพ์ต่อได้, บนมือถือ undo ตอนช่องแก้ไขเปิดอยู่บนแถวที่ Enter งอกขึ้นมาแล้วช่องปิด บอกว่าทิ้งข้อความที่พิมพ์ค้าง และค่าถัดไปพิมพ์ลงได้, แท็บที่สองบนงานเดียวกันถามก่อน ขอใช้แล้วแท็บเดิมดูอย่างเดียวและไม่มีงานหาย, วันที่ในคอลัมน์กว้างค่าตั้งต้นของ Excel ขึ้นเป็นวันที่ไม่ใช่ `###` ทั้งที่ 1280 และ 390, ชีตชื่อไทยดาวน์โหลดเป็นไฟล์ชื่อไทย, เรียงชีตตัวอย่างแล้วทุกแถวยังคูณของตัวเองและการเรียงที่สูตรจะผิดถามก่อน, กรองแล้วกด Delete บนช่วงที่เห็นแถวที่ซ่อนไม่หาย และวางทับแถวที่ซ่อนแล้วถามก่อน, เปอร์เซ็นต์ที่บันทึกไว้ก่อน #53 ยังขึ้นเหมือนเดิมหลัง migrate, เปิดมาเป็นตารางว่างและข้อมูลตัวอย่างที่ค้างในเบราว์เซอร์ไม่กลับมา (แต่ถ้าแก้แล้วต้องอยู่) ไฟล์ใหม่ถามก่อนและ Ctrl+Z เอางานคืน, พิมพ์สูตรแล้วดูค่าขยับ, ส่งออก `.xlsx` แล้วนำกลับเข้ามา, เปิดไฟล์ทับงานแล้วแอปถามก่อน (ตัวเลือกที่ focus อยู่ต้องเก็บงานไว้ และ undo ถอนไฟล์ออกได้) พร้อม `Ctrl+B`, Tab ตามแถวแล้ว Enter กลับคอลัมน์แรก กับเมนูเซลล์จาก `Shift+F10`, ลากคอลัมน์ให้กว้างแล้ว undo ครั้งเดียวกลับ, Enter บนมือถือเข้าช่องถัดไปโดยคีย์บอร์ดไม่พับ,
เดินด้วยคีย์บอร์ดล้วน, วางตัวเลขจาก clipboard แบบที่ Excel ก๊อปออกมา (`1,250` `15%` `฿1,234.50`) แล้ว SUM ถูกและรหัสยังเป็นข้อความ, undo, แก้ต่อหลัง undo การเพิ่มชีต, ตัดข้ามชีต, แถบสูตรไม่เขียนค่าค้าง, "เปลี่ยนอะไรไกลจากเคอร์เซอร์แล้วพูดออกมาไหม", ผู้ช่วย AI (stub route ไว้
ทั้งกรณีตอบปกติและกรณีโดน rate limit) CSP (header มาจริง, ยิงออกนอก policy ไม่ได้, แอปเองไม่สะดุด) บันทึกไม่ลงแล้วแอปบอกและยังส่งออกได้, ต่อ API จากเบราว์เซอร์แล้วค่าลงตารางและรีเฟรชเอง โดยไม่มีอะไรเกี่ยวกับมันถึง `/api/*` (และ CSP ของคนที่ไม่เคยเพิ่มแหล่งยังเหมือนเดิมทุกตัวอักษร · แท็บใหม่ที่ไม่มีค่า header ขึ้นว่ารอค่า ไม่ใช่เชื่อมต่อไม่ได้), API ที่ไม่ตอบ CORS ได้รายการตรวจสำหรับ IT ไม่ใช่ error เปล่า, ไม่มีหน้าไหนเรียกตัวเองว่าเดโมทั้งสองภาษา, ทุกหน้าใน sitemap ประกาศ canonical ของตัวเองและหน้าแรกมี JSON-LD ที่ถือ nonce โดยคำถามที่พบบ่อยใน JSON-LD ตรงกับบนหน้าคำต่อคำ และที่ 390px ทางไปข้อมูลสดอยู่บนจอและมีชื่อ บนมือถือการแตะระหว่างพิมพ์ `=` ไม่บันทึกสูตรครึ่งเดียว แต่ใส่ที่อยู่เซลล์ลงสูตร ลากขยายเป็นช่วงได้ และ ⌖ เลือกช่วงจากตารางได้ หลังเปิดไฟล์บนมือถือข้อความขึ้นทีละอัน ตารางเหลือ 12 แถวขึ้นไปและปัดข้างได้ มือถือแนวนอนเห็นตาราง 6 แถวขึ้นไปและกดค้างเปิดเมนูเซลล์ และค่าข้ามชีตบนจอยังถูกหลังส่งออก PDF, sort และ undo เกณฑ์เลือก flow มีข้อเดียว:
**unit test จับได้อยู่แล้วหรือเปล่า** ถ้าจับได้ ไม่ต้องอยู่ที่นี่ ที่เหลือคือรอยต่อ ซึ่งเป็นที่ที่บั๊กของโปรเจกต์นี้อยู่ทุกตัว
`npm run check:e2e` drives the real app in a browser through 55 flows — opening Ask AI putting what is typed in the question box rather than in the cell it covers, with Escape closing it back to that cell, on a phone, typing after Enter into a filled cell replacing its value rather than going on the end, with a second tap still editing in place, C02 typed into a dropdown cell saving C02 rather than the first option starting with C, text off the list refused out loud and a pick from the list still saving, at 1280 and 390, a real file with a picture, a chart and a function the engine lacks saying what it will lose as it opens, reopened from the menu, with nothing for a plain file, and range names that could not come in listed in the same report rather than a separate alert, a live source answering after the picker opens never blanking the cell, a formula page's "try it in the sheet" landing the page's own numbers in the sheet, leaving the address clean and, over work, asking first with keeping the work focused, an old save with duplicate or invalid sheet names opening with names Excel takes and formulas on the right tab, a bad name refused where it is typed, and an export whose sheet names and formulas are right, a view-only tab editing by itself with all the work once the editing tab closes, a crash that brings up the rescue screen, whose file holds the work and whose Try again comes back to the sheet, a Buddhist-Era date that counts and Convert to dates from the cell menu, previewed and undone in one step, the AI assistant putting a column's total under it rather than over a formula and sending a condition to the SUMIF form, a range dragged on a phone staying in its column and a tap during `=` saving nothing, one tap on a phone only selecting, with no keyboard left up, the cell saying "tap again to type" and nothing typed lost in silence, Enter or ↓ on the last row adding a row with nothing typed over and one undo taking the value and its row back with typing still landing after it, on a phone an undo with an editor open on a row Enter grew closing the editor, saying what it dropped, and the next value landing, a second tab on the same workbook asking first, with taking over turning the first view-only and no edit lost, dates in Excel's default column width showing as dates, not `###`, at 1280 and 390, a Thai sheet name downloading as a Thai file name, the sample sorted with every row still its own and a risky sort asking first, Delete on a filtered range leaving the hidden rows alone and a paste over them asking first, a percent saved before #53 still reading the same after the migration, opening blank, with a sample an older version saved not coming back (and one edited, staying), New file asking first and Ctrl+Z bringing the work back, type a formula and watch the value
move, export `.xlsx` and import it back, a file opened on top of work that asks first (the focused choice keeps the work, and undo takes the file back out) along with `Ctrl+B`, a row typed with Tab ending with Enter under its first column and the cell menu from `Shift+F10`, a column dragged wider that one undo puts back, Enter on a phone going into the next cell's editor, keyboard only, numbers pasted through the real clipboard as Excel copies them (`1,250` `15%` `฿1,234.50`) adding up while codes stay text, undo, editing after undoing a new sheet, a cut across sheets, a formula bar that never writes a stale value, whether a change away from the cursor is
announced, the AI assistant with its route stubbed (both a normal answer and a rate limit), and the CSP
(served, blocking exfiltration, and not tripping the app up), a refused save that is announced while export still works, an API connected from this browser that fills the sheet and refreshes with nothing about it reaching `/api/*` (and the CSP unchanged, character for character, for anyone who never added a source; a new tab without the header value says it is waiting, not failing), an API without CORS getting a checklist for IT rather than a bare error, no page calling itself a demo in either language, every page in the sitemap declaring its own canonical with the landing page's JSON-LD carrying the nonce and its FAQ matching the page word for word, at 390px whether the way to live data is on screen and named, on a phone a tap during `=` putting the cell into the formula (widened by a drag) rather than saving half of it, and ⌖ picking a range from the grid, a file opened on a phone leaving one message at a time with twelve rows and a working sideways swipe, a phone on its side keeping six rows with a long press opening the cell menu, and cross-sheet values still right on screen after a PDF export, a sort and its undo. Flows are picked by one rule: **would a unit test already catch it?** If yes it does not belong
there. What is left is the seams, which is where every bug in this project has actually lived.

`npm run check:deps` ไม่ได้แค่รัน `npm audit` — ทุก advisory ต้อง**ถูกแก้ หรือถูกเขียนไว้พร้อมเหตุผลและวันหมดอายุ**
ตัวที่ไม่มีใครเขียนถึงทำให้ด่านตก และ**entry ที่เลยวันรีวิวก็ทำให้ตกเหมือนกัน** · dependency ที่ตั้งใจพักไว้ (`HELD`: exceljs, TypeScript 7, ESLint 10) ก็เขียนแบบเดียวกัน พร้อมเงื่อนไขที่จะเปลี่ยนใจ เพราะความเสี่ยงที่ยอมรับไว้โดยไม่มีวันหมดอายุ
ไม่ใช่การตัดสินใจ มันคือความเคยชิน · ถ้าต่อ registry ไม่ได้ ด่านจะบอกว่าไม่ได้ตรวจ ไม่ใช่แดงมั่ว
`npm run check:bundle` มีงบขนาดเขียนไว้ และเช็กด้วยว่าไลบรารี Supabase ยัง**อยู่ chunk ของตัวเองแยกต่างหาก**
ส่วนคำถามว่ามีใคร*ขอ*โหลด chunk นั้นจริงไหม อยู่ใน `check:e2e` เพราะต้องใช้เบราว์เซอร์ตอบ
`npm run check:deps` is not just `npm audit`: every advisory must be **fixed, or written down with a reason
and a review date**. One nobody has written about fails the gate, and **an entry past its date fails too** —
an accepted risk with no expiry is not a decision, it is a habit. Dependencies held on purpose (`HELD`: exceljs,
TypeScript 7, ESLint 10) are written down the same way, each with what would change the answer, and fail
past their date even offline. With no registry it says it checked nothing rather than going red.
`npm run check:bundle` carries written size budgets and checks that the Supabase client is still **in a chunk
of its own**. Whether anything ever *asks* for that chunk is a `check:e2e` flow, because only a browser can
answer it.

**เบราว์เซอร์ของทุกด่านเปิดด้วย `env: browserEnv()`** (`scripts/browserEnv.mjs`) — ใต้ locale POSIX (container, CI, เครื่อง QA)
Chromium ตั้งชื่อไฟล์ดาวน์โหลดที่เป็นภาษาไทยไม่ได้ ไฟล์ `ยอดขาย.csv` จึงออกมาเป็น `download` แล้วด่านรายงานบั๊กที่ไม่มีอยู่จริง
(QA รอบ 2 เปิดไปหนึ่งใบ) · สคริปต์ใหม่ที่เปิดเบราว์เซอร์ต้องใส่ด้วย และ e2e มี flow ที่แดงถ้าลืม
Every gate launches Chromium with `env: browserEnv()`: under a POSIX locale it cannot name a download in Thai, so
`ยอดขาย.csv` arrives as `download` and the gate reports a bug that is not there (QA's round 2 filed one). A new
script that opens a browser needs it too; an e2e flow goes red without it.

**เทสต์ที่วัดเวลาให้เขียนเป็นอัตราส่วน ไม่ใช่มิลลิวินาที** — `expect(top).toBeLessThan(5000)` ทำ CI แดงสามรอบติด
คนละเวอร์ชัน Node ทุกรอบ เพราะค่าจริง 1,412ms บนเครื่องพัฒนาไปชนเพดานบน runner ที่แชร์ CPU · เขียนเทียบกับ
ค่าที่วัดในโปรเซสเดียวกันแทน (`toBeLessThan(cold * 3)`, `toBeLessThan(cold / 10)`) แล้วเครื่องช้าจะถ่วงทั้งสองฝั่ง
พร้อมกัน สิ่งที่ assert จึงเป็นรูปร่างของเอนจิน ไม่ใช่อารมณ์ของ runner · ส่วนตัวเลขมิลลิวินาทียัง `console.log` ไว้
เพราะเลขใน README มาจากบรรทัดนั้น — **บันทึกไว้ ไม่ได้เอาไว้ป้องกัน**
A test that measures time asserts a **ratio**, never milliseconds. `expect(top).toBeLessThan(5000)` turned CI red
three runs running, on a different Node version each time, because 1,412ms on a dev box meets that ceiling on a
runner that shares its CPU. Compare against something measured in the same process instead — a slow machine
slows both halves together, so what is asserted is the shape of the engine rather than the mood of the runner.
The milliseconds stay in a `console.log`, because the README's numbers come from there: recorded, not defended.

`npm run check:mutants` ทุบเอนจินทีละจุด (32 mutant, seed คงที่) แล้วถามว่าเทสต์แดงไหม — **"1,088 เทสต์"
บอกว่ามีกี่ข้อ ไม่ได้บอกว่ามันจับบั๊กได้** ตัวที่รอดคือช่องโหว่จริง รอบแรกเจอหก แล้วเขียนเทสต์ใหม่หกข้อจากมัน
seed ถูกปักไว้เพื่อไม่ให้ด่านแดงเพราะดวง อยากหาช่องใหม่ให้รัน `SEED=13 MUTANTS=60 npm run check:mutants` เอง
ไม่ได้ลงไลบรารีเพิ่ม เขียนเองเหมือน PRNG ของ property test · ตัวที่รอดเพราะเป็น **equivalent** (เปลี่ยนโค้ดแต่ไม่เปลี่ยนผล)
ให้เขียน `// equivalent-mutant: "<" → "<=" — เหตุผล` ไว้บรรทัดเหนือโค้ด ห้ามลดเพดานหรือเปลี่ยน seed เพื่อให้ด่านเขียว
**ตัวที่รอดแต่ไม่ใช่ equivalent คือเทสต์ที่ขาด ไม่ใช่ที่ให้ติดมาร์กเกอร์**
`npm run check:mutants` breaks the engine one edit at a time (32 mutants, one pinned seed) and asks whether
the suite goes red. **"1,088 tests" says how many exist, not whether they would notice a bug.** A survivor is
a real gap: the first run left six alive and six tests were written from them. The seed is pinned so a red
cross means this commit rather than this draw; go looking for new gaps on purpose with
`SEED=13 MUTANTS=60 npm run check:mutants`. No new dependency — hand-written, like the property tests' PRNG.
A survivor that is **equivalent** (the code changes, the result cannot) gets
`// equivalent-mutant: "<" → "<=" — reason` on the line above it, never a lower floor or a new seed.
**A survivor that is not equivalent is a missing test, not a place for a marker.**

`npm run check:readme` (ไม่มี dependency เพิ่ม) จับสิ่งที่ตาคนมักพลาด:
`npm run check:readme` is dependency-free and catches what the eye misses:

- ลิงก์ `#anchor` ภายใน README ชี้ไปหัวข้อที่มีจริงไหม (รองรับสระ/วรรณยุกต์ไทย)
- ภาพที่อ้างถึงมีอยู่จริง และไม่มีภาพกำพร้าใน `public/screenshots/`
- จำนวนเทสต์ที่เขียนไว้ (badge, TL;DR, ตารางคำสั่ง, หัวข้อการทดสอบ) ตรงกับของจริง
- โมดูลใหม่ใน `src/lib/` และ `src/store/` ถูกเขียนถึงในผังโครงสร้างของ README ทั้งสองภาษา
  (เดิมคุมแค่ `src/lib/` — `cloudStore` กับ `liveStore` จึงหายจากผังได้โดยด่านเขียว)
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
- **README แต่ละภาษาใช้ภาพชุดภาษาของตัวเอง** — `README.md` ใช้ `public/screenshots/` · `README.en.md` ใช้
  `public/screenshots/en/` · ทั้งสองชุดต้องมีไฟล์ครบเท่ากัน และขนาดภาพที่หน้า landing ประกาศไว้ต้องตรงกับไฟล์จริง
  (เคยปล่อยให้ README อังกฤษโชว์แอปภาษาไทย 43 จาก 44 ภาพ โดยทุกด่านผ่าน เพราะด่านถามแค่ว่าไฟล์มีอยู่ไหม)
  Each README shows its own language's set — `public/screenshots/` for Thai, `public/screenshots/en/` for
  English — both sets hold the same files, and the sizes the landing page declares match the files. The
  English README once showed the Thai app in 43 of its 44 pictures with every gate green.
- ตัวเลขที่เป็น *เรื่องเล่า* ไม่ใช่การเคลม (เช่น "ภาพที่เขียนว่า 519 เทสต์ รอดมาได้หลายวัน") ให้ใส่
  `<!-- historic -->` ไว้**บรรทัดเดียวกับตัวเลข** ด่านจะข้ามให้ · มาร์กเกอร์ตั้งใจให้ดูเกะกะ เพราะการเอาไป
  ปิดเลขที่ค้างจริง ๆ ควรเป็นสิ่งที่ต้องตั้งใจทำ
  A number that is *a story* rather than a claim ("an image reading 519 tests survived for days") takes
  `<!-- historic -->` **on the same line as the number**. The marker is deliberately ugly: using it to
  silence a genuinely stale figure should be an obvious thing to be doing on purpose.

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
- **ภาพหน้าจอก็เคลมตัวเลขได้** — ตอนนี้มี `npm run check:screens` คอยจับแล้ว: ภาพแต่ละไฟล์ประกาศไว้ว่า
  *พิมพ์ตัวเลขอะไรไว้บ้าง* และ `screenshots.json` เก็บค่าตอนถ่ายครั้งล่าสุด พอตัวเลขในซอร์สขยับแล้วภาพยังไม่ถูกถ่ายใหม่
  ด่านจะเรียกชื่อไฟล์นั้นออกมา **ไฟล์ใหม่ในโฟลเดอร์ต้องมีรายการใน `SHOWS` เสมอ** — `[]` คือการตัดสินใจ
  ไม่มีรายการคือการลืม · ถ่ายใหม่แล้วรัน `npm run check:screens -- --bless` · **bless ทั้งที่ยังไม่ถ่ายใหม่
  คือวิธีเดียวที่จะทำให้ด่านนี้ไร้ค่า**
  A screenshot makes claims too, and `npm run check:screens` now watches them: each image declares which
  counted figures it prints, `screenshots.json` records what they were when it was taken, and a count that
  moves without a retake is named. **A new file in the folder needs an entry in `SHOWS`** — `[]` is a
  decision, a missing entry is an oversight. Retake, then `npm run check:screens -- --bless`. **Blessing
  without retaking is the one way to make this gate worthless.**
- **เดิมทีข้อนี้เขียนว่าไม่มีด่านไหนอ่านภาพออก** — `check:readme` นับเทสต์จาก *ข้อความ* ภาพ
  landing page ที่เขียนว่า "519 เทสต์" จึงผ่านทุกด่านอยู่หลายวันทั้งที่จริงเป็น 577 เปลี่ยน UI หรือตัวเลขที่
  โชว์อยู่ในภาพเมื่อไร ต้องถ่ายใหม่เมื่อนั้น
  The gate above exists because of it, and it still only watches *figures*. Change the UI itself — a
  layout, a label, a colour — and no gate can tell; that one is still on you to retake.

### เรื่องอื่นที่ทำเป็นปกติ / Other habits

- **ภาพหน้าจอถ่ายด้วย `npm run screenshots -- --lang all`** — สคริปต์ build production เอง (ไม่ใช่ `next dev`
  ที่มี dev overlay ติดมา) แล้วเล่นทุกฉากทั้งสองภาษา: ไทยลง `public/screenshots/` อังกฤษลง `public/screenshots/en/`
  ใช้ร่วมกันทั้ง landing page และ README · **ภาพใหม่ = ฉากใหม่ใน `SCENES` ของ `scripts/screenshots.mjs`**
  ไม่ใช่สคริปต์ชั่วคราวที่ถ่ายภาษาเดียว — เพราะนั่นคือทางที่ทำให้สองชุดไม่เท่ากันมาแล้ว · ฉากต้องขับแอปจริงเหมือนคน
  ห้ามพิมพ์ผลลัพธ์ใส่เอง (คำตอบ AI ไม่มี key ก็ถ่ายคำตอบของ keyword matcher ที่แอปบอกเองว่าเป็นการเดา)
  Screenshots come from `npm run screenshots -- --lang all`: it builds for production itself and plays every
  scene in both languages. **A new picture is a new scene in `SCENES`**, never a one-language throwaway
  script — that is how the two sets drifted apart. A scene drives the real app; nothing on screen is typed
  in to look like a result.
- ยืนยันฟีเจอร์ที่เห็นด้วยตาด้วย Playwright แล้ว **ลบสคริปต์ชั่วคราวก่อน commit** — `package.json`/lockfile
  ต้องไม่มี diff **แต่ playwright กับ `@axe-core/playwright` เป็น devDependency จริงแล้ว** (ด่าน `check:a11y`)
  จึงห้าม `npm uninstall` สองตัวนี้ ส่วนเครื่องมือชั่วคราวอย่างอื่น (pdfjs-dist, openpyxl ฯลฯ) ยังต้องถอนเหมือนเดิม
- **ไฟล์ซอร์สใหม่ทุกไฟล์ต้องขึ้นต้นด้วยหัวลิขสิทธิ์** (`// Copyright 2026 Suruch Chakrapeesirisuk` +
  `// SPDX-License-Identifier: Apache-2.0`) — `node scripts/license-headers.mjs --fix` เติมให้ และ job
  "License headers" ใน CI จะแดงถ้าขาด · migration ใน `supabase/migrations/` ได้รับยกเว้น
  Every new source file starts with that copyright and SPDX header; `node scripts/license-headers.mjs --fix`
  adds it, and CI's "License headers" job fails without it. Applied migrations in `supabase/migrations/` are exempt.
- พัฒนาบนบรานช์ของ session ตัวเอง (`claude/<ชื่อที่ session ได้รับ>`) แล้วเปิด PR จากบรานช์นั้น — ไม่ push ตรงเข้า `main` ·
  บรานช์ประจำเดิม (`claude/excel-sheet-ui-builder-8ooz26`, `claude/friendly-hypatia-51gs8l`) ไม่บังคับแล้ว owner ตัดสินเมื่อ 2026-10-02 ·
  ถ้างานเริ่มบนบรานช์อื่นแล้วย้ายมา ให้เขียนไว้ในเนื้อ PR ว่าย้ายมาจากบรานช์ไหน
  Work on your own session's branch (`claude/<name the session was given>`) and open the PR from it — never push to
  `main`. The old fixed branches are no longer required (owner, 2026-10-02); if the work started on another branch,
  say which one in the PR body.

### การ merge เข้า main: Dev เปิด PR → PO ตรวจ → PO merge / Merging into main: PR, PO review, PO merges

**ทุก session (Dev, Dev UX, QA, PO) ทำตามลำดับนี้ ไม่มีข้อยกเว้น** — owner ตัดสินเมื่อ 2026-09-28 · ปรับข้อ 3 เมื่อ 2026-09-29
Every session — Dev, Dev UX, QA and PO alike — follows this order, with no exceptions. The owner decided it on 2026-09-28
and changed step 3 on 2026-09-29.

1. **Dev เปิด PR** จากบรานช์ของตัวเองไป `main` · merge `origin/main` เข้าบรานช์ก่อนเปิด (merge ไม่ rebase) ให้ PR ไม่ conflict ·
   `npm run verify` เขียวบนผลรวม · แล้วแจ้ง PO — **ห้ามกดปุ่ม merge เอง แม้ CI เขียวและ PR ไม่ conflict**
   The developer opens a PR from their own branch, merges `origin/main` into it first so it has no conflict, gets
   `npm run verify` green on the result, and tells the PO. **Never press merge yourself**, even with green CI and no conflict.
2. **PO ตรวจ**: รัน verify เอง ลองแบบผู้ใช้บน production build (`docs/PO_LESSONS.md` ข้อ 2) แล้วรายงาน owner ว่าผ่านหรือไม่
   The PO reviews: runs verify, tries the change as a user on a production build, and reports to the owner.
3. **PO merge เองเมื่อตรวจผ่าน** ผ่าน PR (merge commit, ไม่ squash) โดยใส่ `expectedHeadSha` เป็น commit ที่ตรวจจริง ·
   แล้วรายงาน owner ว่า merge อะไรไป · ไม่มีใคร push ตรงเข้า `main`
   The PO merges once the review passes, through the PR (a merge commit, not a squash), pinned to the exact commit it
   reviewed, and reports to the owner what went in. Nobody pushes to `main` directly.
   - **ยังต้องถาม owner ก่อน merge** เมื่อ PR: เปลี่ยน CSP/การป้องกัน/สิ่งที่ `SECURITY.md` สัญญาไว้ · ย้ายข้อมูลผู้ใช้หรือเปลี่ยนสิ่งที่ส่งออกนอกเครื่อง ·
     ต้องตั้งค่า env บน Vercel · หรือ PO ตรวจแล้วมีข้อที่ยอมรับไว้ (ผ่านแบบมีเงื่อนไข) ซึ่ง owner ควรรู้ก่อน
     **Still ask the owner first** when a PR changes the CSP, a guard or a promise in `SECURITY.md`; moves user data or
     changes what leaves the device; needs a Vercel env change; or passes review with a caveat the owner should hear first.
   - Dev/Dev UX ยังห้ามกด merge เองเหมือนเดิม · Developers still never merge their own PRs.

**ทำไม:** `main` deploy ขึ้น Vercel (production) ทันที · merge ก่อน PO ตรวจ = ผู้ใช้เจอก่อนใครตรวจ · เคยเกิดแล้ว: PR #120 ถูก merge
โดย Dev เองก่อนผลตรวจของ PO ออก ผลตรวจผ่าน แต่ถ้าไม่ผ่าน production ก็เปลี่ยนไปแล้ว
**Why:** `main` deploys to production the moment it changes, so a merge before review means users see it before anyone
has checked it. It happened once: PR #120 was merged by its developer before the PO's review finished. The review
passed that time; had it failed, production would already have changed.

**ทำไมข้อ 3 เปลี่ยน:** owner บอกว่า "Merge หน้าที่คุณ ทำเลย" (2026-09-29) · สิ่งที่กันไม่ให้ผู้ใช้เจอก่อนตรวจคือการตรวจของ PO
ไม่ใช่ขั้นรอคำสั่ง · ขั้นรอเพิ่มแค่เวลาที่ PR ค้าง และ PR ที่ค้างคือต้นเหตุของ conflict ทุกรอบ (ตัวเลข ภาพ README)
**Why step 3 changed:** the owner said merging is the PO's job (2026-09-29). What keeps users from seeing unreviewed
work is the review, not the wait for a word; the wait only added time for PRs to sit, and sitting PRs are what caused
every round of count, picture and README conflicts.

### ช่องโหว่ความปลอดภัย: รายงานแบบส่วนตัวเท่านั้น / Security findings are reported privately

- **ช่องโหว่ห้ามลง issue, PR, commit message หรือคอมเมนต์สาธารณะ** — `SECURITY.md` ระบุช่องทางไว้ช่องเดียวคือ
  private vulnerability reporting (Security → Report a vulnerability) · agent หรือ QA ที่เจอช่องโหว่ให้**ร่าง advisory**
  (เกิดอะไรขึ้น, ขั้นตอนทำซ้ำแบบสั้นที่สุด, ผลกระทบ, แนวทางแก้) แล้วส่งให้ owner เป็นคนยื่น เพราะ agent ไม่มีเครื่องมือ
  สร้าง private advisory · **เคยพลาดมาแล้ว:** รอบ QA หนึ่งเปิด finding ความปลอดภัยสามเรื่องเป็น issue สาธารณะ
  และเรื่องหนึ่งเขียนวิธีหลบตัวกันไว้ชัดเจน งานแก้จึงต้องแซงคิวขึ้นมาเพื่อปิดช่วงที่มันเปิดเผยอยู่ การปิด issue
  ทีหลังไม่ช่วยอะไร เพราะ notification ถูกส่งออกไปแล้ว
  A vulnerability never goes into a public issue, PR, commit message or comment. `SECURITY.md` names one channel,
  private vulnerability reporting. An agent that finds one **drafts the advisory** — what happened, the shortest
  repro, impact, fix direction — and hands it to the owner to file, because agents have no tool to create a private
  advisory. It went wrong once: a QA pass opened three security findings as public issues, one of them spelling out
  a way past a guard, and the fix had to jump the queue to shorten the window. Closing an issue afterwards does not
  help — the notifications have already gone out.
- **ไม่แน่ใจว่านับเป็นช่องโหว่ไหม ให้ถือว่านับ** — อะไรก็ตามที่ผ่านสิ่งที่ `SECURITY.md` หรือ README อ้างว่ากันไว้
  (SSRF, auth, RLS, CSP, secret, rate limit) นับทั้งหมด owner ย้ายรายงานไปเป็น issue สาธารณะทีหลังได้ แต่ของที่
  เปิดเผยไปแล้วไม่มีใครดึงคืนได้
  When unsure, treat it as a vulnerability: anything that gets past a guard `SECURITY.md` or the README claims
  counts. The owner can move a report into the open later; nobody can take a public one back.
- **ประเมิน severity จาก "ใครเข้าถึงได้" ก่อน** — ช่องที่ต้องมี `SOURCES_ADMIN_TOKEN` ถึงจะใช้ได้ คนที่ใช้ได้คือ
  operator หรือคนที่คุม API ปลายทางที่ operator เลือก ไม่ใช่ใครก็ได้บนอินเทอร์เน็ต · #18/#19 ถูกเปิดเป็น Medium
  แล้วถูกลดเป็น Low ด้วยเหตุผลนี้ finding ที่เป็นแบบนั้นคือเรื่อง reliability และเปิดเป็น issue ปกติได้
  Rate severity by who can reach it. A path behind `SOURCES_ADMIN_TOKEN` is open to the operator, or to whoever
  runs an upstream the operator picked — not to the public. #18/#19 were filed as Medium and moved to Low for
  exactly that reason; a finding shaped like that is reliability, and an ordinary issue is fine.
- **โค้ดที่ยืมข้ามโปรเจกต์ในตระกูลเดียวกัน ต้องแก้ครบทุกที่ก่อนเผยแพร่ advisory** (ADR-0022 ข้อ 9 ของ PaynEat ERP ซึ่งเป็น
  กติกาเดียวกันทั้ง ecosystem) · ถ้าช่องโหว่อยู่ในโค้ดที่ ERP, POS, MeDF หรือโปรเจกต์อื่นคัดลอกไป (เช่น `urlGuard`,
  `usage.ts`, `saveHealth.ts`) ให้ระบุในร่าง advisory ว่าโปรเจกต์ไหนใช้โค้ดนั้นอยู่ owner จะแจ้งแบบส่วนตัวให้แก้ก่อนเผยแพร่
  Code adapted between projects in the ecosystem is fixed in every one of them before any advisory is published
  (PaynEat ERP ADR-0022, decision 9). A draft advisory names the other projects known to carry the same code.

### สำหรับ session ที่เป็น PO / For a session acting as Product Owner

- **อ่าน [`docs/PO_LESSONS.md`](docs/PO_LESSONS.md) ก่อนเริ่มงานทุกครั้ง** — บันทึกความผิดพลาดจริงของ PO และกฎที่เกิดจากมัน
  ข้อที่สำคัญที่สุด: **"พร้อม" แปลว่าลองงานหลักของ owner บน production ในฐานะผู้ใช้แล้ว ไม่ใช่เทสต์เขียว** · วันแรกที่เปิดให้คนนอกใช้
  ด่านทั้งสิบเขียวครบ ขณะที่ฟีเจอร์ที่เป็นเหตุผลของแอป (ต่อ API/ข้อมูลของตัวเอง) ถูกปิดอยู่บน production
  Read `docs/PO_LESSONS.md` before starting. Its first rule: "ready" means the owner's core jobs were tried on
  production as a user, not that the gates are green — on launch day every gate was green while the feature the
  app exists for was switched off in production.

## Communication language
- Write every message to the user in Thai, including short progress updates between tool calls and final summaries, even when files, tool output, or surrounding context are in English.
- Keep technical terms, file names, commands, branch names, PR numbers, and error messages in their original form.
- This rule covers chat only. Commit messages, code, comments, README, and other repository documents follow the project's existing language.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
