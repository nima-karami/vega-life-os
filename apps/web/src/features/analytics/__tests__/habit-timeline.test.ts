import { format, subDays } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import { computeHabitTimeline } from "../selectors";

const NOW = new Date("2026-07-15T12:00:00");
const iso = (back: number) => format(subDays(NOW, back), "yyyy-MM-dd");

const dailyHabit: Habit = {
  id: "h1",
  name: "Read",
  goalId: null,
  valueId: "v1",
  icon: "book",
  time: null,
  schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: iso(30) },
  durationMin: 15,
  createdAt: iso(30),
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
};

function instance(back: number, patch: Partial<Task>): Task {
  return {
    id: `t${back}-${patch.status ?? "todo"}`,
    title: "Read",
    kind: "habit",
    habitId: "h1",
    goalId: null,
    valueId: "v1",
    date: iso(back),
    slotDate: iso(back),
    time: null,
    durationMin: 15,
    status: "todo",
    detached: false,
    note: "",
    order: 0,
    ...patch,
  };
}

describe("computeHabitTimeline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("classifies done, moved, skip, miss and pending days", () => {
    const tasks = [
      instance(2, { status: "done" }), // done on its slot
      instance(4, { status: "done", date: iso(3) }), // fulfilled a day late/elsewhere → moved
      instance(5, { status: "skip" }), // neutral skip
      // slot at back-6 never materialized → a real miss (past grace)
      // today (back-0) unresolved → pending (within grace)
    ];
    const timeline = computeHabitTimeline(tasks, dailyHabit, 8);
    const kindAt = (back: number) => timeline.days.find((d) => d.iso === iso(back))?.kind;

    expect(kindAt(2)).toBe("done");
    expect(kindAt(4)).toBe("moved");
    expect(kindAt(5)).toBe("skip");
    expect(kindAt(6)).toBe("miss");
    expect(kindAt(0)).toBe("pending");
    expect(timeline.done).toBe(2); // done + moved
    expect(timeline.missed).toBeGreaterThanOrEqual(1);
  });

  it("marks non-scheduled days as off (faint), not misses", () => {
    const monOnly: Habit = {
      ...dailyHabit,
      schedule: { type: "weekly", days: [1, 0, 0, 0, 0, 0, 0], interval: 1, anchor: iso(30) },
    };
    const timeline = computeHabitTimeline([], monOnly, 8);
    // NOW is a Wednesday → today is an off day for a Monday-only habit
    expect(timeline.days.find((d) => d.iso === iso(0))?.kind).toBe("off");
    expect(timeline.days.some((d) => d.kind === "off")).toBe(true);
  });

  it("caps the window at the habit's creation date", () => {
    const fresh: Habit = { ...dailyHabit, createdAt: iso(3) };
    const timeline = computeHabitTimeline([], fresh, 30);
    expect(timeline.days.every((d) => d.iso >= iso(3))).toBe(true);
  });
});
