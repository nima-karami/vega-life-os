export type DragOutcome = "grade-right" | "grade-wrong" | "bounce" | "none";

// Reused verbatim from FeedCardView — the drag mechanics are shared; only the
// gradeable/non-gradeable gating below is new.
const GRADE_DRAG_RATIO = 0.4;
const GRADE_VELOCITY = 500;
export const EDGE_DEAD_ZONE_PX = 24;

export const MAX_DRAG_ROTATE_DEG = 10;
const GLOW_FADE_START_RATIO = 0.2;

export function resolveDragOutcome(params: {
  offsetX: number;
  velocityX: number;
  cardWidthPx: number;
  isVoidedByEdgeZone: boolean;
  isGradeable: boolean;
}): DragOutcome {
  const { offsetX, velocityX, cardWidthPx, isVoidedByEdgeZone, isGradeable } = params;
  if (isVoidedByEdgeZone) return "none";
  const passedDistance = cardWidthPx > 0 && Math.abs(offsetX) >= cardWidthPx * GRADE_DRAG_RATIO;
  const passedVelocity = Math.abs(velocityX) >= GRADE_VELOCITY;
  if (!passedDistance && !passedVelocity) return "none";
  if (!isGradeable) return "bounce";
  return offsetX > 0 ? "grade-right" : "grade-wrong";
}

export function computeDragRotationDeg(offsetX: number, cardWidthPx: number): number {
  if (cardWidthPx <= 0) return 0;
  const ratio = offsetX / (cardWidthPx * GRADE_DRAG_RATIO);
  return Math.max(-MAX_DRAG_ROTATE_DEG, Math.min(MAX_DRAG_ROTATE_DEG, ratio * MAX_DRAG_ROTATE_DEG));
}

export function computeEdgeGlowOpacity(offsetX: number, cardWidthPx: number): number {
  if (cardWidthPx <= 0) return 0;
  const ratio = Math.abs(offsetX) / cardWidthPx;
  if (ratio <= GLOW_FADE_START_RATIO) return 0;
  return Math.min(1, (ratio - GLOW_FADE_START_RATIO) / (GRADE_DRAG_RATIO - GLOW_FADE_START_RATIO));
}
