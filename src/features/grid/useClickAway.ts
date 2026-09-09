import { useEffect, useRef } from "react";

/** Closes a popover/menu on the next click or scroll anywhere in the window — the "click
 *  outside to dismiss" behavior shared by the header context menu and the column filter
 *  popover. `active` gates whether the listeners are attached at all; `onClose` doesn't need
 *  to be memoized since the latest version is always read via a ref. */
export function useClickAway(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return;
    const close = () => onCloseRef.current();
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [active]);
}
