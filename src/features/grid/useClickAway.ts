import { useEffect, useRef } from "react";

/**
 * Closes a popover/menu on the next click or scroll anywhere in the window — the "click outside to
 * dismiss" behavior shared by the header context menu and the column filter popover. `active`
 * gates whether the listeners are attached at all; `onClose` doesn't need to be memoized since the
 * latest version is always read via a ref.
 *
 * Nothing is listened to until the frame after it is switched on, and that one line is the whole
 * reason this comment exists. The format bar is a horizontal scroller on a narrow screen, so
 * tapping a button near its right edge makes the browser scroll that button into view *after* the
 * click — which fired `scroll` on the toolbar, which closed the popover the same tap had just
 * opened. Below 640px the validation, names and comment popovers could not be opened at all, and
 * the a11y gate is what found it: on a desktop viewport nothing scrolls and all three were fine.
 *
 * Skipping one frame is enough because the browser dispatches those scroll events in the rendering
 * step *before* it runs animation-frame callbacks, so a listener armed in the callback has already
 * missed the scroll its own opening gesture caused.
 */
export function useClickAway(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return;
    let armed = false;
    const arm = requestAnimationFrame(() => {
      armed = true;
    });
    const close = () => {
      if (armed) onCloseRef.current();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      cancelAnimationFrame(arm);
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [active]);
}
