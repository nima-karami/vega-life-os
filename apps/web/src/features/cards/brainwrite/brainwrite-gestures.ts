export type GesturePhase = "idle" | "dragging" | "committing" | "settling";

export type GesturePhaseEvent =
  | "drag-start"
  | "release-grade"
  | "release-idle"
  | "fly-off-end"
  | "recentre-end"
  | "abort";

export interface DragSample {
  /** Signed horizontal travel from the gesture origin, px (framer `info.offset.x`). */
  offsetX: number;
  /** Signed vertical travel from the gesture origin, px (framer `info.offset.y`). */
  offsetY: number;
  /** Horizontal velocity at release, px/s (framer `info.velocity.x`). */
  velocityX: number;
  /** Vertical velocity at release, px/s (framer `info.velocity.y`). */
  velocityY: number;
  /** Measured stage width. 0 until the ResizeObserver has fired. */
  cardWidthPx: number;
  /** `clientX` sampled at pointerdown, not at drag start — framer activates 3px in. */
  pointerStartClientX: number;
  /** `clientY` sampled at pointerdown. Reserved for the nav-band assertion. */
  pointerStartClientY: number;
  /** `visualViewport.width ?? innerWidth` at pointerdown — they diverge under pinch-zoom. */
  viewportWidthPx: number;
  /** Whether the card could be graded, read at pointerdown rather than at release. */
  isGradeable: boolean;
  /** Phase at the moment the end event arrived. */
  phase: GesturePhase;
  /** True for pointercancel, a fired long-press, backgrounding, or unmount. */
  isCancelled: boolean;
}

export type DragResolution =
  | { kind: "grade"; correct: boolean }
  | { kind: "bounce"; reason: "edge-void" | "not-gradeable" }
  | {
      kind: "none";
      reason:
        | "cancelled"
        | "phase-locked"
        | "unmeasured"
        | "below-threshold"
        | "direction-conflict";
    };

const GRADE_DRAG_RATIO = 0.4;
const GRADE_VELOCITY_PX_PER_S = 500;
const MIN_GRADE_TRAVEL_RATIO = 0.08;
export const EDGE_DEAD_ZONE_PX = 16;

export const MAX_DRAG_ROTATE_DEG = 10;
const GLOW_FADE_START_RATIO = 0.2;

export function isInEdgeVoid(clientX: number, viewportWidthPx: number): boolean {
  return clientX <= EDGE_DEAD_ZONE_PX || clientX >= viewportWidthPx - EDGE_DEAD_ZONE_PX;
}

const hasFiniteTravel = (sample: DragSample): boolean =>
  [sample.offsetX, sample.offsetY, sample.velocityX, sample.velocityY].every(Number.isFinite);

const passedDistanceGate = (sample: DragSample): boolean =>
  Math.abs(sample.offsetX) >= sample.cardWidthPx * GRADE_DRAG_RATIO &&
  Math.abs(sample.offsetX) > Math.abs(sample.offsetY);

// The floor and the axis comparison both matter here: the thumb arc that reproduces the
// defect clears the floor comfortably and is refused only by the axis comparison.
const passedVelocityGate = (sample: DragSample): boolean =>
  Math.abs(sample.velocityX) >= GRADE_VELOCITY_PX_PER_S &&
  Math.abs(sample.velocityX) > Math.abs(sample.velocityY) &&
  Math.abs(sample.offsetX) >= sample.cardWidthPx * MIN_GRADE_TRAVEL_RATIO;

/** Classifies a completed pointer sequence. Pure and total — the only place a gesture is decided. */
export function resolveDragOutcome(sample: DragSample): DragResolution {
  if (sample.isCancelled) return { kind: "none", reason: "cancelled" };
  if (sample.phase !== "dragging") return { kind: "none", reason: "phase-locked" };
  if (!Number.isFinite(sample.cardWidthPx) || sample.cardWidthPx <= 0) {
    return { kind: "none", reason: "unmeasured" };
  }
  if (!hasFiniteTravel(sample)) return { kind: "none", reason: "below-threshold" };

  const passedDistance = passedDistanceGate(sample);
  const passedVelocity = passedVelocityGate(sample);
  if (!passedDistance && !passedVelocity) return { kind: "none", reason: "below-threshold" };
  if (!passedDistance && Math.sign(sample.velocityX) !== Math.sign(sample.offsetX)) {
    return { kind: "none", reason: "direction-conflict" };
  }
  if (isInEdgeVoid(sample.pointerStartClientX, sample.viewportWidthPx)) {
    return { kind: "bounce", reason: "edge-void" };
  }
  if (!sample.isGradeable) return { kind: "bounce", reason: "not-gradeable" };
  return { kind: "grade", correct: sample.offsetX > 0 };
}

const PHASE_TRANSITIONS: Record<GesturePhase, Partial<Record<GesturePhaseEvent, GesturePhase>>> = {
  idle: { "drag-start": "dragging" },
  dragging: { "release-grade": "committing", "release-idle": "idle" },
  committing: { "fly-off-end": "settling" },
  settling: { "recentre-end": "idle" },
};

/** Total: an event the phase does not name leaves it alone, so an orphaned framer callback is a no-op. */
export function advanceGesturePhase(phase: GesturePhase, event: GesturePhaseEvent): GesturePhase {
  if (event === "abort") return "idle";
  return PHASE_TRANSITIONS[phase][event] ?? phase;
}

export function canDragInPhase(phase: GesturePhase, isActiveCard: boolean): boolean {
  return isActiveCard && (phase === "idle" || phase === "dragging");
}

/** What the glow and the rotation read. Zero while the gesture is vertically dominant: a page
 *  swipe is not a near-miss grade, and `dragDirectionLock` leaves `offsetX` growing regardless. */
export function computeFeedbackOffset(offsetX: number, offsetY: number): number {
  return Math.abs(offsetX) > Math.abs(offsetY) ? offsetX : 0;
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
