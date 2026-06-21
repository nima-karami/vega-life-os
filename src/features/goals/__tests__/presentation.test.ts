import { describe, expect, it } from "vitest";
import type { Goal } from "../model";
import {
  goalPaceBadge,
  goalProgressIsDerived,
  goalProgressPercent,
  statusChangePatch,
} from "../presentation";

const baseGoal = (over: Partial<Goal> = {}): Goal => ({
  id: "g1",
  valueId: "v1",
  name: "Goal",
  icon: "target",
  status: "active",
  start: "2026-01-01",
  end: "2026-12-31",
  progress: 0,
  subgoals: [],
  order: 0,
  ...over,
});

describe("goalProgressPercent", () => {
  it("rounds a 0..1 fraction to an integer percent", () => {
    expect(goalProgressPercent(baseGoal({ progress: 0.25 }))).toBe(25);
    expect(goalProgressPercent(baseGoal({ progress: 0.555 }))).toBe(56);
    expect(goalProgressPercent(baseGoal({ progress: 0 }))).toBe(0);
    expect(goalProgressPercent(baseGoal({ progress: 1 }))).toBe(100);
  });
});

describe("goalProgressIsDerived", () => {
  it("is derived (read-only) when the goal has subgoals", () => {
    expect(
      goalProgressIsDerived(baseGoal({ subgoals: [{ id: "s1", name: "a", done: false }] })),
    ).toBe(true);
  });

  it("is manual (settable) when there are no subgoals", () => {
    expect(goalProgressIsDerived(baseGoal({ subgoals: [] }))).toBe(false);
  });
});

describe("goalPaceBadge", () => {
  it("returns null for closed goals (done/abandoned) so no pace badge shows", () => {
    expect(goalPaceBadge(baseGoal({ status: "done" }))).toBeNull();
    expect(goalPaceBadge(baseGoal({ status: "abandoned" }))).toBeNull();
  });

  it("reports on-pace when progress is at or ahead of elapsed time", () => {
    // window fully elapsed (past dates), progress 1 => ahead
    const badge = goalPaceBadge(
      baseGoal({ start: "2020-01-01", end: "2020-12-31", progress: 1, status: "active" }),
    );
    expect(badge).toEqual({ behind: false, text: "on pace" });
  });

  it("reports how far behind when progress trails elapsed time", () => {
    // fully elapsed window, 0 progress => 100% behind
    const badge = goalPaceBadge(
      baseGoal({ start: "2020-01-01", end: "2020-12-31", progress: 0, status: "active" }),
    );
    expect(badge).toEqual({ behind: true, text: "100% behind" });
  });
});

describe("statusChangePatch", () => {
  it("forces progress to 1 when moving to done", () => {
    expect(statusChangePatch("done")).toEqual({ status: "done", progress: 1 });
  });

  it("leaves progress untouched for non-done statuses", () => {
    expect(statusChangePatch("abandoned")).toEqual({ status: "abandoned" });
    expect(statusChangePatch("active")).toEqual({ status: "active" });
    expect(statusChangePatch("backlog")).toEqual({ status: "backlog" });
    expect(statusChangePatch("paused")).toEqual({ status: "paused" });
  });
});
