import { describe, expect, it } from "vitest";
import { computeMonthElapsedFraction, derivePaceBarShape } from "../primitives/pace-bar";

describe("the pace bar's fill", () => {
  it("fills the fraction of the budget that has been spent", () => {
    expect(derivePaceBarShape(24010, 70000)).toEqual({
      fillFraction: 0.343,
      hasFill: true,
      isOverBudget: false,
    });
  });

  it("fills the whole track and reads as a breach once spend passes the budget", () => {
    const shape = derivePaceBarShape(19630, 18000);
    expect(shape.fillFraction).toBe(1);
    expect(shape.isOverBudget).toBe(true);
  });

  it("emits no fill at all for a category with nothing spent", () => {
    expect(derivePaceBarShape(0, 24000)).toEqual({
      fillFraction: 0,
      hasFill: false,
      isOverBudget: false,
    });
  });

  it("counts any spend against an absent budget as over — nothing was planned", () => {
    expect(derivePaceBarShape(5000, 0)).toEqual({
      fillFraction: 1,
      hasFill: true,
      isOverBudget: true,
    });
    expect(derivePaceBarShape(0, 0).isOverBudget).toBe(false);
  });
});

describe("the today tick", () => {
  it("sits at the day's fraction of the scoped month", () => {
    expect(computeMonthElapsedFraction("2026-08", new Date(2026, 7, 12))).toBeCloseTo(12 / 31, 6);
  });

  it("moves with the month's length rather than sitting at a constant", () => {
    expect(computeMonthElapsedFraction("2026-02", new Date(2026, 1, 12))).toBeCloseTo(12 / 28, 6);
  });

  it("is fully elapsed for a past month and unstarted for one still ahead", () => {
    expect(computeMonthElapsedFraction("2026-07", new Date(2026, 7, 12))).toBe(1);
    expect(computeMonthElapsedFraction("2026-09", new Date(2026, 7, 12))).toBe(0);
  });
});
