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
    restingAt: null,
  };
}

const ctxOf = (values: Value[] = [], habits: Habit[] = []) => ({ values, goals: [], habits });

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
  it("exposes only the done list and habit rows", () => {
    const r = computeWeekRollup([], ctxOf(), WEEK, "2026-06-20");
    expect(Object.keys(r).sort()).toEqual(["doneByValue", "habitRows"]);
  });

  it("never counts future tasks, done or not", () => {
    const tasks = [
      task({ id: "a", date: "2026-06-08", status: "done", valueId: "v1" }),
      task({ id: "b", date: "2026-06-09", status: "done", valueId: "v1" }),
      ...[10, 11, 12, 13].map((d) =>
        task({ id: `f${d}`, date: `2026-06-${d}`, status: "todo", valueId: "v1" }),
      ),
      task({ id: "fd", date: "2026-06-14", status: "done", valueId: "v1" }),
    ];
    const r = computeWeekRollup(tasks, ctxOf([value(0, "v1", "Health")]), WEEK, "2026-06-09");
    expect(r.doneByValue).toHaveLength(1);
    expect(r.doneByValue[0].tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("ignores tasks outside the week window", () => {
    const tasks = [
      task({ date: "2026-06-01", status: "done" }),
      task({ id: "in", date: "2026-06-08", status: "done" }),
    ];
    const r = computeWeekRollup(tasks, ctxOf(), WEEK, "2026-06-20");
    expect(r.doneByValue[0].tasks.map((t) => t.id)).toEqual(["in"]);
  });

  it("computes per-habit done/total for the week, skips excluded", () => {
    const habits: Habit[] = [{ id: "h1", name: "Run", tracked: true } as Habit];
    const tasks = [
      task({ date: "2026-06-08", status: "done", habitId: "h1" }),
      task({ date: "2026-06-09", status: "todo", habitId: "h1" }),
      task({ date: "2026-06-10", status: "skip", habitId: "h1" }),
    ];
    const r = computeWeekRollup(tasks, ctxOf([], habits), WEEK, "2026-06-20");
    expect(r.habitRows).toEqual([{ h: habits[0], done: 1, total: 2 }]);
  });
});

describe("computeWeekRollup untracked habits", () => {
  const walk: Habit[] = [{ id: "h1", name: "Walk", tracked: false } as Habit];
  const tasks = [task({ date: "2026-06-08", status: "done", habitId: "h1", valueId: "v1" })];
  const r = computeWeekRollup(tasks, ctxOf([value(0, "v1", "Health")], walk), WEEK, "2026-06-20");

  it("gives an untracked habit no row", () => {
    expect(r.habitRows).toEqual([]);
  });

  it("still lists its done instance", () => {
    expect(r.doneByValue.flatMap((g) => g.tasks)).toHaveLength(1);
  });
});

describe("computeWeekRollup habitRows filtering", () => {
  const run: Habit[] = [{ id: "h1", name: "Run", tracked: true } as Habit];

  it("omits a habit with no instances in the week", () => {
    const tasks = [task({ date: "2026-06-08", status: "done", habitId: "other" })];
    expect(computeWeekRollup(tasks, ctxOf([], run), WEEK, "2026-06-20").habitRows).toEqual([]);
  });

  it("keeps a habit archived mid-week that has counted instances", () => {
    const habits: Habit[] = [
      { id: "h1", name: "Stretch", tracked: true, archivedAt: "2026-06-11" } as unknown as Habit,
    ];
    const tasks = [task({ date: "2026-06-10", status: "done", habitId: "h1" })];
    const r = computeWeekRollup(tasks, ctxOf([], habits), WEEK, "2026-06-20");
    expect(r.habitRows).toEqual([{ h: habits[0], done: 1, total: 1 }]);
  });

  it("omits a habit whose only week instances are skips", () => {
    const tasks = [task({ date: "2026-06-09", status: "skip", habitId: "h1" })];
    expect(computeWeekRollup(tasks, ctxOf([], run), WEEK, "2026-06-20").habitRows).toEqual([]);
  });

  it("ignores instances dated after today", () => {
    const tasks = [
      task({ date: "2026-06-12", status: "todo", habitId: "h1" }),
      task({ date: "2026-06-13", status: "todo", habitId: "h1" }),
    ];
    expect(computeWeekRollup(tasks, ctxOf([], run), WEEK, "2026-06-10").habitRows).toEqual([]);
  });

  it("counts only up-to-today instances toward a shown row", () => {
    const tasks = [
      task({ date: "2026-06-08", status: "done", habitId: "h1" }),
      task({ date: "2026-06-12", status: "todo", habitId: "h1" }),
    ];
    const r = computeWeekRollup(tasks, ctxOf([], run), WEEK, "2026-06-10");
    expect(r.habitRows).toEqual([{ h: run[0], done: 1, total: 1 }]);
  });
});
