import { describe, expect, it } from "vitest";
import {
  AXIS_RECLAIM_DRIFT_PX,
  AXIS_RECLAIM_TRAVEL_PX,
  AXIS_SLOP_PX,
  advanceGesturePhase,
  canDragInPhase,
  classifyGestureAxis,
  computeDragRotationDeg,
  computeEdgeGlowOpacity,
  type DragResolution,
  type DragSample,
  EDGE_DEAD_ZONE_PX,
  type GestureAxis,
  type GesturePhase,
  type GesturePhaseEvent,
  isExitPhase,
  isInEdgeVoid,
  MAX_DRAG_ROTATE_DEG,
  resolveDragOutcome,
  SWIPE_CONE_DEG,
} from "../brainwrite-gestures";

const CARD_WIDTH = 400;
const PHONE_WIDTH = 412;
const COMMIT_DISTANCE = CARD_WIDTH * 0.4;
const TRAVEL_FLOOR = CARD_WIDTH * 0.08;

function buildSample(over: Partial<DragSample> = {}): DragSample {
  return {
    offsetX: 0,
    offsetY: 0,
    velocityX: 0,
    velocityY: 0,
    cardWidthPx: CARD_WIDTH,
    pointerStartClientX: PHONE_WIDTH / 2,
    pointerStartClientY: 400,
    viewportWidthPx: PHONE_WIDTH,
    isGradeable: true,
    phase: "dragging",
    isCancelled: false,
    axis: "x",
    ...over,
  };
}

/** A flick of `speedPxPerSec` at `degreesOffVertical`, sampled after `seconds` of travel. Its
 *  axis comes from the arbiter reading the same vector, so the sweep exercises the real lock. */
function buildFlick(degreesOffVertical: number, speedPxPerSec: number, seconds = 0.25): DragSample {
  const radians = (degreesOffVertical * Math.PI) / 180;
  const distance = speedPxPerSec * seconds;
  const offsetX = distance * Math.sin(radians);
  const offsetY = -distance * Math.cos(radians);
  return buildSample({
    cardWidthPx: PHONE_WIDTH,
    offsetX,
    offsetY,
    velocityX: speedPxPerSec * Math.sin(radians),
    velocityY: -speedPxPerSec * Math.cos(radians),
    axis: classifyGestureAxis("undecided", offsetX, offsetY),
  });
}

describe("resolveDragOutcome rule 1 — a cancelled gesture never grades", () => {
  it("refuses a cancel that arrived past the commit threshold", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE, isCancelled: true })),
    ).toEqual({ kind: "none", reason: "cancelled" });
  });

  it("reads a cancel during the fly-off as cancelled, not phase-locked", () => {
    expect(
      resolveDragOutcome(
        buildSample({ offsetX: COMMIT_DISTANCE, phase: "committing", isCancelled: true }),
      ),
    ).toEqual({ kind: "none", reason: "cancelled" });
  });

  it("outranks the edge void and gradeability alike", () => {
    expect(
      resolveDragOutcome(
        buildSample({
          offsetX: COMMIT_DISTANCE,
          pointerStartClientX: 2,
          isGradeable: false,
          isCancelled: true,
        }),
      ),
    ).toEqual({ kind: "none", reason: "cancelled" });
  });
});

describe("resolveDragOutcome rule 2 — the phase gate", () => {
  const orphanPhases: GesturePhase[] = ["idle", "committing", "settling"];

  for (const phase of orphanPhases) {
    it(`rejects an end event that arrived while ${phase}`, () => {
      expect(resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE, phase }))).toEqual({
        kind: "none",
        reason: "phase-locked",
      });
    });
  }

  it("lets a live drag through to the measurable rules", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE, phase: "dragging" })),
    ).toEqual({ kind: "grade", correct: true });
  });
});

describe("resolveDragOutcome rule 3 — an unmeasured stage refuses to grade", () => {
  it("refuses a fast flick before the first layout", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: 200, velocityX: 3000, cardWidthPx: 0 })),
    ).toEqual({ kind: "none", reason: "unmeasured" });
  });

  it("refuses a non-finite stage width", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: 200, velocityX: 3000, cardWidthPx: Number.NaN })),
    ).toEqual({ kind: "none", reason: "unmeasured" });
    expect(
      resolveDragOutcome(
        buildSample({
          offsetX: 200,
          velocityX: 3000,
          cardWidthPx: Number.POSITIVE_INFINITY,
        }),
      ),
    ).toEqual({ kind: "none", reason: "unmeasured" });
  });

  it("refuses a negative stage width", () => {
    expect(resolveDragOutcome(buildSample({ offsetX: 200, cardWidthPx: -10 }))).toEqual({
      kind: "none",
      reason: "unmeasured",
    });
  });
});

describe("resolveDragOutcome rule 4 — a degenerate sample is total, not a crash", () => {
  const degenerate: Partial<DragSample>[] = [
    { offsetX: Number.NaN },
    { offsetX: Number.NEGATIVE_INFINITY },
    { offsetY: Number.NaN },
    { velocityX: Number.NEGATIVE_INFINITY },
    { velocityY: Number.NaN },
  ];

  for (const over of degenerate) {
    it(`refuses a sample carrying ${Object.keys(over)[0]} = ${Object.values(over)[0]}`, () => {
      expect(resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE, ...over }))).toEqual({
        kind: "none",
        reason: "below-threshold",
      });
    });
  }
});

describe("resolveDragOutcome rule 5 — the axis lock", () => {
  const refusedAxes: GestureAxis[] = ["undecided", "y"];

  for (const axis of refusedAxes) {
    it(`refuses an ${axis} gesture however far it travelled`, () => {
      expect(resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE * 2, axis }))).toEqual({
        kind: "none",
        reason: "axis-locked",
      });
    });
  }

  it("refuses a y-locked flick that would otherwise clear the velocity gate", () => {
    expect(
      resolveDragOutcome(
        buildSample({ offsetX: TRAVEL_FLOOR, velocityX: 900, velocityY: 0, axis: "y" }),
      ),
    ).toEqual({ kind: "none", reason: "axis-locked" });
  });

  // What the retired end-state dominance refused as "exactly diagonal". The arbiter refuses it
  // a step earlier — at 10px of travel — so the card never tilted in the first place.
  it("refuses an exactly diagonal gesture, because it never locked to x", () => {
    const axis = classifyGestureAxis("undecided", COMMIT_DISTANCE, -COMMIT_DISTANCE);
    expect(axis).toBe("y");
    expect(
      resolveDragOutcome(
        buildSample({ offsetX: COMMIT_DISTANCE, offsetY: -COMMIT_DISTANCE, axis }),
      ),
    ).toEqual({ kind: "none", reason: "axis-locked" });
  });

  it("refuses a vertically dominant gesture that also cleared the distance gate", () => {
    const axis = classifyGestureAxis("undecided", 200, -300);
    expect(axis).toBe("y");
    expect(resolveDragOutcome(buildSample({ offsetX: 200, offsetY: -300, axis }))).toEqual({
      kind: "none",
      reason: "axis-locked",
    });
  });
});

describe("resolveDragOutcome rule 6 — the distance and velocity thresholds", () => {
  it("commits exactly at the 40% distance threshold", () => {
    expect(resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE }))).toEqual({
      kind: "grade",
      correct: true,
    });
  });

  it("refuses a hair under the distance threshold with no velocity", () => {
    expect(resolveDragOutcome(buildSample({ offsetX: CARD_WIDTH * 0.399 }))).toEqual({
      kind: "none",
      reason: "below-threshold",
    });
  });

  // The reported snap-back: the card tracked the finger across 40% of its width, the thumb
  // curled upward on the way out, and the retired dominance term threw the grade away.
  it("grades an x-locked arc past the distance gate even though it ended vertical", () => {
    expect(resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE, offsetY: -300 }))).toEqual({
      kind: "grade",
      correct: true,
    });
  });

  it("refuses a fast x-locked gesture whose release fell outside the flick cone", () => {
    expect(
      resolveDragOutcome(
        buildSample({ offsetX: 100, offsetY: -200, velocityX: 600, velocityY: -700 }),
      ),
    ).toEqual({ kind: "none", reason: "below-threshold" });
  });

  it("refuses velocity with no meaningful horizontal travel", () => {
    expect(
      resolveDragOutcome(
        buildSample({
          cardWidthPx: PHONE_WIDTH,
          offsetX: 5,
          velocityX: 600,
          velocityY: 100,
        }),
      ),
    ).toEqual({ kind: "none", reason: "below-threshold" });
  });

  it("commits at exactly the 8% travel floor", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: TRAVEL_FLOOR, velocityX: 600, velocityY: 100 })),
    ).toEqual({ kind: "grade", correct: true });
  });

  it("refuses a hair under the velocity gate at a sub-threshold distance", () => {
    expect(resolveDragOutcome(buildSample({ offsetX: CARD_WIDTH * 0.39, velocityX: 499 }))).toEqual(
      { kind: "none", reason: "below-threshold" },
    );
  });

  it("refuses R10's diagonal flick — 12 degrees off vertical at 800px/s", () => {
    expect(resolveDragOutcome(buildFlick(12, 800))).toEqual({
      kind: "none",
      reason: "axis-locked",
    });
  });

  it("refuses the same geometry at 2950px/s, where the incidental vx clears the gate", () => {
    const sample = buildFlick(12, 2950);
    expect(Math.abs(sample.velocityX)).toBeGreaterThan(500);
    expect(resolveDragOutcome(sample)).toEqual({ kind: "none", reason: "axis-locked" });
  });

  // The one gesture real touch actually reproduced (evidence/e2e-red.md). Its opening 40px
  // sideways nudge genuinely locks the axis to x, so the arbiter cannot be what refuses it:
  // the distance gate (152px against 164.8px) and the 40-degree flick cone are.
  it("refuses the measured thumb arc — 152px across against 425px up at 621px/s", () => {
    const sample = buildSample({
      cardWidthPx: PHONE_WIDTH,
      offsetX: 152,
      offsetY: -425,
      velocityX: 621,
      velocityY: -2318,
      axis: "x",
    });
    expect(Math.abs(sample.offsetX)).toBeLessThan(PHONE_WIDTH * 0.4);
    expect(Math.abs(sample.offsetX)).toBeGreaterThan(PHONE_WIDTH * 0.08);
    expect(resolveDragOutcome(sample)).toEqual({ kind: "none", reason: "below-threshold" });
  });

  it("refuses the field-realistic thumb arc — 30 degrees off vertical at 1100px/s", () => {
    const sample = buildFlick(30, 1100);
    expect(Math.abs(sample.velocityX)).toBeGreaterThan(500);
    expect(resolveDragOutcome(sample)).toEqual({ kind: "none", reason: "axis-locked" });
  });

  // The invariant behind A1/A2, swept rather than sampled at one point (rulings round 2, D0).
  for (const degrees of [5, 12, 30, 45]) {
    for (const speed of [800, 1500, 2950]) {
      it(`never grades a dominantly-vertical flick at ${degrees} degrees, ${speed}px/s`, () => {
        expect(resolveDragOutcome(buildFlick(degrees, speed)).kind).not.toBe("grade");
      });
    }
  }
});

describe("resolveDragOutcome rule 7 — a flick-back refuses rather than guessing", () => {
  it("refuses when the velocity sign disagrees with where the card ended up", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: TRAVEL_FLOOR, velocityX: -600, velocityY: 0 })),
    ).toEqual({ kind: "none", reason: "direction-conflict" });
  });

  it("mirrors for a left-sitting card flicked right", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: -TRAVEL_FLOOR, velocityX: 600, velocityY: 0 })),
    ).toEqual({ kind: "none", reason: "direction-conflict" });
  });

  it("takes the distance path's word when it passed, disagreeing velocity and all", () => {
    expect(resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE, velocityX: -600 }))).toEqual({
      kind: "grade",
      correct: true,
    });
  });
});

describe("resolveDragOutcome rule 8 — the edge dead zone", () => {
  it("voids a committing swipe that started on the left edge", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE, pointerStartClientX: 16 })),
    ).toEqual({ kind: "bounce", reason: "edge-void" });
  });

  it("voids a committing swipe that started on the right edge", () => {
    expect(
      resolveDragOutcome(
        buildSample({ offsetX: -COMMIT_DISTANCE, pointerStartClientX: PHONE_WIDTH - 16 }),
      ),
    ).toEqual({ kind: "bounce", reason: "edge-void" });
  });

  it("grades normally one pixel inside the zone", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE, pointerStartClientX: 17 })),
    ).toEqual({ kind: "grade", correct: true });
  });

  it("stays silent for an edge-started vertical scroll — the threshold gate comes first", () => {
    expect(
      resolveDragOutcome(
        buildSample({ offsetX: 20, offsetY: -300, velocityY: -900, pointerStartClientX: 4 }),
      ),
    ).toEqual({ kind: "none", reason: "below-threshold" });
  });

  it("stays silent for an edge-started sub-threshold wiggle", () => {
    expect(resolveDragOutcome(buildSample({ offsetX: 12, pointerStartClientX: 4 }))).toEqual({
      kind: "none",
      reason: "below-threshold",
    });
  });

  it("reports the edge void ahead of gradeability when both apply", () => {
    expect(
      resolveDragOutcome(
        buildSample({ offsetX: COMMIT_DISTANCE, pointerStartClientX: 4, isGradeable: false }),
      ),
    ).toEqual({ kind: "bounce", reason: "edge-void" });
  });
});

describe("isInEdgeVoid", () => {
  it("treats the zone as inclusive on both edges", () => {
    expect(isInEdgeVoid(0, PHONE_WIDTH)).toBe(true);
    expect(isInEdgeVoid(EDGE_DEAD_ZONE_PX, PHONE_WIDTH)).toBe(true);
    expect(isInEdgeVoid(EDGE_DEAD_ZONE_PX + 1, PHONE_WIDTH)).toBe(false);
    expect(isInEdgeVoid(PHONE_WIDTH - EDGE_DEAD_ZONE_PX, PHONE_WIDTH)).toBe(true);
    expect(isInEdgeVoid(PHONE_WIDTH - EDGE_DEAD_ZONE_PX - 1, PHONE_WIDTH)).toBe(false);
  });

  it("measures against the width it is handed, so a pinch-zoomed viewport still voids", () => {
    expect(isInEdgeVoid(290, 300)).toBe(true);
    expect(isInEdgeVoid(290, PHONE_WIDTH)).toBe(false);
  });
});

describe("resolveDragOutcome rule 9 — gradeability", () => {
  it("bounces a card that is not in spaced repetition", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE, isGradeable: false })),
    ).toEqual({ kind: "bounce", reason: "not-gradeable" });
  });

  it("bounces a card already reviewed today, in either direction", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: -COMMIT_DISTANCE, isGradeable: false })),
    ).toEqual({ kind: "bounce", reason: "not-gradeable" });
  });

  it("resolves from the gradeability it was handed — the pointerdown sample is the input", () => {
    expect(
      resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE, isGradeable: true })).kind,
    ).toBe("grade");
  });
});

describe("resolveDragOutcome rule 10 — the commit", () => {
  it("grades a rightward distance swipe as remembered", () => {
    expect(resolveDragOutcome(buildSample({ offsetX: COMMIT_DISTANCE }))).toEqual({
      kind: "grade",
      correct: true,
    });
  });

  it("grades a leftward distance swipe as not remembered", () => {
    expect(resolveDragOutcome(buildSample({ offsetX: -COMMIT_DISTANCE }))).toEqual({
      kind: "grade",
      correct: false,
    });
  });

  it("grades a horizontal flick that cleared the travel floor", () => {
    expect(
      resolveDragOutcome(
        buildSample({ offsetX: -TRAVEL_FLOOR - 1, velocityX: -900, velocityY: 80 }),
      ),
    ).toEqual({ kind: "grade", correct: false });
  });
});

describe("DragResolution", () => {
  it("is exhaustively reachable — every terminal value has a witness", () => {
    const witnesses: DragSample[] = [
      buildSample({ offsetX: COMMIT_DISTANCE, isCancelled: true }),
      buildSample({ offsetX: COMMIT_DISTANCE, phase: "settling" }),
      buildSample({ offsetX: 200, velocityX: 3000, cardWidthPx: 0 }),
      buildSample({ offsetX: COMMIT_DISTANCE, axis: "y" }),
      buildSample({ offsetX: 1 }),
      buildSample({ offsetX: TRAVEL_FLOOR, velocityX: -600 }),
      buildSample({ offsetX: COMMIT_DISTANCE, pointerStartClientX: 4 }),
      buildSample({ offsetX: COMMIT_DISTANCE, isGradeable: false }),
      buildSample({ offsetX: COMMIT_DISTANCE }),
      buildSample({ offsetX: -COMMIT_DISTANCE }),
    ];
    const describeResolution = (resolution: DragResolution): string =>
      resolution.kind === "grade"
        ? `grade:${resolution.correct}`
        : `${resolution.kind}:${resolution.reason}`;
    expect(
      new Set(witnesses.map((sample) => describeResolution(resolveDragOutcome(sample)))),
    ).toEqual(
      new Set([
        "none:cancelled",
        "none:phase-locked",
        "none:unmeasured",
        "none:axis-locked",
        "none:below-threshold",
        "none:direction-conflict",
        "bounce:edge-void",
        "bounce:not-gradeable",
        "grade:true",
        "grade:false",
      ]),
    );
  });
});

describe("classifyGestureAxis — the slop boundary", () => {
  it("holds undecided until the accumulated vector reaches the slop", () => {
    expect(classifyGestureAxis("undecided", AXIS_SLOP_PX - 0.001, 0)).toBe("undecided");
    expect(classifyGestureAxis("undecided", 0, -(AXIS_SLOP_PX - 0.001))).toBe("undecided");
    expect(classifyGestureAxis("undecided", 6, -7.9)).toBe("undecided");
  });

  it("decides at exactly the slop, on the vector's own angle", () => {
    expect(classifyGestureAxis("undecided", AXIS_SLOP_PX, 0)).toBe("x");
    expect(classifyGestureAxis("undecided", 6, -8)).toBe("y");
    expect(classifyGestureAxis("undecided", 8, -6)).toBe("x");
  });

  it("stays undecided at exactly zero travel", () => {
    expect(classifyGestureAxis("undecided", 0, 0)).toBe("undecided");
  });
});

describe("classifyGestureAxis — the 45 degree cone", () => {
  it("claims a vector strictly inside the cone, in all four quadrants", () => {
    expect(classifyGestureAxis("undecided", 100, -99)).toBe("x");
    expect(classifyGestureAxis("undecided", -100, -99)).toBe("x");
    expect(classifyGestureAxis("undecided", 100, 99)).toBe("x");
    expect(classifyGestureAxis("undecided", -100, 99)).toBe("x");
  });

  it("gives up a vector on or outside the cone — 45 degrees is exclusive", () => {
    expect(classifyGestureAxis("undecided", 100, -100)).toBe("y");
    expect(classifyGestureAxis("undecided", 100, -101)).toBe("y");
    expect(classifyGestureAxis("undecided", 0, -100)).toBe("y");
  });

  it("draws the cone at the same 45 degrees the retired dominance test used", () => {
    expect(SWIPE_CONE_DEG).toBe(45);
  });
});

describe("classifyGestureAxis — x is terminal", () => {
  it("never surrenders a tilting card to the scroller", () => {
    expect(classifyGestureAxis("x", 5, -500)).toBe("x");
    expect(classifyGestureAxis("x", 0, 0)).toBe("x");
    expect(classifyGestureAxis("x", -2, 900)).toBe("x");
  });
});

describe("classifyGestureAxis — reclaiming y", () => {
  it("reclaims a young gesture that travelled sideways without drifting", () => {
    expect(classifyGestureAxis("y", AXIS_RECLAIM_TRAVEL_PX, -AXIS_RECLAIM_DRIFT_PX)).toBe("x");
    expect(classifyGestureAxis("y", -AXIS_RECLAIM_TRAVEL_PX, AXIS_RECLAIM_DRIFT_PX)).toBe("x");
  });

  it("holds y a hair under the travel it demands", () => {
    expect(classifyGestureAxis("y", AXIS_RECLAIM_TRAVEL_PX - 0.001, 0)).toBe("y");
  });

  it("holds y a hair past the drift it tolerates", () => {
    expect(
      classifyGestureAxis("y", AXIS_RECLAIM_TRAVEL_PX * 4, -(AXIS_RECLAIM_DRIFT_PX + 0.001)),
    ).toBe("y");
  });

  it("keeps a real scroll locked however much the finger waggles sideways", () => {
    expect(classifyGestureAxis("y", 300, -280)).toBe("y");
  });
});

describe("classifyGestureAxis — a non-finite offset changes nothing", () => {
  const axes: GestureAxis[] = ["undecided", "x", "y"];
  const degenerate: [number, number][] = [
    [Number.NaN, 0],
    [0, Number.NaN],
    [Number.POSITIVE_INFINITY, 0],
    [200, Number.NEGATIVE_INFINITY],
  ];

  for (const axis of axes) {
    for (const [offsetX, offsetY] of degenerate) {
      it(`leaves ${axis} alone for (${offsetX}, ${offsetY})`, () => {
        expect(classifyGestureAxis(axis, offsetX, offsetY)).toBe(axis);
      });
    }
  }
});

describe("advanceGesturePhase", () => {
  const legal: [GesturePhase, GesturePhaseEvent, GesturePhase][] = [
    ["idle", "drag-start", "dragging"],
    ["dragging", "release-grade", "committing"],
    ["dragging", "release-idle", "idle"],
    ["dragging", "abort", "idle"],
    ["committing", "fly-off-end", "settling"],
    ["settling", "recentre-end", "idle"],
    ["idle", "abort", "idle"],
  ];

  for (const [from, event, to] of legal) {
    it(`moves ${from} to ${to} on ${event}`, () => {
      expect(advanceGesturePhase(from, event)).toBe(to);
    });
  }

  const phases: GesturePhase[] = ["idle", "dragging", "committing", "settling"];
  const events: GesturePhaseEvent[] = [
    "drag-start",
    "release-grade",
    "release-idle",
    "fly-off-end",
    "recentre-end",
    "abort",
  ];

  it("leaves the phase unchanged for every pair the table does not name", () => {
    const named = new Set(legal.map(([from, event]) => `${from}/${event}`));
    for (const phase of phases) {
      for (const event of events) {
        if (named.has(`${phase}/${event}`)) continue;
        expect(advanceGesturePhase(phase, event), `${phase} on ${event}`).toBe(phase);
      }
    }
  });

  it("takes a gesture that is still live to idle on abort", () => {
    expect(advanceGesturePhase("idle", "abort")).toBe("idle");
    expect(advanceGesturePhase("dragging", "abort")).toBe("idle");
  });

  // The regression this guards: a pointercancel arriving mid fly-off — Chromium reclaiming a
  // touch that landed behind the flying card — used to release the lock and let the next swipe
  // grade the same card again.
  it("refuses to abort the exit window a committed grade owns", () => {
    expect(advanceGesturePhase("committing", "abort")).toBe("committing");
    expect(advanceGesturePhase("settling", "abort")).toBe("settling");
  });
});

describe("isExitPhase", () => {
  it("names the two phases a committed grade owns", () => {
    expect(isExitPhase("committing")).toBe(true);
    expect(isExitPhase("settling")).toBe(true);
  });

  it("leaves the phases a live gesture owns", () => {
    expect(isExitPhase("idle")).toBe(false);
    expect(isExitPhase("dragging")).toBe(false);
  });
});

describe("canDragInPhase", () => {
  it("gives the drag to the centered card while it is at rest or live", () => {
    expect(canDragInPhase("idle", true)).toBe(true);
    expect(canDragInPhase("dragging", true)).toBe(true);
  });

  it("takes the drag away for the whole exit window", () => {
    expect(canDragInPhase("committing", true)).toBe(false);
    expect(canDragInPhase("settling", true)).toBe(false);
  });

  it("never gives the drag to a card that is not centered", () => {
    for (const phase of ["idle", "dragging", "committing", "settling"] as GesturePhase[]) {
      expect(canDragInPhase(phase, false)).toBe(false);
    }
  });
});

describe("computeDragRotationDeg", () => {
  it("is zero at zero offset", () => {
    expect(computeDragRotationDeg(0, CARD_WIDTH)).toBe(0);
  });

  it("reaches the max rotation exactly at the commit threshold", () => {
    expect(computeDragRotationDeg(COMMIT_DISTANCE, CARD_WIDTH)).toBeCloseTo(MAX_DRAG_ROTATE_DEG);
  });

  it("mirrors negative for a left drag", () => {
    expect(computeDragRotationDeg(-COMMIT_DISTANCE, CARD_WIDTH)).toBeCloseTo(-MAX_DRAG_ROTATE_DEG);
  });

  it("clamps beyond the commit threshold instead of overshooting", () => {
    expect(computeDragRotationDeg(CARD_WIDTH * 2, CARD_WIDTH)).toBe(MAX_DRAG_ROTATE_DEG);
  });

  it("guards against an unmeasured (zero-width) stage", () => {
    expect(computeDragRotationDeg(50, 0)).toBe(0);
  });
});

describe("computeEdgeGlowOpacity", () => {
  it("is zero below the fade-start ratio", () => {
    expect(computeEdgeGlowOpacity(CARD_WIDTH * 0.1, CARD_WIDTH)).toBe(0);
  });

  it("is fully opaque at the commit threshold", () => {
    expect(computeEdgeGlowOpacity(COMMIT_DISTANCE, CARD_WIDTH)).toBe(1);
  });

  it("ramps linearly between the fade-start ratio and the commit threshold", () => {
    expect(computeEdgeGlowOpacity(CARD_WIDTH * 0.3, CARD_WIDTH)).toBeCloseTo(0.5);
  });

  it("treats left and right drags symmetrically", () => {
    expect(computeEdgeGlowOpacity(-CARD_WIDTH * 0.3, CARD_WIDTH)).toBeCloseTo(0.5);
  });

  it("clamps at 1 past the commit threshold", () => {
    expect(computeEdgeGlowOpacity(CARD_WIDTH * 0.9, CARD_WIDTH)).toBe(1);
  });

  it("guards against an unmeasured (zero-width) stage", () => {
    expect(computeEdgeGlowOpacity(50, 0)).toBe(0);
  });
});

describe("EDGE_DEAD_ZONE_PX", () => {
  it("is the shrunk 16px zone, not the 24px one that ate deliberate swipes", () => {
    expect(EDGE_DEAD_ZONE_PX).toBe(16);
  });
});
