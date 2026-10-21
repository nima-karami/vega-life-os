export const RING_COUNT = 5;

// Inside the bull's-eye a mid-band dot would crowd the centre, so it sits further out.
const BULLSEYE_DOT_DISTANCE = 0.14;

export interface TargetPoint {
  x: number;
  y: number;
}

/** 5 at the centre, 1 on the outer ring, null off the target. */
export function ratingFromDistance(distance: number, radius: number): number | null {
  if (!(radius > 0) || !(distance >= 0) || distance > radius) return null;
  const band = Math.min(RING_COUNT - 1, Math.floor((distance / radius) * RING_COUNT));
  return RING_COUNT - band;
}

/** A unit-radius point for a placed value; angle by list position so dots never stack. */
export function positionFor(rating: number, index: number, count: number): TargetPoint {
  const clamped = Math.min(RING_COUNT, Math.max(1, Math.round(rating)));
  const distance =
    clamped === RING_COUNT ? BULLSEYE_DOT_DISTANCE : (RING_COUNT - clamped + 0.5) / RING_COUNT;
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(1, count);
  return { x: distance * Math.cos(angle), y: distance * Math.sin(angle) };
}
