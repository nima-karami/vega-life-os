import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks/model";
import { shouldNudgeBackToIt } from "../back-to-it";
import type { Habit } from "../model";

// Far from the real clock, so a check that reads the clock instead of `today` fails.
const TODAY = "2024-02-29";

const habit = {
  id: "h",
  schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: "2024-01-01" },
  createdAt: "2024-01-01",
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  tracked: true,
} as unknown as Habit;

const instance = (date: string, status: Task["status"]) =>
  ({ id: `t-${date}`, kind: "habit", habitId: "h", date, slotDate: date, status }) as Task;

describe("shouldNudgeBackToIt", () => {
  it("nudges today's open instance after a missed slot, judged from the given today", () => {
    const todays = instance(TODAY, "todo");
    const tasks = [instance("2024-02-27", "done"), instance("2024-02-28", "todo"), todays];
    expect(shouldNudgeBackToIt(todays, habit, tasks, TODAY)).toBe(true);
  });

  it("stays quiet when the given today's previous slot was kept", () => {
    const todays = instance(TODAY, "todo");
    const tasks = [instance("2024-02-28", "done"), todays];
    expect(shouldNudgeBackToIt(todays, habit, tasks, TODAY)).toBe(false);
  });

  it("stays quiet on an instance that is not dated the given today", () => {
    const yesterdays = instance("2024-02-28", "todo");
    expect(shouldNudgeBackToIt(yesterdays, habit, [yesterdays], TODAY)).toBe(false);
  });
});
