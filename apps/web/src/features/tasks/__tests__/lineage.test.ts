import { describe, expect, it } from "vitest";
import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { Value } from "@/features/values/model";
import { getTaskLineage } from "../lineage";
import type { Task } from "../model";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const value: Value = {
  id: "v1",
  name: "Vitality",
  icon: "heart",
  hue: "#fff",
  spectrum: "vitality",
  energy: 0.8,
  desc: "Health",
  order: 0,
  archivedAt: null,
};

const goal: Goal = {
  id: "g1",
  valueId: "v1",
  name: "Run 10k",
  icon: "target",
  status: "active",
  start: "2026-01-01",
  end: "2026-12-31",
  progress: 0.4,
  subgoals: [],
  order: 0,
};

const habit: Habit = {
  id: "h1",
  name: "Morning run",
  goalId: "g1",
  valueId: "v1",
  icon: "flame",
  time: "07:00",
  schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 0, 0], interval: 1, anchor: "2026-01-01" },
  durationMin: 30,
  createdAt: "2026-01-01",
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
};

function makeTask(patch: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Run",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: null,
    date: "2026-06-21",
    time: null,
    durationMin: 30,
    status: "todo",
    detached: false,
    note: "",
    order: 0,
    ...patch,
  };
}

const ctx = { values: [value], goals: [goal], habits: [habit] };

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("getTaskLineage", () => {
  it("resolves direct value link", () => {
    const task = makeTask({ valueId: "v1" });
    const result = getTaskLineage(task, ctx);
    expect(result.value?.id).toBe("v1");
    expect(result.goal).toBeUndefined();
    expect(result.habit).toBeUndefined();
    expect(result.fromHabit).toBe(false);
  });

  it("resolves via goal — inherits value from goal.valueId", () => {
    const task = makeTask({ goalId: "g1" }); // no direct valueId
    const result = getTaskLineage(task, ctx);
    expect(result.goal?.id).toBe("g1");
    expect(result.value?.id).toBe("v1"); // resolved via goal
    expect(result.fromHabit).toBe(false);
  });

  it("resolves via habit — inherits value and goal from habit", () => {
    const task = makeTask({ habitId: "h1", kind: "habit" });
    const result = getTaskLineage(task, ctx);
    expect(result.habit?.id).toBe("h1");
    expect(result.goal?.id).toBe("g1"); // via habit.goalId
    expect(result.value?.id).toBe("v1"); // via goal.valueId
    expect(result.fromHabit).toBe(true);
  });

  it("sets fromHabit when task.habitId is set (even if kind != 'habit')", () => {
    const task = makeTask({ habitId: "h1", kind: "oneoff" });
    const result = getTaskLineage(task, ctx);
    expect(result.fromHabit).toBe(true);
  });

  it("sets fromHabit when task.kind === 'habit' (even without habitId)", () => {
    const task = makeTask({ kind: "habit", habitId: null });
    const result = getTaskLineage(task, ctx);
    expect(result.fromHabit).toBe(true);
  });

  it("returns all undefined for a fully unlinked one-off task", () => {
    const task = makeTask(); // no links
    const result = getTaskLineage(task, ctx);
    expect(result.value).toBeUndefined();
    expect(result.goal).toBeUndefined();
    expect(result.habit).toBeUndefined();
    expect(result.fromHabit).toBe(false);
  });

  it("handles dangling valueId gracefully (does not throw)", () => {
    const task = makeTask({ valueId: "nonexistent" });
    expect(() => getTaskLineage(task, ctx)).not.toThrow();
    const result = getTaskLineage(task, ctx);
    expect(result.value).toBeUndefined();
  });

  it("handles dangling goalId gracefully (does not throw)", () => {
    const task = makeTask({ goalId: "nonexistent" });
    expect(() => getTaskLineage(task, ctx)).not.toThrow();
    const result = getTaskLineage(task, ctx);
    expect(result.goal).toBeUndefined();
  });

  it("handles dangling habitId gracefully (does not throw)", () => {
    const task = makeTask({ habitId: "nonexistent", kind: "habit" });
    expect(() => getTaskLineage(task, ctx)).not.toThrow();
    const result = getTaskLineage(task, ctx);
    expect(result.habit).toBeUndefined();
    expect(result.fromHabit).toBe(true); // kind=habit still sets it
  });

  it("direct valueId takes precedence over habit.valueId", () => {
    const value2: Value = { ...value, id: "v2", name: "Stability", order: 1 };
    const ctxWithV2 = { ...ctx, values: [value, value2] };
    const task = makeTask({ valueId: "v2", habitId: "h1", kind: "habit" });
    const result = getTaskLineage(task, ctxWithV2);
    expect(result.value?.id).toBe("v2"); // direct wins
  });

  it("goal from task.goalId takes precedence over habit.goalId", () => {
    const goal2: Goal = { ...goal, id: "g2", name: "Meditate", valueId: "v1" };
    const ctxWithG2 = { ...ctx, goals: [goal, goal2] };
    const task = makeTask({ goalId: "g2", habitId: "h1", kind: "habit" });
    const result = getTaskLineage(task, ctxWithG2);
    expect(result.goal?.id).toBe("g2"); // task.goalId wins
  });
});
