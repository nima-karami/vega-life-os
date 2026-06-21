import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks";
import { timedTasksForDay, unscheduledTasks, untimedTasksForDay } from "../grid-data";

function task(over: Partial<Task>): Task {
  return {
    id: over.id ?? "t1",
    title: over.title ?? "T",
    kind: over.kind ?? "oneoff",
    habitId: over.habitId ?? null,
    goalId: over.goalId ?? null,
    valueId: over.valueId ?? null,
    date: over.date ?? null,
    time: over.time ?? null,
    durationMin: over.durationMin ?? 60,
    status: over.status ?? "todo",
    detached: over.detached ?? false,
    note: over.note ?? "",
    order: over.order ?? 0,
  };
}

const D = "2026-06-17";
const OTHER = "2026-06-18";

describe("timedTasksForDay", () => {
  it("includes tasks with a time on the given day", () => {
    const t = task({ id: "a", date: D, time: "09:00" });
    expect(timedTasksForDay([t], D)).toEqual([t]);
  });
  it("excludes tasks with no time (all-day) even on the same day", () => {
    const t = task({ id: "a", date: D, time: null });
    expect(timedTasksForDay([t], D)).toEqual([]);
  });
  it("excludes timed tasks on a different day", () => {
    const t = task({ id: "a", date: OTHER, time: "09:00" });
    expect(timedTasksForDay([t], D)).toEqual([]);
  });
});

describe("untimedTasksForDay", () => {
  it("includes dated tasks with no time on the given day", () => {
    const t = task({ id: "a", date: D, time: null });
    expect(untimedTasksForDay([t], D)).toEqual([t]);
  });
  it("excludes timed tasks", () => {
    const t = task({ id: "a", date: D, time: "08:00" });
    expect(untimedTasksForDay([t], D)).toEqual([]);
  });
  it("excludes undated (backlog) tasks", () => {
    const t = task({ id: "a", date: null, time: null });
    expect(untimedTasksForDay([t], D)).toEqual([]);
  });
});

describe("unscheduledTasks", () => {
  it("includes only tasks with date === null", () => {
    const backlog = task({ id: "a", date: null });
    const dated = task({ id: "b", date: D });
    expect(unscheduledTasks([backlog, dated])).toEqual([backlog]);
  });
  it("orders by the task order field", () => {
    const a = task({ id: "a", date: null, order: 2 });
    const b = task({ id: "b", date: null, order: 1 });
    expect(unscheduledTasks([a, b]).map((t) => t.id)).toEqual(["b", "a"]);
  });
});
