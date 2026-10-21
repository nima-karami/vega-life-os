import { describe, expect, it } from "vitest";
import { positionFor, ratingFromDistance } from "../bullseye-geometry";

describe("ratingFromDistance", () => {
  it("maps the centre to 5 and the outer ring to 1", () => {
    expect(ratingFromDistance(0, 100)).toBe(5);
    expect(ratingFromDistance(19.9, 100)).toBe(5);
    expect(ratingFromDistance(20, 100)).toBe(4);
    expect(ratingFromDistance(50, 100)).toBe(3);
    expect(ratingFromDistance(79.9, 100)).toBe(2);
    expect(ratingFromDistance(80, 100)).toBe(1);
  });

  it("counts the outer edge as on the target", () => {
    expect(ratingFromDistance(100, 100)).toBe(1);
  });

  it("is unrated outside the target", () => {
    expect(ratingFromDistance(100.1, 100)).toBeNull();
    expect(ratingFromDistance(400, 100)).toBeNull();
  });

  it("is unrated for a nonsense distance", () => {
    expect(ratingFromDistance(Number.NaN, 100)).toBeNull();
    expect(ratingFromDistance(-1, 100)).toBeNull();
    expect(ratingFromDistance(10, 0)).toBeNull();
  });

  it("scales with the radius", () => {
    expect(ratingFromDistance(29, 150)).toBe(5);
    expect(ratingFromDistance(30, 150)).toBe(4);
    expect(ratingFromDistance(140, 150)).toBe(1);
  });
});

describe("positionFor", () => {
  it("lands back in the ring of its own rating", () => {
    for (let rating = 1; rating <= 5; rating += 1) {
      for (let index = 0; index < 8; index += 1) {
        const point = positionFor(rating, index, 8);
        expect(ratingFromDistance(Math.hypot(point.x, point.y), 1)).toBe(rating);
      }
    }
  });

  it("puts the first value straight up", () => {
    const point = positionFor(1, 0, 4);
    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeLessThan(0);
  });

  it("spreads values evenly by index", () => {
    const right = positionFor(3, 1, 4);
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBeCloseTo(0);
    const down = positionFor(3, 2, 4);
    expect(down.x).toBeCloseTo(0);
    expect(down.y).toBeGreaterThan(0);
  });

  it("keeps bull's-eye dots apart for a full value list", () => {
    const first = positionFor(5, 0, 8);
    const second = positionFor(5, 1, 8);
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThan(0.1);
  });

  it("clamps an out-of-range rating onto the target", () => {
    const tooHigh = positionFor(9, 0, 1);
    expect(ratingFromDistance(Math.hypot(tooHigh.x, tooHigh.y), 1)).toBe(5);
    const tooLow = positionFor(0, 0, 1);
    expect(ratingFromDistance(Math.hypot(tooLow.x, tooLow.y), 1)).toBe(1);
  });
});
