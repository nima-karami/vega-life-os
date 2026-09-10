import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef } from "react";
import { LONG_PRESS_MS } from "@/core/ui";
import { hasEscapedPressTolerance, isPressablePointer, type PressPoint } from "./long-press";

/** A held touch selects the row; the tap that follows is swallowed so it can't also open the card.
 *  Tracks a single primary pointer, so a second finger can neither re-arm the hold nor end it. */
export function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<number | null>(null);
  const originRef = useRef<PressPoint | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const disarm = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    originRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    disarm();
    pointerIdRef.current = null;
  }, [disarm]);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!isPressablePointer(event) || pointerIdRef.current !== null) return;
      pointerIdRef.current = event.pointerId;
      originRef.current = { x: event.clientX, y: event.clientY };
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        suppressClickRef.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const origin = originRef.current;
      if (event.pointerId !== pointerIdRef.current || origin === null) return;
      if (timerRef.current === null) return;
      if (hasEscapedPressTolerance(origin, { x: event.clientX, y: event.clientY })) disarm();
    },
    [disarm],
  );

  const onPointerRelease = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerId !== pointerIdRef.current) return;
      cancel();
    },
    [cancel],
  );

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerRelease,
      onPointerCancel: onPointerRelease,
      onClickCapture,
    },
    cancel,
  };
}
