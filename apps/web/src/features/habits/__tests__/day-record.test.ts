import { describe, expect, it } from "vitest";
import { shiftISO } from "@/core/lib/date";
import type { Task, TaskStatus } from "@/features/tasks/model";
import type { Habit, HabitSchedule } from "../model";
import { buildHabitDayRecord } from "../selectors";

const TODAY = "2026-03-30"; // a Monday
const CREATED = "2026-01-01";
const HABIT_ID = "h";
let seq = 0;

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

const weekly = (days: number[]): HabitSchedule => ({
  type: "weekly",
  days,
  interval: 1,
  anchor: CREATED,
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

const stateOn = (record: ReturnType<typeof buildHabitDayRecord>, date: string) =>
  record.find((d) => d.date === date)?.state;

describe("buildHabitDayRecord", () => {
  it("returns the window oldest-first, ending on today", () => {
    const record = buildHabitDayRecord([], daily, 30, TODAY);
    expect(record).toHaveLength(30);
    expect(record[0].date).toBe(shiftISO(TODAY, -29));
    expect(record[29].date).toBe(TODAY);
  });

  it("marks a completed slot kept and an unresolved past slot missed", () => {
    const kept = shiftISO(TODAY, -5);
    const record = buildHabitDayRecord([inst(kept, "done")], daily, 30, TODAY);
    expect(stateOn(record, kept)).toBe("kept");
    expect(stateOn(record, shiftISO(TODAY, -6))).toBe("missed");
  });

  it("leaves a day the habit was never scheduled on off the record", () => {
    const mondays = habitOn(weekly([1, 0, 0, 0, 0, 0, 0]));
    const record = buildHabitDayRecord([], mondays, 30, TODAY);
    // TODAY is a Monday, so every 7th cell back is due and the rest are untouched.
    expect(stateOn(record, shiftISO(TODAY, -7))).toBe("missed");
    expect(stateOn(record, shiftISO(TODAY, -6))).toBe("off");
    expect(record.filter((d) => d.state !== "off")).toHaveLength(4);
  });

  it("counts a late completion as kept", () => {
    const slot = shiftISO(TODAY, -10);
    const late = inst(slot, "done", { completedAt: `${shiftISO(slot, 4)}T09:00:00` });
    expect(stateOn(buildHabitDayRecord([late], daily, 30, TODAY), slot)).toBe("kept");
  });

  it("treats a skipped or unscheduled slot as off, never a miss", () => {
    const skipped = shiftISO(TODAY, -8);
    const pulled = shiftISO(TODAY, -9);
    const record = buildHabitDayRecord(
      [inst(skipped, "skip"), inst(pulled, "open")],
      daily,
      30,
      TODAY,
    );
    expect(stateOn(record, skipped)).toBe("off");
    expect(stateOn(record, pulled)).toBe("off");
  });

  it("reads days inside a pause span off and the resume day missed when undone", () => {
    const resumed = shiftISO(TODAY, -3);
    const record = buildHabitDayRecord(
      [inst(shiftISO(TODAY, -6), "done")],
      habitOn(weekly([1, 1, 1, 1, 1, 1, 1]), {
        createdAt: shiftISO(TODAY, -6),
        resumedAt: `${resumed}T08:00:00`,
        pausedSpans: [{ from: shiftISO(TODAY, -5), to: shiftISO(TODAY, -4) }],
      }),
      30,
      TODAY,
    );
    expect(stateOn(record, shiftISO(TODAY, -6))).toBe("kept");
    expect(stateOn(record, shiftISO(TODAY, -5))).toBe("off");
    expect(stateOn(record, shiftISO(TODAY, -4))).toBe("off");
    expect(stateOn(record, resumed)).toBe("missed");
  });

  it("leaves today off until it is done", () => {
    expect(stateOn(buildHabitDayRecord([], daily, 30, TODAY), TODAY)).toBe("off");
  });
});
