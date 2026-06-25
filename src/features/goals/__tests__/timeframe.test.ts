import { describe, expect, it } from "vitest";
import { periodStep, presetRangeOn } from "../timeframe";

describe("periodStep", () => {
  it("steps to the next quarter", () => {
    expect(periodStep("2026-04-15", "quarter", 1)).toEqual({
      start: "2026-07-01",
      end: "2026-09-30",
    });
  });
  it("steps to the previous quarter across a year boundary", () => {
    expect(periodStep("2026-01-10", "quarter", -1)).toEqual({
      start: "2025-10-01",
      end: "2025-12-31",
    });
  });
  it("steps a month and re-snaps to a full calendar month", () => {
    expect(periodStep("2026-01-31", "month", 1)).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });
  it("steps a year", () => {
    expect(periodStep("2026-06-01", "year", 1)).toEqual({ start: "2027-01-01", end: "2027-12-31" });
  });
});

describe("presetRangeOn", () => {
  it("returns the grain's range containing the given date (not today)", () => {
    expect(presetRangeOn("quarter", "2026-08-20")).toEqual({
      start: "2026-07-01",
      end: "2026-09-30",
    });
  });
});
