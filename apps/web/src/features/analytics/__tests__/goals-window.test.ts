import { describe, expect, it } from "vitest";
import type { Goal } from "@/features/goals/model";
import { getGoalsInWindow } from "../selectors";

const NOW = "2026-07-15";

function goal(id: string, start: string, end: string): Goal {
  return {
    id,
    valueId: "v1",
    name: id,
    icon: "target",
    status: "active",
    start,
    end,
    progress: 0.5,
    subgoals: [],
    order: 0,
  };
}

describe("getGoalsInWindow", () => {
  it("includes a goal whose period overlaps the window", () => {
    const g = goal("overlap", "2026-07-01", "2026-07-31"); // straddles now
    expect(getGoalsInWindow([g], 30, NOW).map((x) => x.id)).toEqual(["overlap"]);
  });

  it("excludes a goal that starts after today (future)", () => {
    const g = goal("future", "2026-08-01", "2026-09-01");
    expect(getGoalsInWindow([g], 30, NOW)).toEqual([]);
  });

  it("excludes a goal that ended before the window began", () => {
    // 30-day window starts 2026-06-16; this goal ended 2026-05-31
    const g = goal("old", "2026-05-01", "2026-05-31");
    expect(getGoalsInWindow([g], 30, NOW)).toEqual([]);
  });

  it("includes a goal that ended recently, inside the window", () => {
    const g = goal("recent", "2026-06-01", "2026-07-10"); // ended 5 days ago
    expect(getGoalsInWindow([g], 30, NOW).map((x) => x.id)).toEqual(["recent"]);
  });

  it("always includes a goal with no timeframe", () => {
    const g = goal("untimed", "", "");
    expect(getGoalsInWindow([g], 7, NOW).map((x) => x.id)).toEqual(["untimed"]);
  });

  it("narrows with a shorter window", () => {
    const g = goal("edge", "2026-05-01", "2026-07-01"); // ended 14 days ago
    expect(getGoalsInWindow([g], 30, NOW).map((x) => x.id)).toEqual(["edge"]); // window back to 06-16
    expect(getGoalsInWindow([g], 7, NOW)).toEqual([]); // window back to 07-09 → misses it
  });
});
