"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { isInvitableEmail } from "@/lib/cloud/workbook";
import { useCloudStore } from "@/store/cloudStore";
import { useT } from "@/i18n";

/**
 * Who else can open this workbook.
 *
 * Invitation is by email because there is no user directory to pick from — and because the person
 * being invited may not have an account yet. The row waits for them; nothing here has to know
 * whether the address belongs to anyone, and the database never answers that question either,
 * which is the same thing as not leaking who has signed up.
 */
export default function ShareWorkbook() {
  const t = useT();
  const { linked, members, userId, busy, loadMembers, invite, revoke } = useCloudStore();
  const [email, setEmail] = useState("");
  const workbookId = linked?.id;
  const owner = useCloudStore((s) => s.workbooks.find((w) => w.id === workbookId)?.ownerId);
  const mine = !owner || owner === userId;
  const inputRef = useRef<HTMLInputElement>(null);

  // Asked for whenever the open workbook changes, including the first time the panel mounts.
  useEffect(() => {
    void loadMembers();
  }, [loadMembers, workbookId]);

  if (!linked) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-xs leading-relaxed text-zinc-500">
        {t.share.needsWorkbook}
      </p>
    );
  }

  const valid = isInvitableEmail(email);

  return (
    <section className="rounded-lg border border-zinc-200 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
        <UserPlus size={14} className="text-emerald-700" />
        {t.share.title}
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{t.share.subtitle}</p>

      {mine ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            void invite(email);
            setEmail("");
            inputRef.current?.focus();
          }}
          className="mt-2.5"
        >
          <label className="block text-xs font-medium text-zinc-700" htmlFor="share-email">
            {t.share.emailLabel}
          </label>
          <div className="mt-1 flex gap-1.5">
            <input
              id="share-email"
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.share.emailPlaceholder}
              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!valid || busy === "invite"}
              className="shrink-0 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {t.share.invite}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-2.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] text-zinc-600">
          {t.share.ownerOnly}
        </p>
      )}

      <p className="mt-2.5 text-[11px] font-medium text-zinc-600">
        {members.length === 0 ? t.share.nobody : t.share.sharedWith(members.length)}
      </p>
      {members.length > 0 && (
        <ul className="mt-1.5 border-t border-zinc-100">
          {members.map((member) => (
            <li key={member.email} className="flex items-center gap-2 border-b border-zinc-100 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-700">{member.email}</span>
              {mine && (
                <button
                  onClick={() => {
                    // Taking someone's access away is worth one question, and the browser's own
                    // dialog is the one place a click cannot be mis-aimed past.
                    if (window.confirm(t.share.confirmRemove(member.email))) void revoke(member.email);
                  }}
                  disabled={busy === "invite"}
                  title={t.share.remove}
                  className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
