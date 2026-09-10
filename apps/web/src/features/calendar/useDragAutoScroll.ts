import { type RefObject, useCallback, useEffect, useRef } from "react";
import { computeAutoScrollVelocity } from "./auto-scroll";

export interface DragAutoScroll {
  /** Latest pointer position for the live drag; the first call starts the rAF loop. */
  track: (clientX: number, clientY: number) => void;
  /** Stop the loop and forget the tracked pointer. Safe when idle. */
  stop: () => void;
}

export interface DragAutoScrollCallbacks {
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Re-resolve the drag at the tracked pointer once the scroller actually moved. */
  onScrolled: (clientX: number, clientY: number) => void;
}

/** A frame budget cap, so a backgrounded tab does not resume with one enormous jump. */
const MAX_FRAME_MS = 100;

/**
 * Scrolls the timed grid while a drag rests near its edge. Driven by `requestAnimationFrame`,
 * not by `pointermove` — a finger held inside the edge band emits no moves, and that is exactly
 * the case that has to keep scrolling.
 */
export function useDragAutoScroll(callbacks: DragAutoScrollCallbacks): DragAutoScroll {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameMsRef = useRef(0);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pointerRef.current = null;
  }, []);

  const stepScroll = useCallback(() => {
    frameRef.current = null;
    const pointer = pointerRef.current;
    const scroller = callbacksRef.current.scrollerRef.current;
    if (!pointer || !scroller) return;
    const now = performance.now();
    const elapsedMs = Math.min(now - lastFrameMsRef.current, MAX_FRAME_MS);
    lastFrameMsRef.current = now;
    const box = scroller.getBoundingClientRect();
    const velocity = computeAutoScrollVelocity(pointer.y, { top: box.top, bottom: box.bottom });
    if (velocity !== 0) {
      const before = scroller.scrollTop;
      const furthest = scroller.scrollHeight - scroller.clientHeight;
      const next = before + (velocity * elapsedMs) / 1000;
      scroller.scrollTop = Math.max(0, Math.min(furthest, next));
      if (scroller.scrollTop !== before) callbacksRef.current.onScrolled(pointer.x, pointer.y);
    }
    frameRef.current = requestAnimationFrame(stepScroll);
  }, []);

  const track = useCallback(
    (clientX: number, clientY: number) => {
      pointerRef.current = { x: clientX, y: clientY };
      if (frameRef.current !== null) return;
      lastFrameMsRef.current = performance.now();
      frameRef.current = requestAnimationFrame(stepScroll);
    },
    [stepScroll],
  );

  useEffect(() => stop, [stop]);

  return { track, stop };
}
