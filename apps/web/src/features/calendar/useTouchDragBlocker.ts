import { type RefObject, useEffect, useRef } from "react";

/**
 * Keeps a live touch drag from being stolen by the grid's scroller.
 *
 * Chromium latches `touch-action` from the hit test at `touchstart`, so the `touch-none` an
 * arm applies 500ms into the gesture is ignored and the finger keeps panning — measured, not
 * assumed: without this the single-gesture drag armed the chip and moved nothing. React's
 * `onTouchMove` prop cannot be registered non-passive, hence the manual listener.
 */
export function useTouchDragBlocker(
  isTouchDragLiveRef: RefObject<boolean>,
): RefObject<HTMLButtonElement | null> {
  const chipRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const chip = chipRef.current;
    if (!chip) return;
    const blockScroll = (e: TouchEvent) => {
      if (isTouchDragLiveRef.current) e.preventDefault();
    };
    chip.addEventListener("touchmove", blockScroll, { passive: false });
    return () => chip.removeEventListener("touchmove", blockScroll);
  }, [isTouchDragLiveRef]);
  return chipRef;
}
