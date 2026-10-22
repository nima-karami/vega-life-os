import type { PressSource } from "@/core/ui/press-pointer";
import type { DragMode } from "./geometry";

export type ChipPressAction =
  | "ignore"
  | "armed-drag"
  | "arm"
  | "tap"
  | "range-select"
  | "toggle-select"
  | "drag";

interface ChipPointerPress {
  button: number;
  pointerType: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

interface ChipPressContext {
  compact: boolean;
  source: PressSource;
  isArmed: boolean;
}

function getSelectionAction(press: ChipPointerPress, compact: boolean): ChipPressAction | null {
  if (compact) return null;
  if (press.shiftKey) return "range-select";
  if (press.metaKey || press.ctrlKey) return "toggle-select";
  return null;
}

// The pointer decides, never the width: a touchscreen laptop is past `sm` and still has
// only fingers, so a width-gated finger armed a real move drag and silently rescheduled.
function canPointerDrag(pointerType: string, mode: DragMode, compact: boolean): boolean {
  if (pointerType === "mouse") return true;
  if (compact) return false;
  return mode === "move" ? pointerType !== "touch" : pointerType === "pen";
}

export function classifyTimedChipPress(
  press: ChipPointerPress,
  ctx: ChipPressContext & { mode: DragMode; isOffWindow: boolean },
): ChipPressAction {
  if (press.button !== 0) return "ignore";
  const isTouch = ctx.source === "touch";
  if (ctx.isArmed && isTouch) return "armed-drag";
  if (!canPointerDrag(press.pointerType, ctx.mode, ctx.compact)) {
    const isArmable = ctx.mode === "move" && !ctx.isArmed && isTouch && !ctx.isOffWindow;
    return isArmable ? "arm" : "tap";
  }
  if (ctx.mode !== "move") return "drag";
  return getSelectionAction(press, ctx.compact) ?? "drag";
}

/** A finger arms first and drags second, exactly as it does on a timed chip. */
export function classifyAllDayChipPress(
  press: ChipPointerPress,
  ctx: ChipPressContext,
): ChipPressAction {
  if (press.button !== 0) return "ignore";
  if (ctx.source === "touch") return ctx.isArmed ? "armed-drag" : "arm";
  return getSelectionAction(press, ctx.compact) ?? "drag";
}
