import { describe, expect, it } from "vitest";
import { shiftISO } from "@/core/lib/date";
import type { Task, TaskStatus } from "@/features/tasks/model";
import type { Habit, HabitSchedule } from "../model";
import { computeHabitConsistency, hasLapsedPreviousSlot } from "../selectors";

const TODAY = "2026-03-30"; // a Monday
const CREATED = "2026-01-01";
const HABIT_ID = "h";
let seq = 0;

const weekly = (days: number[], interval = 1, anchor = CREATED): HabitSchedule => ({
  type: "weekly",
  days,
  interval,
  anchor,
});

const habitOn = (schedule: HabitSchedule, over: Partial<Habit> = {}): Habit => ({
  id: HABIT_ID,
  name: "Workout",
  goalId: null,
  valueId: "v1",
  icon: "repeat",
  time: "09:00",
  schedule,
  durationMin: 30,
  createdAt: CREATED,
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  tracked: true,
  plan: "",
  ...over,
});

const daily = habitOn(weekly([1, 1, 1, 1, 1, 1, 1]));

const inst = (date: string, status: TaskStatus, over: Partial<Task> = {}): Task => ({
  id: `t-${date}-${seq++}`,
  title: "Workout",
  kind: "habit",
  habitId: HABIT_ID,
  goalId: null,
  valueId: "v1",
  date,
  slotDate: date,
  completedAt: status === "done" ? `${date}T09:00:00` : null,
  time: "09:00",
  durationMin: 30,
  status,
  detached: false,
  note: "",
  order: 0,
  ...over,
});

const back = (n: number) => shiftISO(TODAY, -n);
const doneOn = (...offsets: number[]) => offsets.map((n) => inst(back(n), "done"));

describe("computeHabitConsistency", () => {
  it("counts done and due over the last 7 days, today unresolved excluded", () => {
    const tasks = doneOn(1, 2, 3, 4);
    expect(computeHabitConsistency(tasks, daily, TODAY)).toEqual({
      kept: 4,
      due: 6,
      windowDays: 7,
    });
  });

  it("counts today once it is done", () => {
    const tasks = doneOn(0, 1, 2, 3, 4);
    expect(computeHabitConsistency(tasks, daily, TODAY)).toEqual({
      kept: 5,
      due: 7,
      windowDays: 7,
    });
  });

  it("lets a miss fade once it is older than the window", () => {
    const tasks = [...doneOn(0, 1, 2, 3, 4, 5, 6), inst(back(7), "todo")];
    expect(computeHabitConsistency(tasks, daily, TODAY)).toMatchObject({ kept: 7, due: 7 });
  });

  it("counts only the scheduled days for a Mon/Wed/Fri habit", () => {
    const mwf = habitOn(weekly([1, 0, 1, 0, 1, 0, 0]));
    expect(computeHabitConsistency(doneOn(0, 3, 5), mwf, TODAY)).toMatchObject({ kept: 3, due: 3 });
  });

  it("has nothing due for an every-other-week habit with no slot in the window", () => {
    const biweekly = habitOn(weekly([0, 0, 1, 0, 0, 0, 0], 2, back(14)), { createdAt: back(30) });
    const { due } = computeHabitConsistency([], biweekly, TODAY);
    expect(due).toBe(0);
  });

  it("has nothing due for a monthly habit with no slot in the window", () => {
    const monthly = habitOn({ type: "monthly", daysOfMonth: [3], lastDay: false });
    expect(computeHabitConsistency([], monthly, TODAY).due).toBe(0);
  });

  it("only counts slots since the habit was created", () => {
    const fresh = habitOn(weekly([1, 1, 1, 1, 1, 1, 1]), { createdAt: back(2) });
    expect(computeHabitConsistency(doneOn(2), fresh, TODAY)).toMatchObject({ kept: 1, due: 2 });
  });

  it("treats days inside a paused span as not due", () => {
    const paused = habitOn(weekly([1, 1, 1, 1, 1, 1, 1]), {
      pausedSpans: [{ from: back(5), to: back(2) }],
    });
    expect(computeHabitConsistency([], paused, TODAY)).toMatchObject({ kept: 0, due: 2 });
  });

  it("has nothing due when every slot was skipped or unscheduled", () => {
    const tasks = [1, 2, 3, 4, 5, 6].map((n) => inst(back(n), n % 2 ? "skip" : "open"));
    const created = habitOn(weekly([1, 1, 1, 1, 1, 1, 1]), { createdAt: back(6) });
    expect(computeHabitConsistency(tasks, created, TODAY).due).toBe(0);
  });

  it("counts a late backfill as kept", () => {
    const late = inst(back(3), "done", { completedAt: `${back(0)}T09:00:00` });
    expect(computeHabitConsistency([late], daily, TODAY)).toMatchObject({ kept: 1, due: 6 });
  });

  it("honours a wider window", () => {
    expect(computeHabitConsistency(doneOn(1), daily, TODAY, 3)).toEqual({
      kept: 1,
      due: 2,
      windowDays: 3,
    });
  });
});

describe("hasLapsedPreviousSlot", () => {
  it("is true when yesterday was not done", () => {
    expect(hasLapsedPreviousSlot(doneOn(2, 3), daily, TODAY)).toBe(true);
  });

  it("is false when yesterday was done", () => {
    expect(hasLapsedPreviousSlot(doneOn(1), daily, TODAY)).toBe(false);
  });

  it("passes over a skipped yesterday and finds the miss before it", () => {
    const tasks = [inst(back(1), "skip")];
    expect(hasLapsedPreviousSlot(tasks, daily, TODAY)).toBe(true);
  });

  it("is false when the slot before a skipped yesterday was done", () => {
    const tasks = [inst(back(2), "done"), inst(back(1), "skip")];
    expect(hasLapsedPreviousSlot(tasks, daily, TODAY)).toBe(false);
  });

  it("is false for a habit with no earlier slot", () => {
    const fresh = habitOn(weekly([1, 1, 1, 1, 1, 1, 1]), { createdAt: TODAY });
    expect(hasLapsedPreviousSlot([], fresh, TODAY)).toBe(false);
  });

  it("is false when every earlier slot was skipped", () => {
    const fresh = habitOn(weekly([1, 1, 1, 1, 1, 1, 1]), { createdAt: back(2) });
    const tasks = [inst(back(2), "skip"), inst(back(1), "skip")];
    expect(hasLapsedPreviousSlot(tasks, fresh, TODAY)).toBe(false);
  });

  it("looks back past 3 weeks for a sparse habit", () => {
    const monthly = habitOn({ type: "monthly", daysOfMonth: [9], lastDay: false });
    expect(hasLapsedPreviousSlot([], monthly, TODAY)).toBe(true);
  });

  it("does not nudge after resume for a miss before the pause", () => {
    const resumed = habitOn(weekly([1, 1, 1, 1, 1, 1, 1]), {
      createdAt: back(6),
      pausedSpans: [{ from: back(4), to: back(2) }],
      resumedAt: `${back(1)}T08:00:00`,
    });
    const tasks = [inst(back(5), "todo"), inst(back(1), "skip")];
    expect(hasLapsedPreviousSlot(tasks, resumed, TODAY)).toBe(false);
  });
});
