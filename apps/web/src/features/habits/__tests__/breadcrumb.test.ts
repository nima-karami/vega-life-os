import { describe, expect, it } from "vitest";
import type { Goal } from "@/features/goals/model";
import type { Value } from "@/features/values/model";
import { buildHabitTrail } from "../breadcrumb";
import type { Habit } from "../model";

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: "h1",
  name: "Read 1h before bed",
  goalId: null,
  valueId: "v2",
  icon: "book",
  time: "21:30",
  schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: "2026-01-01" },
  durationMin: 60,
  createdAt: "2026-01-01",
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  ...over,
});

const value = (over: Partial<Value> = {}): Value => ({
  id: "v2",
  name: "Presence",
  icon: "eye",
  hue: "#000",
  spectrum: "presence",
  energy: 0.5,
  desc: "",
  order: 0,
  archivedAt: null,
  ...over,
});

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: "g2",
  valueId: "v2",
  name: "Read 24 books this year",
  icon: "book",
  status: "active",
  start: "2026-01-01",
  end: "2026-12-31",
  progress: 0.46,
  subgoals: [],
  order: 0,
  ...over,
});

describe("buildHabitTrail", () => {
  it("names the value and the goal when both resolve", () => {
    const trail = buildHabitTrail(habit({ goalId: "g2" }), {
      values: [value()],
      goals: [goal()],
    });
    expect(trail).toEqual([
      { label: "Values", to: "/values" },
      { label: "Presence", to: "/values/v2" },
      { label: "Read 24 books this year", to: "/goals/g2" },
    ]);
  });

  it("stops at the value when the habit has no goal", () => {
    const trail = buildHabitTrail(habit({ goalId: null }), { values: [value()], goals: [goal()] });
    expect(trail).toEqual([
      { label: "Values", to: "/values" },
      { label: "Presence", to: "/values/v2" },
    ]);
  });

  it("drops a dangling goal rather than linking to a page that is gone", () => {
    const trail = buildHabitTrail(habit({ goalId: "g-deleted" }), {
      values: [value()],
      goals: [goal()],
    });
    expect(trail).toEqual([
      { label: "Values", to: "/values" },
      { label: "Presence", to: "/values/v2" },
    ]);
  });

  it("falls back to the habits index when the value does not resolve", () => {
    const trail = buildHabitTrail(habit({ valueId: "v-gone", goalId: "g2" }), {
      values: [value()],
      goals: [goal()],
    });
    expect(trail).toEqual([{ label: "Habits", to: "/habits" }]);
  });

  it("takes the value segment from the habit, not from the goal's own value", () => {
    const trail = buildHabitTrail(habit({ valueId: "v2", goalId: "g2" }), {
      values: [value(), value({ id: "v5", name: "Vitality" })],
      goals: [goal({ valueId: "v5" })],
    });
    expect(trail[1]).toEqual({ label: "Presence", to: "/values/v2" });
  });
});
