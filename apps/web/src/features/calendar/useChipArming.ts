import { useEffect, useRef, useState } from "react";
import { LONG_PRESS_MS, pressSourceOf, useCompact } from "@/core/ui";
import { advanceChipTouchPhase, type ChipTouchEvent, type ChipTouchPhase } from "./chip-arming";
import { DRAG_THRESHOLD_PX, type DragMode } from "./geometry";

export interface ChipPress {
  id: string;
  clientX: number;
  clientY: number;
  pointerId: number;
}

export interface ChipArming {
  /** The one armed chip, or null. Drives the lift, the handles, `longPress` and `touch-none`. */
  armedChipId: string | null;
  /** Touch pointerdown on an un-armed, in-window chip body — starts the LONG_PRESS_MS hold. */
  beginPress: (press: ChipPress) => void;
  /** Touch pointerdown on the armed chip's body or one of its handles. */
  beginArmedPress: (pointerId: number) => void;
  /** The live drag crossed DRAG_THRESHOLD_PX with `mode` grabbed. */
  reportTravel: (mode: DragMode) => void;
  /** The chip menu took this press: keep the arm, drop the pending drag. */
  yieldToMenu: () => void;
  /** Every §2.5 disarm edge. A no-op when nothing is armed. */
  disarm: () => void;
}

export interface ChipArmingCallbacks {
  /** The hold elapsed: clear the pending tap, clear the selection, announce, begin a move drag. */
  onArm: (press: ChipPress) => void;
  /** A real armed → idle transition: cancel any live drag and swallow the click that follows. */
  onDisarm: () => void;
}

const isCommandBarChord = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

function isPressInsideArmedChip(target: EventTarget | null, armedChipId: string): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-chip-handle]") !== null) return true;
  if (target.closest('[role="menu"]') !== null) return true;
  return target.closest("[data-chip-id]")?.getAttribute("data-chip-id") === armedChipId;
}

export function useChipArming(callbacks: ChipArmingCallbacks): ChipArming {
  const [armedChipId, setArmedChipId] = useState<string | null>(null);
  const armedChipIdRef = useRef<string | null>(null);
  const phaseRef = useRef<ChipTouchPhase>("idle");
  const pressOriginRef = useRef<ChipPress | null>(null);
  const watchedPointerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const unwatchRef = useRef<(() => void) | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const compact = useCompact();
  const compactRef = useRef(compact);
  compactRef.current = compact;

  const dispatch = (event: ChipTouchEvent) => {
    phaseRef.current = advanceChipTouchPhase(phaseRef.current, event);
  };

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  };

  const endPress = (event: ChipTouchEvent) => {
    if (watchedPointerRef.current !== null) dispatch(event);
    clearHoldTimer();
    unwatchRef.current?.();
    unwatchRef.current = null;
    watchedPointerRef.current = null;
    pressOriginRef.current = null;
  };
  const endPressRef = useRef(endPress);
  endPressRef.current = endPress;

  const watchPress = (pointerId: number) => {
    unwatchRef.current?.();
    watchedPointerRef.current = pointerId;
    const onMove = (e: PointerEvent) => {
      const origin = pressOriginRef.current;
      if (e.pointerId !== pointerId || origin === null) return;
      if (phaseRef.current !== "pressing") return;
      const travelPx = Math.hypot(e.clientX - origin.clientX, e.clientY - origin.clientY);
      if (travelPx < DRAG_THRESHOLD_PX) return;
      endPressRef.current({ kind: "travel", mode: "move" });
    };
    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      endPressRef.current({ kind: e.type === "pointercancel" ? "cancel" : "release" });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    unwatchRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  };

  const disarm = () => {
    if (phaseRef.current === "idle") return;
    endPress({ kind: "disarm" });
    phaseRef.current = "idle";
    armedChipIdRef.current = null;
    setArmedChipId(null);
    callbacksRef.current.onDisarm();
  };
  const disarmRef = useRef(disarm);
  disarmRef.current = disarm;

  const beginPress = (press: ChipPress) => {
    if (armedChipIdRef.current !== null) disarm();
    endPress({ kind: "cancel" });
    dispatch({ kind: "press" });
    pressOriginRef.current = press;
    watchPress(press.pointerId);
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      if (phaseRef.current !== "pressing") return;
      dispatch({ kind: "hold-elapsed" });
      armedChipIdRef.current = press.id;
      setArmedChipId(press.id);
      callbacksRef.current.onArm(press);
    }, LONG_PRESS_MS);
  };

  const beginArmedPress = (pointerId: number) => {
    endPress({ kind: "cancel" });
    dispatch({ kind: "armed-press" });
    watchPress(pointerId);
  };

  // Mounted through the hold too, not just while armed: edge 10 has to catch a mouse that
  // arrives mid-hold, or a finger already down goes on to arm against the desktop contract.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (phaseRef.current === "idle") return;
      const armedId = armedChipIdRef.current;
      if (pressSourceOf(e.pointerType, compactRef.current) === "mouse") {
        if (armedId === null) endPressRef.current({ kind: "cancel" });
        else disarmRef.current();
        return;
      }
      if (armedId === null || isPressInsideArmedChip(e.target, armedId)) return;
      disarmRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (armedChipIdRef.current === null) return;
      if (e.key === "Escape" || isCommandBarChord(e)) disarmRef.current();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(
    () => () => {
      endPressRef.current({ kind: "disarm" });
    },
    [],
  );

  return {
    armedChipId,
    beginPress,
    beginArmedPress,
    reportTravel: (mode) => dispatch({ kind: "travel", mode }),
    yieldToMenu: () =>
      endPress(armedChipIdRef.current === null ? { kind: "cancel" } : { kind: "menu-opened" }),
    disarm,
  };
}
