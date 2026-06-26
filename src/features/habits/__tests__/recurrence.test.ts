import { describe, expect, it } from "vitest";
import { dowIndex } from "@/core/lib/date";
import type { Habit, HabitSchedule } from "../model";
import {
  isActiveOn,
  isActiveOnSchedule,
  nextOccurrence,
  normalizeHabit,
  recurrenceText,
  weeklyMask,
} from "../recurrence";

const weekly = (over: Partial<Extract<HabitSchedule, { type: "weekly" }>> = {}): HabitSchedule => ({
  type: "weekly",
  days: [1, 1, 1, 1, 1, 1, 1],
  interval: 1,
  anchor: "2026-06-01",
  ...over,
});
const monthly = (
  over: Partial<Extract<HabitSchedule, { type: "monthly" }>> = {},
): HabitSchedule => ({ type: "monthly", daysOfMonth: [], lastDay: false, ...over });

describe("isActiveOnSchedule — weekly interval", () => {
  it("interval 1 fires every matching weekday", () => {
    const s = weekly({ interval: 1 });
    expect(isActiveOnSchedule(s, "2026-06-03")).toBe(true);
    expect(isActiveOnSchedule(s, "2026-06-10")).toBe(true);
  });
  it("interval 2 fires on the anchor week then every other week (days all on)", () => {
    const s = weekly({ interval: 2, anchor: "2026-06-03" });
    expect(isActiveOnSchedule(s, "2026-06-03")).toBe(true); // week 0
    expect(isActiveOnSchedule(s, "2026-06-10")).toBe(false); // week 1
    expect(isActiveOnSchedule(s, "2026-06-17")).toBe(true); // week 2
  });
  it("interval 3 fires on weeks 0 and 3", () => {
    const s = weekly({ interval: 3, anchor: "2026-06-03" });
    expect(isActiveOnSchedule(s, "2026-06-03")).toBe(true);
    expect(isActiveOnSchedule(s, "2026-06-10")).toBe(false);
    expect(isActiveOnSchedule(s, "2026-06-17")).toBe(false);
    expect(isActiveOnSchedule(s, "2026-06-24")).toBe(true);
  });
  it("respects the weekday mask regardless of interval", () => {
    const idx = dowIndex("2026-06-03");
    const onlyThat = Array.from({ length: 7 }, (_, k) => (k === idx ? 1 : 0));
    expect(isActiveOnSchedule(weekly({ days: onlyThat }), "2026-06-03")).toBe(true);
    expect(isActiveOnSchedule(weekly({ days: onlyThat }), "2026-06-04")).toBe(false);
  });
});

describe("isActiveOnSchedule — monthly clamp + last day", () => {
  it("day-of-month fires on that day", () => {
    expect(isActiveOnSchedule(monthly({ daysOfMonth: [1] }), "2026-07-01")).toBe(true);
    expect(isActiveOnSchedule(monthly({ daysOfMonth: [1] }), "2026-07-02")).toBe(false);
  });
  it("the 31st clamps to the month's last day in short months", () => {
    const s = monthly({ daysOfMonth: [31] });
    expect(isActiveOnSchedule(s, "2026-02-28")).toBe(true); // Feb 2026 (non-leap)
    expect(isActiveOnSchedule(s, "2026-04-30")).toBe(true); // April
    expect(isActiveOnSchedule(s, "2026-07-31")).toBe(true); // 31-day month
  });
  it("the 29th fires Feb 29 in a leap year, clamps otherwise", () => {
    const s = monthly({ daysOfMonth: [29] });
    expect(isActiveOnSchedule(s, "2028-02-29")).toBe(true); // 2028 leap
    expect(isActiveOnSchedule(s, "2026-02-28")).toBe(true); // clamp
  });
  it("lastDay fires only on the month's final day", () => {
    const s = monthly({ lastDay: true });
    expect(isActiveOnSchedule(s, "2026-04-30")).toBe(true);
    expect(isActiveOnSchedule(s, "2026-04-29")).toBe(false);
  });
  it("an empty monthly schedule never fires", () => {
    expect(isActiveOnSchedule(monthly(), "2026-04-30")).toBe(false);
  });
});

describe("nextOccurrence", () => {
  it("finds the next monthly date across the boundary", () => {
    expect(nextOccurrence(monthly({ daysOfMonth: [1] }), "2026-06-15")).toBe("2026-07-01");
  });
  it("returns null for a Never schedule", () => {
    expect(nextOccurrence(monthly(), "2026-06-15")).toBeNull();
  });
});

describe("recurrenceText", () => {
  it("labels weekly and N-weekly", () => {
    expect(recurrenceText(weekly({ days: [1, 1, 1, 1, 1, 1, 1], interval: 1 }))).toBe("Every day");
    expect(recurrenceText(weekly({ days: [1, 0, 0, 0, 0, 0, 0], interval: 2 }))).toBe(
      "Every 2 weeks on Mon",
    );
  });
  it("labels monthly", () => {
    expect(recurrenceText(monthly({ daysOfMonth: [1] }))).toBe("Monthly on the 1st");
    expect(recurrenceText(monthly({ daysOfMonth: [1, 15] }))).toBe("Monthly on the 1st and 15th");
    expect(recurrenceText(monthly({ lastDay: true }))).toBe("Monthly on the last day");
    expect(recurrenceText(monthly({ daysOfMonth: [1], lastDay: true }))).toBe(
      "Monthly on the 1st and last day",
    );
  });
});

describe("weeklyMask", () => {
  it("returns the weekly schedule days; all-zero for a monthly habit", () => {
    expect(weeklyMask({ schedule: weekly({ days: [1, 0, 1, 0, 0, 0, 0] }) } as Habit)).toEqual([
      1, 0, 1, 0, 0, 0, 0,
    ]);
    expect(weeklyMask({ schedule: monthly({ daysOfMonth: [15] }) } as Habit)).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});

describe("normalizeHabit", () => {
  it("backfills schedule from a legacy habit's days and strips dead fields", () => {
    const out = normalizeHabit({
      id: "h1",
      name: "x",
      goalId: null,
      valueId: "v",
      icon: "repeat",
      time: null,
      durationMin: 30,
      archivedAt: null,
      createdAt: "2026-01-05T08:00:00.000Z",
      days: [1, 0, 1, 0, 0, 0, 0],
      recurrence: "Mon / Wed",
    } as never);
    expect(out.schedule).toEqual({
      type: "weekly",
      days: [1, 0, 1, 0, 0, 0, 0],
      interval: 1,
      anchor: "2026-01-05",
    });
    expect("days" in out).toBe(false);
    expect("recurrence" in out).toBe(false);
    expect(isActiveOn(out, "2026-06-01")).toBe(true); // a Monday, mask index 0 on
  });

  it("preserves an existing schedule untouched (monthly)", () => {
    const schedule = { type: "monthly", daysOfMonth: [15], lastDay: false } as const;
    const out = normalizeHabit({
      id: "h2",
      name: "y",
      goalId: null,
      valueId: "v",
      icon: "repeat",
      time: null,
      durationMin: 30,
      archivedAt: null,
      createdAt: "2026-06-25",
      schedule,
      days: [1, 1, 1, 1, 1, 1, 1],
      recurrence: "Monthly on the 15th",
    } as never);
    expect(out.schedule).toEqual(schedule);
    expect("days" in out).toBe(false);
    expect("recurrence" in out).toBe(false);
  });
});
