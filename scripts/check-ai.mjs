#!/usr/bin/env node
/**
 * Asks the running app's assistant a set of ordinary questions with a real Anthropic key, and
 * checks the answers against what this app's formula engine can actually evaluate.
 *
 *     ANTHROPIC_API_KEY=sk-ant-... npm run build && npm start &
 *     node scripts/check-ai.mjs
 *
 * Not part of `npm run verify`, and deliberately so: it needs a key, it costs money, and it talks
 * to a service that can be slow or down — none of which belongs in a gate that has to be green
 * before every push. Run it after changing the prompt, the model, or the engine's function list.
 *
 * Why it exists. The suite mocks Anthropic, so every test of the assistant passed while the real
 * thing answered fourteen ordinary questions with six formulas this engine cannot run — TEXTJOIN,
 * CHAR, FIND, RANK.EQ, SUMPRODUCT, CEILING. All valid Excel, all `#NAME?` in the cell, after the
 * user pressed a button labelled "insert". A mock cannot find that; only a real key can.
 *
 * The function list is read out of the engine's own source, the way `counts.mjs` reads the figures
 * it checks — a second, hand-written copy would be the thing that goes stale.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.APP_URL ?? "http://127.0.0.1:3100";

const supported = new Set(
  (readFileSync(path.join(ROOT, "src/lib/formulaEngine/functions.ts"), "utf8").match(/^  [A-Z][A-Z0-9.]*:/gm) ?? [])
    .map((m) => m.trim().replace(":", ""))
);

/** Questions a real person asks, including ones this engine has no function for. */
const QUESTIONS = [
  { locale: "th", question: "รวมยอดขายเฉพาะสาขาเหนือ", selection: "E2:E100", headers: ["สินค้า", "สาขา", "จำนวน", "ราคา", "ยอดรวม"] },
  { locale: "th", question: "หาราคาของสินค้าชื่อ กาแฟ จากตาราง", selection: "A2:D50", headers: ["สินค้า", "หมวดหมู่", "ราคา", "จำนวน"] },
  { locale: "th", question: "นับจำนวนสินค้าที่ราคามากกว่า 50", selection: "C2:C50" },
  { locale: "en", question: "average of the price column, ignoring blanks", selection: "C2:C50", headers: ["item", "qty", "price"] },
  { locale: "en", question: "count how many rows have a price over 100", selection: "C2:C50" },
  { locale: "en", question: "show the sales figure as a percentage of the grand total", selection: "D2" },
  { locale: "en", question: "round the total up to the nearest hundred", selection: "E2" },
  { locale: "en", question: "today as a nicely formatted date" },
  // Below here the engine has no function for what is being asked. The right answer is the real
  // Excel formula plus a warning in the explanation — not a substitute that quietly returns a
  // number, which is the failure this file was written after.
  { locale: "en", question: "join all the names in A2:A20 into one line separated by commas", selection: "A2:A20" },
  { locale: "en", question: "the first word of the text in A2", selection: "A2" },
  { locale: "en", question: "rank each row by sales, highest first", selection: "D2:D50" },
  { locale: "en", question: "how many unique branch names are there", selection: "B2:B50" },
];

const WARNING = /#NAME\?|cannot calculate|คำนวณ.*ไม่ได้/i;

function functionsIn(formula) {
  return [...new Set((formula.match(/\b[A-Z][A-Z0-9.]*(?=\s*\()/g) ?? []))];
}

const rows = [];
for (const q of QUESTIONS) {
  const res = await fetch(`${BASE}/api/ai/formula`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(q),
  });
  if (!res.ok) {
    console.error(`  HTTP ${res.status} for "${q.question}" — is the app running at ${BASE}?`);
    process.exitCode = 1;
    continue;
  }
  const body = await res.json();
  if (body.source !== "ai") {
    // The route falls back to the local matcher on *any* failure — no key, demo mode, a refused
    // request, or a reply it could not parse — so this says what it knows and keeps going rather
    // than guessing a cause. The server log has the reason.
    console.log(`  FELLBACK  ${q.question.slice(0, 56)}`);
    rows.push({ q: q.question, formula: body.formula ?? "", unknown: [], warned: false, fellBack: true });
    process.exitCode = 1;
    continue;
  }
  const unknown = functionsIn(body.formula).filter((f) => !supported.has(f));
  const warned = WARNING.test(body.explanation ?? "");
  rows.push({ q: q.question, formula: body.formula, unknown, warned });
}

let silent = 0;
for (const r of rows) {
  const verdict = r.unknown.length === 0 ? "ok    " : r.warned ? "warned" : "SILENT";
  if (verdict === "SILENT") silent++;
  const note = r.unknown.length ? `  [${r.unknown.join(", ")}]` : "";
  console.log(`  ${verdict}  ${r.formula.slice(0, 56).padEnd(58)}${note}`);
  if (verdict === "SILENT") console.log(`          ^ ${r.q}`);
}

const fellBack = rows.filter((r) => r.fellBack).length;
console.log(`\n  ${rows.length} asked · ${fellBack} never reached the model · ${rows.filter((r) => r.unknown.length).length} used a function this engine lacks · ${silent} of those said nothing about it`);
if (silent > 0) {
  console.log("  A formula the engine cannot run is survivable; one that runs and is wrong is not.");
  process.exitCode = 1;
}
