import { describe, expect, it } from "vitest";
import {
  AUTO_SCROLL_EDGE_PX,
  AUTO_SCROLL_MAX_PX_PER_SEC,
  computeAutoScrollVelocity,
} from "../auto-scroll";

const BOUNDS = { top: 100, bottom: 655 };

describe("computeAutoScrollVelocity", () => {
  it("a pointer clear of both edges does not scroll", () => {
    expect(computeAutoScrollVelocity(300, BOUNDS)).toBe(0);
  });

  it("the band boundary is the dead zone's edge", () => {
    expect(computeAutoScrollVelocity(BOUNDS.top + AUTO_SCROLL_EDGE_PX, BOUNDS)).toBe(0);
    expect(computeAutoScrollVelocity(BOUNDS.bottom - AUTO_SCROLL_EDGE_PX, BOUNDS)).toBe(0);
  });

  it("the rate ramps with depth into the band", () => {
    const halfway = AUTO_SCROLL_EDGE_PX / 2;
    expect(computeAutoScrollVelocity(BOUNDS.top + halfway, BOUNDS)).toBe(
      -AUTO_SCROLL_MAX_PX_PER_SEC / 2,
    );
    expect(computeAutoScrollVelocity(BOUNDS.bottom - halfway, BOUNDS)).toBe(
      AUTO_SCROLL_MAX_PX_PER_SEC / 2,
    );
  });

  it("the ceiling is the tuned 600 px/s, not whatever the ramp is expressed in", () => {
    expect(AUTO_SCROLL_MAX_PX_PER_SEC).toBe(600);
    expect(computeAutoScrollVelocity(BOUNDS.bottom - AUTO_SCROLL_EDGE_PX / 2, BOUNDS)).toBe(300);
  });

  it("the top band scrolls up and the bottom band scrolls down", () => {
    expect(computeAutoScrollVelocity(BOUNDS.top + 1, BOUNDS)).toBeLessThan(0);
    expect(computeAutoScrollVelocity(BOUNDS.bottom - 1, BOUNDS)).toBeGreaterThan(0);
  });

  it("a pointer past the scroller clamps at the maximum", () => {
    expect(computeAutoScrollVelocity(9000, BOUNDS)).toBe(AUTO_SCROLL_MAX_PX_PER_SEC);
    expect(computeAutoScrollVelocity(-9000, BOUNDS)).toBe(-AUTO_SCROLL_MAX_PX_PER_SEC);
  });
});
