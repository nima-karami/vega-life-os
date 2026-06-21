import { describe, expect, it } from "vitest";
import { DEFAULT_RANGE, RANGE_OPTIONS, rangeToDays, rangeToWeeks, type TimeRange } from "../range";

describe("analytics time-range mapping", () => {
  it("exposes the fixed set of range options in order", () => {
    expect(RANGE_OPTIONS.map((o) => o.id)).toEqual(["7d", "28d", "90d", "1y"]);
  });

  it("every option has a human label", () => {
    for (const o of RANGE_OPTIONS) {
      expect(o.label.length).toBeGreaterThan(0);
    }
  });

  it("defaults to 28d (the most common selector window)", () => {
    expect(DEFAULT_RANGE).toBe("28d");
  });

  it("maps each range to the spec's day count", () => {
    expect(rangeToDays("7d")).toBe(7);
    expect(rangeToDays("28d")).toBe(28);
    expect(rangeToDays("90d")).toBe(90);
    expect(rangeToDays("1y")).toBe(365);
  });

  it("maps each range to ceil(days/7) weeks for the weekly trend", () => {
    expect(rangeToWeeks("7d")).toBe(1);
    expect(rangeToWeeks("28d")).toBe(4);
    expect(rangeToWeeks("90d")).toBe(13);
    expect(rangeToWeeks("1y")).toBe(53);
  });

  it("rangeToWeeks is always at least 1", () => {
    for (const o of RANGE_OPTIONS) {
      expect(rangeToWeeks(o.id)).toBeGreaterThanOrEqual(1);
    }
  });

  it("RANGE_OPTIONS ids are assignable to TimeRange", () => {
    const ids: TimeRange[] = RANGE_OPTIONS.map((o) => o.id);
    expect(ids).toContain(DEFAULT_RANGE);
  });
});
