import { describe, expect, it } from "vitest";
import {
  computeDragRotationDeg,
  computeEdgeGlowOpacity,
  EDGE_DEAD_ZONE_PX,
  MAX_DRAG_ROTATE_DEG,
  resolveDragOutcome,
} from "../brainwrite-gestures";

const CARD_WIDTH = 400;

describe("resolveDragOutcome", () => {
  it("voids a drag that started inside the edge dead zone, regardless of the release", () => {
    expect(
      resolveDragOutcome({
        offsetX: 1000,
        velocityX: 5000,
        cardWidthPx: CARD_WIDTH,
        isVoidedByEdgeZone: true,
        isGradeable: true,
      }),
    ).toBe("none");
  });

  it("is silent when released below both the distance and velocity thresholds", () => {
    expect(
      resolveDragOutcome({
        offsetX: 50,
        velocityX: 100,
        cardWidthPx: CARD_WIDTH,
        isVoidedByEdgeZone: false,
        isGradeable: true,
      }),
    ).toBe("none");
  });

  it("commits grade-right past the 40% distance threshold on a gradeable card", () => {
    expect(
      resolveDragOutcome({
        offsetX: CARD_WIDTH * 0.4,
        velocityX: 0,
        cardWidthPx: CARD_WIDTH,
        isVoidedByEdgeZone: false,
        isGradeable: true,
      }),
    ).toBe("grade-right");
  });

  it("commits grade-wrong past the 40% distance threshold to the left on a gradeable card", () => {
    expect(
      resolveDragOutcome({
        offsetX: -CARD_WIDTH * 0.4,
        velocityX: 0,
        cardWidthPx: CARD_WIDTH,
        isVoidedByEdgeZone: false,
        isGradeable: true,
      }),
    ).toBe("grade-wrong");
  });

  it("commits on velocity alone, even under the distance threshold", () => {
    expect(
      resolveDragOutcome({
        offsetX: 5,
        velocityX: 600,
        cardWidthPx: CARD_WIDTH,
        isVoidedByEdgeZone: false,
        isGradeable: true,
      }),
    ).toBe("grade-right");
  });

  it("bounces a non-gradeable card dragged past the same threshold", () => {
    expect(
      resolveDragOutcome({
        offsetX: CARD_WIDTH * 0.4,
        velocityX: 0,
        cardWidthPx: CARD_WIDTH,
        isVoidedByEdgeZone: false,
        isGradeable: false,
      }),
    ).toBe("bounce");
  });
});

describe("computeDragRotationDeg", () => {
  it("is zero at zero offset", () => {
    expect(computeDragRotationDeg(0, CARD_WIDTH)).toBe(0);
  });

  it("reaches the max rotation exactly at the commit threshold", () => {
    expect(computeDragRotationDeg(CARD_WIDTH * 0.4, CARD_WIDTH)).toBeCloseTo(MAX_DRAG_ROTATE_DEG);
  });

  it("mirrors negative for a left drag", () => {
    expect(computeDragRotationDeg(-CARD_WIDTH * 0.4, CARD_WIDTH)).toBeCloseTo(-MAX_DRAG_ROTATE_DEG);
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
    expect(computeEdgeGlowOpacity(CARD_WIDTH * 0.4, CARD_WIDTH)).toBe(1);
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
  it("matches FeedCardView's reused value", () => {
    expect(EDGE_DEAD_ZONE_PX).toBe(24);
  });
});
