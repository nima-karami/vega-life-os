import { describe, expect, it } from "vitest";
import type { Goal, GoalStatus } from "@/features/goals/model";
import type { Value } from "../model";
import { computeGoalCounts, getActiveValues, getArchivedValues, splitGoals } from "../selectors";

const value = (id: string, order: number, archivedAt: string | null): Value => ({
  id,
  name: id,
  icon: "compass",
  hue: "#000",
  spectrum: "courage",
  energy: 0.5,
  desc: "",
  order,
  archivedAt,
});

const goal = (id: string, status: GoalStatus): Goal => ({
  id,
  valueId: "v1",
  name: id,
  icon: "target",
  status,
  start: "2026-01-01",
  end: "2026-12-31",
  progress: 0,
  subgoals: [],
  order: 0,
});

describe("getActiveValues / getArchivedValues", () => {
  const values = [
    value("a", 1, null),
    value("b", 0, "2026-06-01T10:00:00.000Z"),
    value("c", 2, null),
    value("d", 3, "2026-06-03T10:00:00.000Z"),
  ];

  it("active = archivedAt null, sorted by order", () => {
    expect(getActiveValues(values).map((v) => v.id)).toEqual(["a", "c"]);
  });

  it("archived = archivedAt non-null, sorted by archivedAt descending", () => {
    expect(getArchivedValues(values).map((v) => v.id)).toEqual(["d", "b"]);
  });

  it("filters are disjoint and total", () => {
    const active = getActiveValues(values).length;
    const archived = getArchivedValues(values).length;
    expect(active + archived).toBe(values.length);
  });

  it("treats a legacy value with no archivedAt field as active (not archived)", () => {
    // Records created before archiving have archivedAt absent (undefined).
    const legacy = { ...value("legacy", 5, null), archivedAt: undefined } as unknown as Value;
    expect(getActiveValues([legacy]).map((v) => v.id)).toEqual(["legacy"]);
    expect(getArchivedValues([legacy])).toEqual([]);
  });
});

describe("splitGoals / computeGoalCounts", () => {
  const goals = [
    goal("g1", "active"),
    goal("g2", "backlog"),
    goal("g3", "paused"),
    goal("g4", "done"),
    goal("g5", "abandoned"),
  ];

  it("open = active/backlog/paused; closed = done/abandoned", () => {
    const { open, closed } = splitGoals(goals);
    expect(open.map((g) => g.id)).toEqual(["g1", "g2", "g3"]);
    expect(closed.map((g) => g.id)).toEqual(["g4", "g5"]);
  });

  it("paused counts as active/open", () => {
    expect(computeGoalCounts(goals)).toEqual({ active: 3, closed: 2 });
  });

  it("handles an empty list", () => {
    expect(computeGoalCounts([])).toEqual({ active: 0, closed: 0 });
  });
});
