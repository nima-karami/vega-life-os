import { format, subDays } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dowIndex } from "@/core/lib/date";
import type { Task } from "@/features/tasks/model";
import { computeInsights } from "../selectors";

const NOW = new Date("2026-07-15T12:00:00");
const iso = (offset: number) => format(subDays(NOW, offset), "yyyy-MM-dd");

function task(date: string, status: Task["status"]): Task {
  return {
    id: `t-${date}-${status}`,
    title: "t",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: "v1",
    date,
    time: null,
    durationMin: 0,
    status,
    detached: false,
    note: "",
    order: 0,
  };
}

// Three weeks of tasks 40+ days back: Mon/Wed/Fri always done, other days always
// missed → a strong, insight-worthy weekday split, but only inside a wide window.
function weekdaySplitTasks(): Task[] {
  const tasks: Task[] = [];
  for (let offset = 42; offset <= 62; offset++) {
    const date = iso(offset);
    const strongDay = [0, 2, 4].includes(dowIndex(date));
    tasks.push(task(date, strongDay ? "done" : "todo"));
  }
  return tasks;
}

describe("computeInsights — window param", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("surfaces a weekday insight when the window includes the data", () => {
    const insights = computeInsights(weekdaySplitTasks(), [], undefined, 90);
    expect(insights.some((line) => /follow through most on/i.test(line))).toBe(true);
  });

  it("drops that insight when the window is too short to reach the data", () => {
    expect(computeInsights(weekdaySplitTasks(), [], undefined, 7)).toEqual([]);
  });
});
