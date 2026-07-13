import { describe, expect, it } from "vitest";
import type { Goal } from "../model";
import { getGoalPhase } from "../selectors";

const g = (over: Partial<Goal> = {}): Goal => ({
  id: "g1",
  valueId: "v1",
  name: "Goal",
  icon: "target",
  status: "active",
  start: "2026-04-01",
  end: "2026-06-30",
  progress: 0,
  subgoals: [],
  order: 0,
  ...over,
});

describe("getGoalPhase", () => {
  it("is upcoming before the window starts", () => {
    expect(getGoalPhase(g(), "2026-03-31")).toBe("upcoming");
  });
  it("is current within the window, endpoints inclusive", () => {
    expect(getGoalPhase(g(), "2026-04-01")).toBe("current");
    expect(getGoalPhase(g(), "2026-05-15")).toBe("current");
    expect(getGoalPhase(g(), "2026-06-30")).toBe("current");
  });
  it("is ended after the window", () => {
    expect(getGoalPhase(g(), "2026-07-01")).toBe("ended");
  });
  it("treats a single-day window as current on that day", () => {
    expect(getGoalPhase(g({ start: "2026-05-05", end: "2026-05-05" }), "2026-05-05")).toBe(
      "current",
    );
  });
  it("derives a degenerate start>end range as upcoming when today precedes start", () => {
    expect(getGoalPhase(g({ start: "2026-08-01", end: "2026-01-01" }), "2026-05-01")).toBe(
      "upcoming",
    );
  });
});
