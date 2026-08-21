import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  advanceGesturePhase,
  type GesturePhase,
  type GesturePhaseEvent,
} from "./brainwrite-gestures";

interface GesturePhaseCallbacks {
  /** A gesture became live — the deck must stop rebuilding until it ends. */
  onGestureStart: () => void;
  /** The gesture reached idle, by release or by abort. */
  onGestureEnd: () => void;
  /** Tear down timers and motion values; runs before the phase reaches idle. */
  onAbort: () => void;
}

export interface GesturePhaseController {
  phase: GesturePhase;
  /** framer dispatches onDragEnd a frame late, so handlers must read this, never `phase`. */
  phaseRef: RefObject<GesturePhase>;
  /** True after an abort, until the next pointerdown — this is what stops framer's live pan. */
  isDragSuppressed: boolean;
  /** framer still fires onDragStart on a session that began before `drag` went false. */
  isDragSuppressedRef: RefObject<boolean>;
  advance: (event: GesturePhaseEvent) => void;
  abort: () => void;
  allowDrag: () => void;
}

export function useGesturePhase(callbacks: GesturePhaseCallbacks): GesturePhaseController {
  const [phase, setPhase] = useState<GesturePhase>("idle");
  const [isDragSuppressed, setIsDragSuppressed] = useState(false);
  const isDragSuppressedRef = useRef(false);
  const phaseRef = useRef<GesturePhase>("idle");
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const advance = useCallback((event: GesturePhaseEvent) => {
    const next = advanceGesturePhase(phaseRef.current, event);
    if (next === phaseRef.current) return;
    phaseRef.current = next;
    setPhase(next);
    if (next === "dragging") callbacksRef.current.onGestureStart();
    else if (next === "idle") callbacksRef.current.onGestureEnd();
  }, []);

  const abort = useCallback(() => {
    isDragSuppressedRef.current = true;
    setIsDragSuppressed(true);
    callbacksRef.current.onAbort();
    advance("abort");
  }, [advance]);

  const allowDrag = useCallback(() => {
    isDragSuppressedRef.current = false;
    setIsDragSuppressed(false);
  }, []);

  useEffect(() => {
    if (phase === "idle") return;
    const handleVisibility = () => {
      if (document.hidden) abort();
    };
    document.addEventListener("pointercancel", abort);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", abort);
    return () => {
      document.removeEventListener("pointercancel", abort);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", abort);
    };
  }, [phase, abort]);

  // A card removed by a deck rebuild must release the freeze it took out, without setting state.
  useEffect(
    () => () => {
      if (phaseRef.current === "idle") return;
      phaseRef.current = "idle";
      callbacksRef.current.onAbort();
      callbacksRef.current.onGestureEnd();
    },
    [],
  );

  return { phase, phaseRef, isDragSuppressed, isDragSuppressedRef, advance, abort, allowDrag };
}
