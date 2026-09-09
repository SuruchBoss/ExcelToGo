"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

interface Suggestion {
  formula: string;
  explanation: string;
  source: "ai" | "heuristic";
}

interface Props {
  selectionAddress: string;
  onInsert: (formula: string) => void;
}

const EXAMPLES = [
  "อยากรวมยอดขายทั้งหมดในคอลัมน์นี้",
  "หาค่าเฉลี่ยของคะแนนสอบ",
  "ถ้าคะแนนมากกว่า 50 ให้ขึ้นว่า ผ่าน",
  "ค้นหาราคาสินค้าจากรหัสสินค้า",
];

export default function AIAssistantPanel({ selectionAddress, onInsert }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async (q: string) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const res = await fetch("/api/ai/formula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, selection: selectionAddress }),
      });
      if (!res.ok) throw new Error("request_failed");
      const data = await res.json();
      setSuggestion(data);
    } catch {
      setError("ขออภัย เกิดข้อผิดพลาดในการเชื่อมต่อ AI ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <Sparkles size={16} className="text-violet-600" /> ถาม AI หาสูตร
        </h2>
        <p className="text-xs text-zinc-500">
          พิมพ์สิ่งที่ต้องการเป็นภาษาไทยหรืออังกฤษ AI จะแนะนำสูตรที่เหมาะสมให้
        </p>
      </div>

      <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-500">
        ช่วงที่เลือกอยู่: <span className="font-medium text-zinc-700">{selectionAddress}</span>
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            ask(question);
          }
        }}
        placeholder="เช่น อยากรวมยอดขายทั้งหมดในคอลัมน์นี้"
        rows={3}
        className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
      />

      <button
        onClick={() => ask(question)}
        disabled={loading || !question.trim()}
        className="flex items-center justify-center gap-1.5 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        ถาม AI
      </button>

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQuestion(ex);
              ask(ex);
            }}
            className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600 hover:bg-zinc-200"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <p className="rounded bg-red-50 p-2 text-xs text-red-600">{error}</p>}

      {suggestion && (
        <div className="mt-1 flex flex-col gap-2 rounded-md border border-violet-200 bg-violet-50 p-3">
          <code className="text-sm font-semibold text-violet-900">{suggestion.formula}</code>
          <p className="text-xs text-violet-700">{suggestion.explanation}</p>
          {suggestion.source === "heuristic" && (
            <p className="text-[10px] text-violet-400">
              * ยังไม่ได้เชื่อมต่อ AI จริง (ตั้งค่า ANTHROPIC_API_KEY) ระบบจึงแนะนำจากคำสำคัญเบื้องต้น
            </p>
          )}
          <button
            onClick={() => onInsert(suggestion.formula)}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
          >
            ใส่สูตรนี้ที่เซลล์ {selectionAddress.split(":")[0]}
          </button>
        </div>
      )}
    </div>
  );
}
