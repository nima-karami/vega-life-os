import { describe, expect, it } from "vitest";
import type { Goal, GoalStatus } from "@/features/goals/model";
import type { Value } from "../model";
import { activeValues, archivedValues, goalCounts, splitGoals } from "../selectors";

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

describe("activeValues / archivedValues", () => {
  const values = [
    value("a", 1, null),
    value("b", 0, "2026-06-01T10:00:00.000Z"),
    value("c", 2, null),
    value("d", 3, "2026-06-03T10:00:00.000Z"),
  ];

  it("active = archivedAt null, sorted by order", () => {
    expect(activeValues(values).map((v) => v.id)).toEqual(["a", "c"]);
  });

  it("archived = archivedAt non-null, sorted by archivedAt descending", () => {
    expect(archivedValues(values).map((v) => v.id)).toEqual(["d", "b"]);
  });

  it("filters are disjoint and total", () => {
    const active = activeValues(values).length;
    const archived = archivedValues(values).length;
    expect(active + archived).toBe(values.length);
  });
});

describe("splitGoals / goalCounts", () => {
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
    expect(goalCounts(goals)).toEqual({ active: 3, closed: 2 });
  });

  it("handles an empty list", () => {
    expect(goalCounts([])).toEqual({ active: 0, closed: 0 });
  });
});
