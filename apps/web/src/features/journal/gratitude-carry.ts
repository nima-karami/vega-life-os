/** Gratitude B · Carry to entry: the departure's timeline and the geometry of each line's flight. */

export type GratitudeDeparture = "kept" | "skip";

/** From the Continue tap, per the GratitudeCarry board. Reduced motion keeps every timer. */
export const CARRY_START_MS = 200;
export const DEPARTURE_END_MS: Record<GratitudeDeparture, number> = { kept: 900, skip: 360 };
const FIRST_LINE_DELAY_MS = 40;
const LINE_STAGGER_MS = 50;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CarryVector {
  /** transform-origin, local to the field: the centre of its text */
  originX: number;
  originY: number;
  /** translate that lands that centre on the target's centre */
  dx: number;
  dy: number;
  delayMs: number;
}

export function computeCarryVector(
  field: Box,
  text: { insetLeft: number; width: number },
  target: Box,
  lineIndex: number,
): CarryVector {
  const originX = text.insetLeft + text.width / 2;
  const originY = field.height / 2;
  return {
    originX,
    originY,
    dx: target.left + target.width / 2 - (field.left + originX),
    dy: target.top + target.height / 2 - (field.top + originY),
    delayMs: FIRST_LINE_DELAY_MS + lineIndex * LINE_STAGGER_MS,
  };
}
