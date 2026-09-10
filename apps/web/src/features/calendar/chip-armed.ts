export const ARMED_HANDLE_PX = 24;

/** Above this much chip, a handle straddles the edge instead of clearing the box. */
const STRADDLE_MIN_CHIP_PX = 40;
const STRADDLE_OUTSET_PX = 16;

/** Armed lift. Deliberately ring- and shadow-free: both land through the single arguments below. */
export const ARMED_CHIP_CLASS = "z-30";

export const ARMED_RING_CLASS = "ring-2 ring-accent ring-offset-1 ring-offset-surface";

/** One `cx` argument, so exactly one `shadow-*` lands — a base `shadow-sm` alongside the lift's
 *  `shadow-md` both landed, and CSS source order gave the resting shadow the win, so the lift
 *  never rendered. Every chip's shadow comes from here; none may carry one of its own. */
export function getChipShadowClass(isLifted: boolean): string {
  return isLifted ? "shadow-md" : "shadow-sm";
}

export interface ChipState {
  isArmed: boolean;
  isSelected: boolean;
  isProvisional: boolean;
  isDragging: boolean;
}

/** One `cx` argument, so exactly one `ring-*` lands — armed stays true through a whole drag,
 *  and two arguments both emitting `ring-*` would both land with CSS source order deciding.
 *  Armed outranks the rest: dropping the lift mid-gesture reads as having lost the arm. */
export function getChipRingClass(state: ChipState): string {
  if (state.isArmed) return ARMED_RING_CLASS;
  if (state.isSelected) return "ring-2 ring-accent";
  if (state.isProvisional) return "ring-2 ring-accent/40";
  return state.isDragging ? "ring-1 ring-accent" : "";
}

/** One `cx` argument, so exactly one `z-*` lands — the lift's `z-30` and a selection's `z-20`
 *  both landed, and only CSS source order handed the lift the win. */
export function getChipZIndexClass(state: ChipState): string {
  if (state.isArmed || state.isDragging) return ARMED_CHIP_CLASS;
  return state.isSelected || state.isProvisional ? "z-20" : "";
}

/** One `cx` argument — a base `cursor-grab` and the drag's `cursor-grabbing` both landed. */
export function getChipCursorClass(isDragging: boolean): string {
  return isDragging ? "cursor-grabbing" : "cursor-grab";
}

/** One `cx` argument — two both emitting `touch-*` would both land and source order would win. */
export function getChipTouchActionClass(isArmed: boolean): string {
  return isArmed ? "touch-none" : "touch-manipulation";
}

/** Top offset (px, day-column space) of an armed chip's resize pill. Above 40px of chip the
 *  pill straddles the edge (16 out / 8 in); at or below it clears the box entirely, so the
 *  whole body stays a move target and the hit area never drops below ARMED_HANDLE_PX. */
export function getArmedHandleTop(
  edge: "top" | "bottom",
  chipTop: number,
  chipHeight: number,
): number {
  const outset = chipHeight > STRADDLE_MIN_CHIP_PX ? STRADDLE_OUTSET_PX : ARMED_HANDLE_PX;
  if (edge === "top") return chipTop - outset;
  return chipTop + chipHeight - (ARMED_HANDLE_PX - outset);
}
