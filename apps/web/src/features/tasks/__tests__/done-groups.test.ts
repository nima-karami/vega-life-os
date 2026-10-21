import { describe, expect, it } from "vitest";
import type { Habit } from "@/features/habits/model";
import type { Value } from "@/features/values/model";
import { collapseHabitItems, groupDoneByValue } from "../done-groups";
import type { Task } from "../model";

const value = (id: string, order: number): Value => ({
  id,
  name: id.toUpperCase(),
  icon: "heart",
  hue: "blue",
  spectrum: "vitality",
  energy: 0.5,
  desc: "",
  order,
  archivedAt: null,
  restingAt: null,
});

const habit: Habit = {
  id: "h1",
  name: "Run",
  goalId: null,
  valueId: "v2",
  icon: "repeat",
  time: null,
  schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: "2026-06-01" },
  durationMin: 20,
  createdAt: "2026-06-01",
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  tracked: true,
  plan: "",
};

const task = (patch: Partial<Task>): Task =>
  ({
    id: "t",
    title: "t",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: null,
    date: "2026-06-10",
    time: null,
    status: "done",
    order: 0,
    ...patch,
  }) as Task;

const ctx = { values: [value("v1", 0), value("v2", 1)], goals: [], habits: [habit] };
const DAY = ["2026-06-10", "2026-06-11"];

describe("groupDoneByValue", () => {
  it("groups by lineage value in value order", () => {
    const groups = groupDoneByValue(
      [task({ id: "a", valueId: "v2" }), task({ id: "b", valueId: "v1" })],
      ctx,
      DAY,
    );
    expect(groups.map((g) => g.value?.id)).toEqual(["v1", "v2"]);
  });

  it("resolves a habit instance through its habit", () => {
    const groups = groupDoneByValue([task({ id: "a", kind: "habit", habitId: "h1" })], ctx, DAY);
    expect(groups).toHaveLength(1);
    expect(groups[0].value?.id).toBe("v2");
  });

  it("puts unlinked tasks last under a null value", () => {
    const groups = groupDoneByValue(
      [task({ id: "a" }), task({ id: "b", valueId: "v1" })],
      ctx,
      DAY,
    );
    expect(groups.map((g) => g.value?.id ?? null)).toEqual(["v1", null]);
  });

  it("excludes tasks outside the dates and tasks that are not done", () => {
    const groups = groupDoneByValue(
      [
        task({ id: "a", valueId: "v1", date: "2026-06-12" }),
        task({ id: "b", valueId: "v1", status: "todo" }),
        task({ id: "c", valueId: "v1", status: "skip" }),
      ],
      ctx,
      DAY,
    );
    expect(groups).toEqual([]);
  });

  it("sorts items by date then time", () => {
    const groups = groupDoneByValue(
      [
        task({ id: "late", valueId: "v1", date: "2026-06-11", time: "08:00" }),
        task({ id: "b", valueId: "v1", time: "10:00" }),
        task({ id: "a", valueId: "v1", time: "09:00" }),
      ],
      ctx,
      DAY,
    );
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a", "b", "late"]);
  });
});

const taskOf = (p: Partial<Task>) => ({ habitId: null, ...p }) as Task;

describe("collapseHabitItems", () => {
  it("collapses repeated habit instances and leaves one-offs", () => {
    const items = collapseHabitItems([
      taskOf({ id: "1", habitId: "h", title: "Stretch" }),
      taskOf({ id: "2", title: "Call bank" }),
      taskOf({ id: "3", habitId: "h", title: "Stretch" }),
      taskOf({ id: "4", habitId: "h", title: "Stretch" }),
      taskOf({ id: "5", habitId: "g", title: "Read" }),
    ]);
    expect(items).toEqual([
      { key: "h", label: "Stretch ×3" },
      { key: "2", label: "Call bank" },
      { key: "g", label: "Read" },
    ]);
  });
});
