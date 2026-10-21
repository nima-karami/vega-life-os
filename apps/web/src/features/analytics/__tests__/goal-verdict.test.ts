import { describe, expect, it } from "vitest";
import type { Goal } from "@/features/goals/model";
import { computeGoalVerdict } from "../selectors";

function goal(patch: Partial<Goal>): Goal {
  return {
    id: "g1",
    valueId: "v1",
    name: "Goal",
    icon: "target",
    status: "active",
    start: "2026-01-01",
    end: "2026-12-31",
    progress: 0.5,
    subgoals: [],
    order: 0,
    ...patch,
  };
}

const TODAY = "2026-07-02"; // ~half the year elapsed

describe("computeGoalVerdict", () => {
  it("a done goal is Completed, never a pace verdict", () => {
    // progress 1.0 mid-year would read 'on pace' under the old math — must be Completed
    expect(computeGoalVerdict(goal({ status: "done", progress: 1 }), TODAY)).toEqual({
      kind: "completed",
    });
    // even a done goal with low progress is Completed, not "behind"
    expect(computeGoalVerdict(goal({ status: "done", progress: 0.1 }), TODAY)).toEqual({
      kind: "completed",
    });
  });

  it("an abandoned goal is Closed, never a pace verdict", () => {
    expect(computeGoalVerdict(goal({ status: "abandoned", progress: 0.9 }), TODAY)).toEqual({
      kind: "closed",
    });
  });

  it("an in-progress goal keeps a pace verdict", () => {
    const behind = computeGoalVerdict(goal({ status: "active", progress: 0.1 }), TODAY);
    expect(behind.kind).toBe("pace");
    if (behind.kind === "pace") expect(behind.text).toBe("Slower than planned — still want this?");

    const onPace = computeGoalVerdict(goal({ status: "active", progress: 0.9 }), TODAY);
    expect(onPace.kind).toBe("pace");
    if (onPace.kind === "pace") expect(onPace.text).toBe("On pace");
  });
});
