import { describe, expect, it } from "vitest";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import type { Value } from "@/features/values/model";
import { computeWeekRollup } from "../rollup";

function task(p: Partial<Task>): Task {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    title: p.title ?? "t",
    status: p.status ?? "todo",
    date: p.date ?? null,
    valueId: p.valueId ?? null,
    goalId: p.goalId ?? null,
    habitId: p.habitId ?? null,
    ...p,
  } as Task;
}

function value(order: number, id: string, name: string): Value {
  return {
    id,
    name,
    icon: "tree",
    hue: "#000",
    spectrum: "blue",
    energy: 0.5,
    desc: "",
    order,
    archivedAt: null,
  };
}

// Week of Mon 2026-06-08 .. Sun 2026-06-14
const WEEK = [
  "2026-06-08",
  "2026-06-09",
  "2026-06-10",
  "2026-06-11",
  "2026-06-12",
  "2026-06-13",
  "2026-06-14",
];

describe("computeWeekRollup", () => {
  it("completion excludes skips (resolved done / resolved scheduled)", () => {
    const tasks = [
      task({ date: "2026-06-08", status: "done" }),
      task({ date: "2026-06-09", status: "done" }),
      task({ date: "2026-06-10", status: "todo" }),
      task({ date: "2026-06-11", status: "skip" }), // excluded entirely
    ];
    const r = computeWeekRollup(tasks, [], [], WEEK, "2026-06-20");
    // 2 done out of 3 counted (skip excluded)
    expect(r.completion).toBeCloseTo(2 / 3);
  });

  it("returns 0 completion for an empty week without dividing by zero", () => {
    const r = computeWeekRollup([], [], [], WEEK, "2026-06-20");
    expect(r.completion).toBe(0);
  });

  it("ignores tasks outside the week window", () => {
    const tasks = [
      task({ date: "2026-06-01", status: "done" }), // before week
      task({ date: "2026-06-08", status: "done" }),
    ];
    const r = computeWeekRollup(tasks, [], [], WEEK, "2026-06-20");
    expect(r.completion).toBe(1);
  });

  it("counts completed tasks per value and tracks the max", () => {
    const values = [value(0, "v1", "Health"), value(1, "v2", "Craft")];
    const tasks = [
      task({ date: "2026-06-08", status: "done", valueId: "v1" }),
      task({ date: "2026-06-09", status: "done", valueId: "v1" }),
      task({ date: "2026-06-10", status: "done", valueId: "v2" }),
    ];
    const r = computeWeekRollup(tasks, values, [], WEEK, "2026-06-20");
    expect(r.byValue).toEqual([
      { v: values[0], n: 2 },
      { v: values[1], n: 1 },
    ]);
    expect(r.maxV).toBe(2);
  });

  it("maxV is at least 1 even with no completed value work", () => {
    const values = [value(0, "v1", "Health")];
    const r = computeWeekRollup([], values, [], WEEK, "2026-06-20");
    expect(r.maxV).toBe(1);
  });

  it("wins are completed goal-linked tasks (capped at 6)", () => {
    const tasks = Array.from({ length: 8 }, (_, i) =>
      task({ id: `g${i}`, date: "2026-06-08", status: "done", goalId: "goal1" }),
    );
    const r = computeWeekRollup(tasks, [], [], WEEK, "2026-06-20");
    expect(r.wins).toHaveLength(6);
    expect(r.wins.every((t) => t.goalId === "goal1")).toBe(true);
  });

  it("slipped are past-due unresolved tasks (not done, not skip, before today)", () => {
    const tasks = [
      task({ id: "a", date: "2026-06-08", status: "todo" }), // slipped
      task({ id: "b", date: "2026-06-09", status: "skip" }), // skip -> not slipped
      task({ id: "c", date: "2026-06-10", status: "done" }), // done -> not slipped
    ];
    const r = computeWeekRollup(tasks, [], [], WEEK, "2026-06-20");
    expect(r.slipped.map((t) => t.id)).toEqual(["a"]);
  });

  it("does not mark today/future tasks as slipped", () => {
    const tasks = [task({ id: "future", date: "2026-06-14", status: "todo" })];
    // today is mid-week 2026-06-10, so 06-14 is in the future
    const r = computeWeekRollup(tasks, [], [], WEEK, "2026-06-10");
    expect(r.slipped).toHaveLength(0);
  });

  it("computes per-habit done/total/rate for the week, skips excluded", () => {
    const habits: Habit[] = [{ id: "h1", name: "Run" } as Habit];
    const tasks = [
      task({ date: "2026-06-08", status: "done", habitId: "h1" }),
      task({ date: "2026-06-09", status: "todo", habitId: "h1" }),
      task({ date: "2026-06-10", status: "skip", habitId: "h1" }), // excluded
    ];
    const r = computeWeekRollup(tasks, [], habits, WEEK, "2026-06-20");
    expect(r.habitRows).toEqual([{ h: habits[0], rate: 0.5, done: 1, total: 2 }]);
  });
});

describe("computeWeekRollup habitRows filtering", () => {
  it("omits a habit with no instances in the week", () => {
    const habits: Habit[] = [{ id: "active", name: "Run" } as Habit];
    const tasks = [task({ date: "2026-06-08", status: "done", habitId: "other" })];
    const r = computeWeekRollup(tasks, [], habits, WEEK, "2026-06-20");
    expect(r.habitRows).toEqual([]);
  });

  it("keeps a habit archived mid-week that has counted instances", () => {
    const habits: Habit[] = [
      { id: "h1", name: "Stretch", archivedAt: "2026-06-11" } as unknown as Habit,
    ];
    const tasks = [task({ date: "2026-06-10", status: "done", habitId: "h1" })];
    const r = computeWeekRollup(tasks, [], habits, WEEK, "2026-06-20");
    expect(r.habitRows).toEqual([{ h: habits[0], rate: 1, done: 1, total: 1 }]);
  });

  it("omits a habit whose only week instances are skips", () => {
    const habits: Habit[] = [{ id: "h1", name: "Run" } as Habit];
    const tasks = [task({ date: "2026-06-09", status: "skip", habitId: "h1" })];
    const r = computeWeekRollup(tasks, [], habits, WEEK, "2026-06-20");
    expect(r.habitRows).toEqual([]);
  });

  it("ignores instances dated after today", () => {
    const habits: Habit[] = [{ id: "h1", name: "Run" } as Habit];
    const tasks = [
      task({ date: "2026-06-12", status: "todo", habitId: "h1" }), // WEEK[4], future
      task({ date: "2026-06-13", status: "todo", habitId: "h1" }), // WEEK[5], future
    ];
    // today = WEEK[2]
    const r = computeWeekRollup(tasks, [], habits, WEEK, "2026-06-10");
    expect(r.habitRows).toEqual([]);
  });

  it("counts only up-to-today instances toward a shown row", () => {
    const habits: Habit[] = [{ id: "h1", name: "Run" } as Habit];
    const tasks = [
      task({ date: "2026-06-08", status: "done", habitId: "h1" }), // past, counts
      task({ date: "2026-06-12", status: "todo", habitId: "h1" }), // future, excluded
    ];
    const r = computeWeekRollup(tasks, [], habits, WEEK, "2026-06-10");
    expect(r.habitRows).toEqual([{ h: habits[0], rate: 1, done: 1, total: 1 }]);
  });
});
