import { describe, expect, it } from "vitest";
import { computeCarryVector } from "./gratitude-carry";

const pill = { left: 260, top: 90, width: 120, height: 36 };

describe("computeCarryVector", () => {
  it("lands the centre of the text, not of the field, on the pill's centre", () => {
    const field = { left: 16, top: 412, width: 358, height: 46 };
    const vector = computeCarryVector(field, { insetLeft: 14, width: 100 }, pill, 0);
    expect(vector.originX).toBe(64);
    expect(vector.originY).toBe(23);
    expect(field.left + vector.originX + vector.dx).toBe(320);
    expect(field.top + vector.originY + vector.dy).toBe(108);
  });

  it("matches the board's first-line vector for its layout", () => {
    const vector = computeCarryVector(
      { left: 16, top: 412, width: 358, height: 46 },
      { insetLeft: 14, width: 100 },
      { left: 258, top: 90, width: 100, height: 36 },
      0,
    );
    expect(vector.dx).toBe(228);
    expect(vector.dy).toBe(-327);
  });

  it("staggers each written line 50ms after the first's 40ms", () => {
    const field = { left: 0, top: 0, width: 300, height: 40 };
    const text = { insetLeft: 12, width: 80 };
    expect(computeCarryVector(field, text, pill, 0).delayMs).toBe(40);
    expect(computeCarryVector(field, text, pill, 1).delayMs).toBe(90);
    expect(computeCarryVector(field, text, pill, 2).delayMs).toBe(140);
  });
});
