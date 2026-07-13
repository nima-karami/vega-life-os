import { describe, expect, it } from "vitest";
import { getOnlyDay, getRangeDays, toggleDay } from "../day-select";

describe("day-select", () => {
  it("toggleDay flips one day, leaves others", () => {
    expect(toggleDay([1, 1, 1, 1, 1, 1, 1], 2)).toEqual([1, 1, 0, 1, 1, 1, 1]);
    expect(toggleDay([0, 0, 0, 0, 0, 0, 0], 0)).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });

  it("getOnlyDay isolates a single day", () => {
    expect(getOnlyDay(4)).toEqual([0, 0, 0, 0, 1, 0, 0]);
    expect(getOnlyDay(0)).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });

  it("getRangeDays turns on the inclusive span, keeping prior selections", () => {
    // Mon(0) → Fri(4) range
    expect(getRangeDays([0, 0, 0, 0, 0, 0, 0], 0, 4)).toEqual([1, 1, 1, 1, 1, 0, 0]);
    // order-independent (anchor after target)
    expect(getRangeDays([0, 0, 0, 0, 0, 0, 0], 4, 0)).toEqual([1, 1, 1, 1, 1, 0, 0]);
    // additive — a weekend day already on stays on
    expect(getRangeDays([0, 0, 0, 0, 0, 1, 0], 1, 2)).toEqual([0, 1, 1, 0, 0, 1, 0]);
  });
});
