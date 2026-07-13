import { describe, expect, it } from "vitest";
import { stepValue } from "../stepper";

const cfg = { step: 15, min: 1, max: 1440 };

describe("stepValue", () => {
  it("steps down on the grid", () => {
    expect(stepValue(30, -1, cfg)).toBe(15);
    expect(stepValue(45, -1, cfg)).toBe(30);
  });

  it("clamps to an off-grid floor without stranding the value", () => {
    expect(stepValue(15, -1, cfg)).toBe(1); // 0 → clamped to min 1
    expect(stepValue(1, -1, cfg)).toBe(1); // already at floor, stays
  });

  it("snaps back onto the grid when stepping up from the off-grid floor", () => {
    // the reported bug: 1 + 15 used to give 16 and stay off-grid forever
    expect(stepValue(1, 1, cfg)).toBe(15);
  });

  it("re-aligns an already off-grid value to the grid", () => {
    expect(stepValue(16, 1, cfg)).toBe(30);
    expect(stepValue(16, -1, cfg)).toBe(15);
  });

  it("steps up on the grid", () => {
    expect(stepValue(30, 1, cfg)).toBe(45);
  });

  it("clamps to max", () => {
    expect(stepValue(1440, 1, cfg)).toBe(1440);
    expect(stepValue(1435, 1, cfg)).toBe(1440);
  });
});
