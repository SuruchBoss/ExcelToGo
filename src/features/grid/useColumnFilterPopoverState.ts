import { useState } from "react";
import { useClickAway } from "./useClickAway";

export interface ColumnFilterPopoverState {
  col: number;
  x: number;
  y: number;
}

/** The column header's filter-funnel button: click toggles the popover for that column open
 *  or closed, and clicking away (or scrolling) closes whichever one is open. */
export function useColumnFilterPopoverState() {
  const [popover, setPopover] = useState<ColumnFilterPopoverState | null>(null);
  const close = () => setPopover(null);
  useClickAway(popover !== null, close);

  const toggle = (e: React.MouseEvent, col: number) => {
    setPopover((prev) => (prev?.col === col ? null : { col, x: e.clientX, y: e.clientY }));
  };

  return { popover, toggle, close };
}
