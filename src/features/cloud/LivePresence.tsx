"use client";

import { useRef } from "react";
import { Users } from "lucide-react";
import { colourFor } from "@/lib/cloud/liveSession";
import { useCloudStore } from "@/store/cloudStore";
import { useLiveStore } from "@/store/liveStore";
import { cellRef } from "@/lib/formulaEngine/address";
import { useT } from "@/i18n";

/**
 * Who else is in this workbook, and the switch that puts you in it.
 *
 * Deliberately blunt about what it is: the limits are printed under the button rather than left
 * for someone to discover when two people type into one cell. A live session that quietly loses an
 * edit is worse than one that says up front which edits it cannot merge.
 */
export default function LivePresence() {
  const t = useT();
  const linked = useCloudStore((s) => s.linked);
  const { status, participants, join, leave, setName } = useLiveStore();
  const nameRef = useRef<HTMLInputElement>(null);
  const live = status === "live" || status === "joining";

  if (!linked) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-xs leading-relaxed text-zinc-500">
        {t.collab.needsWorkbook}
      </p>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
        <Users size={14} className="text-emerald-700" />
        {t.collab.title}
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{t.collab.subtitle}</p>

      <label className="mt-2.5 block text-xs font-medium text-zinc-700" htmlFor="collab-name">
        {t.collab.nameLabel}
      </label>
      <input
        id="collab-name"
        ref={nameRef}
        disabled={live}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.collab.namePlaceholder}
        className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-500"
      />

      <button
        onClick={() => (live ? leave() : void join())}
        disabled={status === "joining"}
        className={
          "mt-2 flex min-h-11 w-full items-center justify-center rounded-md px-3 text-xs font-semibold disabled:opacity-50 sm:min-h-0 sm:py-2 " +
          (live ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-50" : "bg-emerald-700 text-white hover:bg-emerald-800")
        }
      >
        {status === "joining" ? t.collab.joining : live ? t.collab.leave : t.collab.join}
      </button>

      {status === "failed" && (
        <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
          {t.collab.failed}
        </p>
      )}

      {status === "live" && (
        <div className="mt-2.5">
          <p className="text-[11px] font-medium text-zinc-600">
            {participants.length === 0 ? t.collab.alone : t.collab.hereNow(participants.length)}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {participants.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-1.5 rounded-full border border-zinc-200 py-1 pl-1.5 pr-2.5 text-[11px] text-zinc-700"
              >
                {/* The dot repeats what the text already says, so it is hidden rather than read out. */}
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colourFor(person.id) }}
                />
                {t.collab.at(person.name, cellRef(person.row, person.col))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-400">{t.collab.limits}</p>
    </section>
  );
}
