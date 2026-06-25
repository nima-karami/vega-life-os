import { describe, expect, it } from "vitest";
import { onlyDay, rangeDays, toggleDay } from "../day-select";

describe("day-select", () => {
  it("toggleDay flips one day, leaves others", () => {
    expect(toggleDay([1, 1, 1, 1, 1, 1, 1], 2)).toEqual([1, 1, 0, 1, 1, 1, 1]);
    expect(toggleDay([0, 0, 0, 0, 0, 0, 0], 0)).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });

  it("onlyDay isolates a single day", () => {
    expect(onlyDay(4)).toEqual([0, 0, 0, 0, 1, 0, 0]);
    expect(onlyDay(0)).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });

  it("rangeDays turns on the inclusive span, keeping prior selections", () => {
    // Mon(0) → Fri(4) range
    expect(rangeDays([0, 0, 0, 0, 0, 0, 0], 0, 4)).toEqual([1, 1, 1, 1, 1, 0, 0]);
    // order-independent (anchor after target)
    expect(rangeDays([0, 0, 0, 0, 0, 0, 0], 4, 0)).toEqual([1, 1, 1, 1, 1, 0, 0]);
    // additive — a weekend day already on stays on
    expect(rangeDays([0, 0, 0, 0, 0, 1, 0], 1, 2)).toEqual([0, 1, 1, 0, 0, 1, 0]);
  });
});
