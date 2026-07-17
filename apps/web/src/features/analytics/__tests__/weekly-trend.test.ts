import { format, subDays } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/features/tasks/model";
import { computeWeeklyTrend } from "../selectors";

// A Wednesday, so weekday math is unambiguous.
const NOW = new Date("2026-07-15T12:00:00");
const iso = (back: number) => format(subDays(NOW, back), "yyyy-MM-dd");

function task(back: number, patch: Partial<Task>): Task {
  return {
    id: `t${back}-${patch.status ?? "todo"}-${Math.random()}`,
    title: "t",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: null,
    date: iso(back),
    time: null,
    durationMin: 0,
    status: "todo",
    detached: false,
    note: "",
    order: 0,
    ...patch,
  };
}

describe("computeWeeklyTrend", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("carries per-week done/total counts, excluding skips", () => {
    // this week (Mon Jul 13 .. Wed Jul 15): 2 done, 1 todo, 1 skip
    const tasks = [
      task(0, { status: "done" }),
      task(1, { status: "done" }),
      task(2, { status: "todo" }),
      task(2, { status: "skip" }),
    ];
    const trend = computeWeeklyTrend(tasks, 4);
    expect(trend).toHaveLength(4);
    const thisWeek = trend[3];
    expect(thisWeek.done).toBe(2);
    expect(thisWeek.total).toBe(3); // skip excluded
    expect(thisWeek.rate).toBeCloseTo(2 / 3);
  });

  it("an empty week reads as zero total and zero rate, not a gap", () => {
    const trend = computeWeeklyTrend([], 3);
    expect(trend.every((w) => w.total === 0 && w.rate === 0)).toBe(true);
    expect(trend[0].weekStartISO < trend[2].weekStartISO).toBe(true); // oldest first
  });
});
