"use client";

import { create } from "zustand";
import { LiveRoom } from "@/lib/cloud/liveRoom";
import { colourFor, Participant, randomClientId } from "@/lib/cloud/liveSession";
import { openRealtimeChannel } from "@/lib/cloud/realtimeChannel";
import { diffWorkbook } from "@/lib/cloud/sheetDiff";
import { fetchWorkbook } from "@/lib/cloud/client";
import { readWorkbook } from "@/lib/cloud/workbook";
import { getMessages } from "@/i18n";
import { cellRef } from "@/lib/formulaEngine/address";
import { useCloudStore } from "./cloudStore";
import { useSheetStore } from "./sheetStore";

/**
 * Turning live editing on, and everything that has to be unhooked when it goes off again.
 *
 * The rules are in `lib/cloud/liveSession.ts`, the bookkeeping in `liveRoom.ts`, the transport in
 * `realtimeChannel.ts`, and what changed in `sheetDiff.ts`. What is left here is the wiring: watch
 * the document, put what changed on the wire, and put what arrives into the document.
 *
 * Off unless somebody turns it on, and unavailable at all unless the workbook has been saved to a
 * cloud the deployment was configured with. There is no room to join otherwise — a live session is
 * a session *of* a saved workbook, and the id of that row is the room's name.
 */

export type LiveStatus = "off" | "joining" | "live" | "failed";

interface LiveState {
  status: LiveStatus;
  participants: Participant[];
  /** Shown to the others. Not an identity claim: there is nothing here that could verify one. */
  name: string;
  setName: (name: string) => void;
  join: () => Promise<void>;
  leave: () => void;
}

let room: LiveRoom | null = null;
let unhook: (() => void)[] = [];
/**
 * True while a message from somebody else is being written into the document.
 *
 * Without it the change would come back out of the diff and be broadcast again, and two clients
 * would trade the same edit for as long as they both had the window open.
 */
let applyingRemote = false;

const defaultName = () => getMessages().collab.someone;

function teardown() {
  for (const off of unhook) off();
  unhook = [];
  room?.close();
  room = null;
}

/** Called by the grid as a cell opens and closes, so an arriving edit can wait its turn. */
export function reportEditing(row: number, col: number | null): void {
  if (!room) return;
  if (col === null) room.endEdit();
  else room.beginEdit(useSheetStore.getState().activeSheetId, row, col);
}

export const useLiveStore = create<LiveState>((set, get) => ({
  status: "off",
  participants: [],
  name: "",

  setName: (name) => set({ name: name.slice(0, 40) }),

  join: async () => {
    const linked = useCloudStore.getState().linked;
    if (!linked || get().status === "joining" || get().status === "live") return;
    set({ status: "joining", participants: [] });
    teardown();

    const self = randomClientId();
    try {
      const channel = await openRealtimeChannel({
        workbookId: linked.id,
        self,
        onStatus: (status) => set({ status: status === "joined" ? "live" : "failed" }),
      });

      const live = new LiveRoom({
        channel,
        self,
        name: get().name.trim() || defaultName(),
        hooks: {
          applyCell: (edit) => {
            applyingRemote = true;
            try {
              useSheetStore.getState().applyRemoteCell(edit.tabId, edit.row, edit.col, edit.raw);
            } finally {
              applyingRemote = false;
            }
          },
          overwritten: (edit) => {
            // The one moment worth interrupting for: they watched a value they typed become
            // somebody else's. Saying nothing is how people stop trusting a shared document.
            useSheetStore
              .getState()
              .applyRemoteCell(edit.tabId, edit.row, edit.col, edit.raw, getMessages().collab.overwritten(cellRef(edit.row, edit.col)));
          },
          resync: () => void resync(),
          participants: (list) => set({ participants: list }),
        },
      });
      room = live;
      live.setTabs(useSheetStore.getState().sheets.map((t) => t.id));

      unhook.push(
        useSheetStore.subscribe((state, prev) => {
          if (applyingRemote) return;
          if (state.sheets !== prev.sheets) {
            live.setTabs(state.sheets.map((t) => t.id));
            const diff = diffWorkbook(prev.sheets, state.sheets);
            for (const change of diff.cells) live.localEdit(change.tabId, change.row, change.col, change.raw);
            // A structural change has to reach the others through the saved copy, because that is
            // what they will reload; broadcasting before saving would send them to fetch a row
            // that still describes the sheet as it was.
            for (const tabId of diff.structural) void announceStructure(live, tabId);
          }
          const selection = state.selectionBySheetId[state.activeSheetId];
          const wasSelection = prev.selectionBySheetId[prev.activeSheetId];
          if (selection && selection !== wasSelection) {
            live.moveCursor(state.activeSheetId, selection.anchorRow, selection.anchorCol);
          }
        })
      );
    } catch {
      set({ status: "failed" });
      teardown();
    }
  },

  leave: () => {
    teardown();
    set({ status: "off", participants: [] });
  },
}));

/** Saves first, then tells the others to reload — in that order, or they reload the old shape. */
async function announceStructure(live: LiveRoom, tabId: string): Promise<void> {
  const linked = useCloudStore.getState().linked;
  if (linked) await useCloudStore.getState().saveOver(linked.name);
  live.localStructureChange(tabId);
}

/** Someone changed the shape of a sheet; take the saved copy rather than patching this one. */
async function resync(): Promise<void> {
  const linked = useCloudStore.getState().linked;
  if (!linked) return;
  try {
    const row = await fetchWorkbook(linked.id);
    const sheets = readWorkbook(row.data);
    if (!sheets) return;
    applyingRemote = true;
    try {
      useSheetStore.getState().replaceWorkbook(sheets);
    } finally {
      applyingRemote = false;
    }
  } catch {
    // A failed reload leaves the document as it was, which is the safe half of the two.
  }
}

/** The colour the others are drawn in, so the strip and the grid cannot disagree. */
export const participantColour = colourFor;
