import { describe, expect, it } from "vitest";
import { dowIndex } from "@/core/lib/date";
import type { Habit, HabitSchedule } from "../model";
import {
  describeRecurrence,
  findSlotOnOrBefore,
  getNextOccurrence,
  getWeeklyMask,
  isActiveOn,
  isActiveOnSchedule,
  normalizeHabit,
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

describe("findSlotOnOrBefore — anchor a task to the slot it fulfils", () => {
  // Mon/Tue/Thu/Fri (Mon..Sun mask)
  const workout = weekly({ days: [1, 1, 0, 1, 1, 0, 0] });
  it("returns the day itself when it is scheduled", () => {
    expect(findSlotOnOrBefore(workout, "2026-06-26")).toBe("2026-06-26"); // Fri
  });
  it("walks back to the latest scheduled day for an unscheduled day", () => {
    expect(findSlotOnOrBefore(workout, "2026-06-27")).toBe("2026-06-26"); // Sat → Fri
    expect(findSlotOnOrBefore(workout, "2026-06-28")).toBe("2026-06-26"); // Sun → Fri
  });
  it("returns null for a Never schedule", () => {
    expect(findSlotOnOrBefore(weekly({ days: [0, 0, 0, 0, 0, 0, 0] }), "2026-06-27")).toBeNull();
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

describe("getNextOccurrence", () => {
  it("finds the next monthly date across the boundary", () => {
    expect(getNextOccurrence(monthly({ daysOfMonth: [1] }), "2026-06-15")).toBe("2026-07-01");
  });
  it("returns null for a Never schedule", () => {
    expect(getNextOccurrence(monthly(), "2026-06-15")).toBeNull();
  });
});

describe("describeRecurrence", () => {
  it("labels weekly and N-weekly", () => {
    expect(describeRecurrence(weekly({ days: [1, 1, 1, 1, 1, 1, 1], interval: 1 }))).toBe(
      "Every day",
    );
    expect(describeRecurrence(weekly({ days: [1, 0, 0, 0, 0, 0, 0], interval: 2 }))).toBe(
      "Every 2 weeks on Mon",
    );
  });
  it("labels monthly", () => {
    expect(describeRecurrence(monthly({ daysOfMonth: [1] }))).toBe("Monthly on the 1st");
    expect(describeRecurrence(monthly({ daysOfMonth: [1, 15] }))).toBe(
      "Monthly on the 1st and 15th",
    );
    expect(describeRecurrence(monthly({ lastDay: true }))).toBe("Monthly on the last day");
    expect(describeRecurrence(monthly({ daysOfMonth: [1], lastDay: true }))).toBe(
      "Monthly on the 1st and last day",
    );
  });
});

describe("getWeeklyMask", () => {
  it("returns the weekly schedule days; all-zero for a monthly habit", () => {
    expect(getWeeklyMask({ schedule: weekly({ days: [1, 0, 1, 0, 0, 0, 0] }) } as Habit)).toEqual([
      1, 0, 1, 0, 0, 0, 0,
    ]);
    expect(getWeeklyMask({ schedule: monthly({ daysOfMonth: [15] }) } as Habit)).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});

describe("normalizeHabit", () => {
  const legacy = {
    id: "h9",
    name: "x",
    goalId: null,
    valueId: "v",
    icon: "repeat",
    time: null,
    durationMin: 30,
    archivedAt: null,
    createdAt: "2026-01-05",
    days: [1, 1, 1, 1, 1, 1, 1],
  };

  it("loads a legacy habit as tracked with an empty plan", () => {
    const out = normalizeHabit(legacy as never);
    expect(out.tracked).toBe(true);
    expect(out.plan).toBe("");
  });

  it("keeps an explicit untracked flag and plan", () => {
    const out = normalizeHabit({ ...legacy, tracked: false, plan: "When X, Y." } as never);
    expect(out.tracked).toBe(false);
    expect(out.plan).toBe("When X, Y.");
  });

  it("defaults pausedSpans to [] on a legacy record", () => {
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
      days: [1, 1, 1, 1, 1, 1, 1],
    } as never);
    expect(out.pausedSpans).toEqual([]);
  });

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

  it("defaults pausedAt and resumedAt to null on a legacy record that lacks them", () => {
    const out = normalizeHabit({
      id: "h3",
      name: "z",
      goalId: null,
      valueId: "v",
      icon: "repeat",
      time: null,
      durationMin: 30,
      createdAt: "2026-01-05",
      schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: "2026-01-05" },
    } as never);
    expect(out.pausedAt).toBeNull();
    expect(out.resumedAt).toBeNull();
    expect(out.archivedAt).toBeNull();
  });
});
