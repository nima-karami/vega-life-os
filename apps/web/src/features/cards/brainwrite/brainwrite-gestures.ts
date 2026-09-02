export type GesturePhase = "idle" | "dragging" | "committing" | "settling";

export type GesturePhaseEvent =
  | "drag-start"
  | "release-grade"
  | "release-idle"
  | "fly-off-end"
  | "recentre-end"
  | "abort";

export type GestureAxis = "undecided" | "x" | "y";

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
  /** The axis committed to during the drag, never re-derived from where the gesture ended. */
  axis: GestureAxis;
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
        | "axis-locked"
        | "below-threshold"
        | "direction-conflict";
    };

const GRADE_DRAG_RATIO = 0.4;
const GRADE_VELOCITY_PX_PER_S = 500;
const MIN_GRADE_TRAVEL_RATIO = 0.08;
const FLICK_CONE_DEG = 40;
export const EDGE_DEAD_ZONE_PX = 16;

export const AXIS_SLOP_PX = 10;
export const SWIPE_CONE_DEG = 45;
export const AXIS_RECLAIM_TRAVEL_PX = 44;
export const AXIS_RECLAIM_DRIFT_PX = 24;

export const MAX_DRAG_ROTATE_DEG = 10;
const GLOW_FADE_START_RATIO = 0.2;
const DEGREES_PER_RADIAN = 180 / Math.PI;

export function isInEdgeVoid(clientX: number, viewportWidthPx: number): boolean {
  return clientX <= EDGE_DEAD_ZONE_PX || clientX >= viewportWidthPx - EDGE_DEAD_ZONE_PX;
}

/** Strictly inside, so an exact 45° diagonal falls outside a 45° cone — the boundary the
 *  retired end-state dominance test drew, kept so no gesture changes side. */
const isWithinConeOfHorizontal = (deltaX: number, deltaY: number, coneDeg: number): boolean =>
  Math.atan2(Math.abs(deltaY), Math.abs(deltaX)) * DEGREES_PER_RADIAN < coneDeg;

/** Pure and total. Reads the accumulated origin→current vector, not the frame delta, so an
 *  arc's curvature averages out instead of flipping the lock frame by frame. */
export function classifyGestureAxis(
  current: GestureAxis,
  offsetX: number,
  offsetY: number,
): GestureAxis {
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return current;
  if (current === "x") return current;
  if (current === "y") {
    const canReclaim =
      Math.abs(offsetY) <= AXIS_RECLAIM_DRIFT_PX && Math.abs(offsetX) >= AXIS_RECLAIM_TRAVEL_PX;
    return canReclaim ? "x" : "y";
  }
  if (Math.hypot(offsetX, offsetY) < AXIS_SLOP_PX) return "undecided";
  return isWithinConeOfHorizontal(offsetX, offsetY, SWIPE_CONE_DEG) ? "x" : "y";
}

const hasFiniteTravel = (sample: DragSample): boolean =>
  [sample.offsetX, sample.offsetY, sample.velocityX, sample.velocityY].every(Number.isFinite);

const passedDistanceGate = (sample: DragSample): boolean =>
  Math.abs(sample.offsetX) >= sample.cardWidthPx * GRADE_DRAG_RATIO;

// This path commits on 8% of travel, so unlike the distance path it still wants the release
// direction to corroborate the axis the drag committed to.
const passedVelocityGate = (sample: DragSample): boolean =>
  Math.abs(sample.velocityX) >= GRADE_VELOCITY_PX_PER_S &&
  Math.abs(sample.offsetX) >= sample.cardWidthPx * MIN_GRADE_TRAVEL_RATIO &&
  isWithinConeOfHorizontal(sample.velocityX, sample.velocityY, FLICK_CONE_DEG);

/** Classifies a completed pointer sequence. Pure and total — the only place a gesture is decided. */
export function resolveDragOutcome(sample: DragSample): DragResolution {
  if (sample.isCancelled) return { kind: "none", reason: "cancelled" };
  if (sample.phase !== "dragging") return { kind: "none", reason: "phase-locked" };
  if (!Number.isFinite(sample.cardWidthPx) || sample.cardWidthPx <= 0) {
    return { kind: "none", reason: "unmeasured" };
  }
  if (!hasFiniteTravel(sample)) return { kind: "none", reason: "below-threshold" };
  if (sample.axis !== "x") return { kind: "none", reason: "axis-locked" };

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

/** The window a committed grade owns. It ends on its own fly-off and recentre, never on an abort. */
export function isExitPhase(phase: GesturePhase): boolean {
  return phase === "committing" || phase === "settling";
}

/** Total: an event the phase does not name leaves it alone, so an orphaned framer callback is a no-op. */
export function advanceGesturePhase(phase: GesturePhase, event: GesturePhaseEvent): GesturePhase {
  if (event === "abort") return isExitPhase(phase) ? phase : "idle";
  return PHASE_TRANSITIONS[phase][event] ?? phase;
}

export function canDragInPhase(phase: GesturePhase, isActiveCard: boolean): boolean {
  return isActiveCard && (phase === "idle" || phase === "dragging");
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
