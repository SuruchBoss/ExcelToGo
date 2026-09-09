import { LiveAggregate } from "@/lib/liveBlocks";

export const LIVE_DRAG_MIME = "application/x-exceltogo-live";

export interface LiveDragPayload {
  sourceId: string;
  kind: "table" | "value";
  column?: string;
  aggregate?: LiveAggregate;
}

export function setLiveDragData(e: React.DragEvent, payload: LiveDragPayload) {
  e.dataTransfer.setData(LIVE_DRAG_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "copy";
}

export function readLiveDragData(e: React.DragEvent): LiveDragPayload | null {
  const raw = e.dataTransfer.getData(LIVE_DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LiveDragPayload;
  } catch {
    return null;
  }
}
