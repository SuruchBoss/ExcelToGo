"use client";

import { useEffect, useRef, useState } from "react";
import { Cloud, CloudUpload, FolderOpen, LogOut, Trash2 } from "lucide-react";
import { useCloudStore } from "@/store/cloudStore";
import { useSheetStore } from "@/store/sheetStore";
import { useT } from "@/i18n";

/**
 * Sign in, save the open workbook, and pick one back up.
 *
 * Only rendered where a cloud backend is configured — the button that opens it doesn't exist
 * otherwise — so nothing here has to cope with there being no project to talk to.
 */
export default function CloudPanel() {
  const t = useT();
  const { email, busy, error, notice, workbooks, linked } = useCloudStore();
  const { start, signIn, leave, refresh, save, saveOver, open, remove, dismiss } = useCloudStore();
  const activeName = useSheetStore((s) => s.sheets[0]?.name ?? "ExcelToGo");
  const [address, setAddress] = useState("");
  // Uncontrolled, and keyed on the workbook it belongs to, so opening a different one refills the
  // field without an effect writing state during render — which is what React's compiler rules
  // (rightly) refuse.
  const nameRef = useRef<HTMLInputElement>(null);
  const defaultName = linked?.name ?? activeName;
  // `||`, not `??`: a field the user cleared should fall back to the default rather than send an
  // empty name the database's CHECK constraint would reject anyway.
  const typedName = () => nameRef.current?.value.trim() || defaultName;

  // The Supabase client is downloaded here, the first time this panel is mounted, rather than on
  // page load.
  useEffect(() => {
    void start();
  }, [start]);

  const working = busy !== null;

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
          <Cloud size={15} className="text-emerald-700" />
          {t.cloud.title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t.cloud.subtitle}</p>
      </div>

      {(error || notice) && (
        <button
          onClick={dismiss}
          className={
            "rounded-md border px-2.5 py-2 text-left text-xs leading-relaxed " +
            (error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")
          }
        >
          {error === "conflict"
            ? t.cloud.conflict
            : error === "unreadable"
              ? t.cloud.unreadable
              : error
                ? error
                : notice === "linkSent"
                  ? t.cloud.linkSent
                  : notice === "opened"
                    ? t.cloud.opened
                    : t.cloud.saved}
        </button>
      )}

      {!email ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (address.trim()) void signIn(address);
          }}
          className="rounded-lg border border-zinc-200 p-3"
        >
          <label className="text-xs font-medium text-zinc-700" htmlFor="cloud-email">
            {t.cloud.emailLabel}
          </label>
          <input
            id="cloud-email"
            type="email"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t.cloud.emailPlaceholder}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={working}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 sm:min-h-0 sm:py-2"
          >
            {busy === "signin" ? t.cloud.working : t.cloud.sendLink}
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">{t.cloud.privacy}</p>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-zinc-600">{t.cloud.signedInAs(email)}</span>
            <button
              onClick={() => void leave()}
              disabled={working}
              title={t.cloud.signOut}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
            >
              <LogOut size={14} />
            </button>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3">
            <label className="text-xs font-medium text-zinc-700" htmlFor="cloud-name">
              {t.cloud.nameLabel}
            </label>
            <input
              id="cloud-name"
              key={linked?.id ?? "unsaved"}
              ref={nameRef}
              defaultValue={defaultName}
              placeholder={t.cloud.namePlaceholder}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
            />
            {linked && <p className="mt-1.5 truncate text-[11px] text-zinc-500">{t.cloud.linkedTo(linked.name)}</p>}
            <div className="mt-2 flex flex-col gap-1.5">
              {linked && (
                <button
                  onClick={() => void saveOver(typedName())}
                  disabled={working}
                  className="flex min-h-11 items-center justify-center gap-1.5 truncate rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 sm:min-h-0 sm:py-2"
                >
                  <CloudUpload size={14} /> {t.cloud.saveOver(linked.name)}
                </button>
              )}
              <button
                onClick={() => void save(typedName())}
                disabled={working}
                className={
                  "flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold disabled:opacity-50 sm:min-h-0 sm:py-2 " +
                  (linked
                    ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                    : "bg-emerald-700 text-white hover:bg-emerald-800")
                }
              >
                <CloudUpload size={14} /> {t.cloud.saveNew}
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <button
              onClick={() => void refresh()}
              disabled={working}
              className="self-start text-xs font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {t.cloud.myWorkbooks(workbooks.length)}
            </button>
            {workbooks.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 p-3 text-xs text-zinc-500">{t.cloud.empty}</p>
            ) : (
              workbooks.map((w) => (
                <div
                  key={w.id}
                  className={
                    "flex items-center gap-1 rounded-lg border px-2 py-1.5 " +
                    (linked?.id === w.id ? "border-emerald-300 bg-emerald-50" : "border-zinc-200")
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-700">{w.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {t.cloud.updatedAt(new Date(w.updatedAt).toLocaleString())}
                    </p>
                  </div>
                  <button
                    onClick={() => void open(w.id)}
                    disabled={working}
                    title={t.cloud.openWorkbook}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                  >
                    <FolderOpen size={13} />
                  </button>
                  <button
                    onClick={() => {
                      // Deleting someone's only copy is worth one question, and the browser's own
                      // dialog is the one place a click can't be mis-aimed past.
                      if (window.confirm(t.cloud.confirmRemove(w.name))) void remove(w.id);
                    }}
                    disabled={working}
                    title={t.cloud.removeWorkbook}
                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
