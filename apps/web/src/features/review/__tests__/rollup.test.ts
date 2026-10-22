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
    identity: "",
  };
}

const makeHabit = (over: Partial<Habit> = {}): Habit => ({
  id: "h1",
  name: "Run",
  goalId: null,
  valueId: "v1",
  icon: "repeat",
  time: "09:00",
  schedule: { type: "weekly", days: [1, 1, 1, 0, 0, 0, 0], interval: 1, anchor: "2026-01-01" },
  durationMin: 30,
  createdAt: "2026-01-01",
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  tracked: true,
  plan: "",
  ...over,
});

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
    const habits = [makeHabit()];
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
  const walk = [makeHabit({ name: "Walk", tracked: false })];
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
  const run = [makeHabit()];
  const slot = (date: string, status: Task["status"]) =>
    task({ date, slotDate: date, status, habitId: "h1" });

  it("omits a habit with no slot due yet this week", () => {
    expect(computeWeekRollup([], ctxOf([], run), WEEK, "2026-06-07").habitRows).toEqual([]);
  });

  it("keeps a habit archived mid-week that has counted slots", () => {
    const habits = [makeHabit({ name: "Stretch", archivedAt: "2026-06-11" })];
    const r = computeWeekRollup(
      [slot("2026-06-10", "done")],
      ctxOf([], habits),
      WEEK,
      "2026-06-20",
    );
    expect(r.habitRows).toEqual([{ h: habits[0], done: 1, total: 3 }]);
  });

  it("omits a habit whose every week slot was skipped", () => {
    const tasks = ["2026-06-08", "2026-06-09", "2026-06-10"].map((d) => slot(d, "skip"));
    expect(computeWeekRollup(tasks, ctxOf([], run), WEEK, "2026-06-20").habitRows).toEqual([]);
  });

  it("ignores slots dated after today", () => {
    const tasks = [slot("2026-06-12", "todo"), slot("2026-06-13", "todo")];
    expect(computeWeekRollup(tasks, ctxOf([], run), WEEK, "2026-06-08").habitRows).toEqual([]);
  });

  it("counts only up-to-today slots toward a shown row", () => {
    const tasks = [slot("2026-06-08", "done"), slot("2026-06-12", "todo")];
    const r = computeWeekRollup(tasks, ctxOf([], run), WEEK, "2026-06-10");
    expect(r.habitRows).toEqual([{ h: run[0], done: 1, total: 2 }]);
  });
});

describe("computeWeekRollup matches habit consistency", () => {
  const daily = makeHabit({
    schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: "2026-01-01" },
  });
  const slot = (date: string, status: Task["status"]) =>
    task({ date, slotDate: date, status, habitId: "h1" });

  it("does not count an unscheduled (open) instance as due", () => {
    const tasks = [slot("2026-06-08", "done"), slot("2026-06-09", "open")];
    const r = computeWeekRollup(tasks, ctxOf([], [daily]), WEEK, "2026-06-09");
    expect(r.habitRows).toEqual([{ h: daily, done: 1, total: 1 }]);
  });

  it("does not count today's unresolved instance as due", () => {
    const tasks = [slot("2026-06-08", "done"), slot("2026-06-09", "todo")];
    const r = computeWeekRollup(tasks, ctxOf([], [daily]), WEEK, "2026-06-09");
    expect(r.habitRows).toEqual([{ h: daily, done: 1, total: 1 }]);
  });

  it("counts a past slot that never materialized as due, today pending", () => {
    const r = computeWeekRollup(
      [slot("2026-06-08", "done")],
      ctxOf([], [daily]),
      WEEK,
      "2026-06-10",
    );
    expect(r.habitRows).toEqual([{ h: daily, done: 1, total: 2 }]);
  });
});
