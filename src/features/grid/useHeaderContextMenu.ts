import { useState } from "react";
import { useClickAway } from "./useClickAway";

export interface HeaderContextMenuState {
  type: "row" | "col";
  index: number;
  x: number;
  y: number;
}

/** Right-click menu on a row/column header (insert/delete). `onOpen` runs first so the caller
 *  can move the selection onto the whole row/column before the menu's actions read it. */
export function useHeaderContextMenu(onOpen: (type: "row" | "col", index: number) => void) {
  const [menu, setMenu] = useState<HeaderContextMenuState | null>(null);
  const close = () => setMenu(null);
  useClickAway(menu !== null, close);

  const open = (e: React.MouseEvent, type: "row" | "col", index: number) => {
    e.preventDefault();
    onOpen(type, index);
    setMenu({ type, index, x: e.clientX, y: e.clientY });
  };

  return { menu, open, close };
}
