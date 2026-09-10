export const PRESS_MOVE_TOLERANCE_PX = 10;

export interface PressPoint {
  x: number;
  y: number;
}

/** Touch and pen only, primary pointer only — a second finger must not re-arm the hold. */
export function isPressablePointer(pointer: { pointerType: string; isPrimary: boolean }): boolean {
  return pointer.pointerType !== "mouse" && pointer.isPrimary;
}

export function hasEscapedPressTolerance(origin: PressPoint, point: PressPoint): boolean {
  return Math.hypot(point.x - origin.x, point.y - origin.y) >= PRESS_MOVE_TOLERANCE_PX;
}
