import { describe, expect, it } from "vitest";
import type { DayEntry } from "@/features/journal/model";
import { computeMoodWeek, describeMoodDelta } from "../mood";

const entry = (date: string, mood: number | null): DayEntry => ({
  id: `d_${date}`,
  date,
  gratitude: [],
  mood,
  journal: "",
  createdAt: `${date}T08:00:00.000Z`,
  updatedAt: `${date}T08:00:00.000Z`,
});
const WEEK = "2026-07-13"; // a Monday

describe("computeMoodWeek", () => {
  it("averages only logged days up to today and builds a 7-day strip", () => {
    const journal = [entry("2026-07-13", 4), entry("2026-07-14", 3), entry("2026-07-16", 5)];
    const week = computeMoodWeek(journal, WEEK, "2026-07-16");
    expect(week.days).toHaveLength(7);
    expect(week.days[0]).toEqual({ iso: "2026-07-13", mood: 4 });
    expect(week.weekAvg).toBe(4); // (4+3+5)/3
    expect(week.loggedCount).toBe(3);
  });

  it("ignores moods dated after today (in-progress and future weeks)", () => {
    const journal = [entry("2026-07-13", 2), entry("2026-07-18", 5)];
    const week = computeMoodWeek(journal, WEEK, "2026-07-15");
    expect(week.weekAvg).toBe(2);
    expect(week.loggedCount).toBe(1);
    expect(week.days[5].mood).toBeNull(); // future day renders empty
  });

  it("computes the trailing-28-day baseline and withholds it under 3 logged days", () => {
    const baseline = [entry("2026-07-01", 3), entry("2026-07-05", 3), entry("2026-07-10", 3)];
    const thin = baseline.slice(0, 2);
    expect(computeMoodWeek(baseline, WEEK, "2026-07-16").baselineAvg).toBe(3);
    expect(computeMoodWeek(thin, WEEK, "2026-07-16").baselineAvg).toBeNull();
  });

  it("baseline window is exactly the 28 days before the week's Monday", () => {
    const journal = [
      entry("2026-06-14", 1), // 29 days before — excluded
      entry("2026-06-15", 5),
      entry("2026-06-20", 5),
      entry("2026-07-12", 5),
    ];
    expect(computeMoodWeek(journal, WEEK, "2026-07-16").baselineAvg).toBe(5);
  });
});

describe("describeMoodDelta", () => {
  const base = { days: [], loggedCount: 3, baselineCount: 4 };
  it("classifies above / below / par with the 0.05 dead zone", () => {
    expect(describeMoodDelta({ ...base, weekAvg: 3.8, baselineAvg: 3.4 })).toEqual({
      direction: "above",
      amount: 0.4,
    });
    expect(describeMoodDelta({ ...base, weekAvg: 3.1, baselineAvg: 3.4 })).toEqual({
      direction: "below",
      amount: 0.3,
    });
    expect(describeMoodDelta({ ...base, weekAvg: 3.42, baselineAvg: 3.4 })?.direction).toBe("par");
  });
  it("is null without a week average or baseline", () => {
    expect(describeMoodDelta({ ...base, weekAvg: null, baselineAvg: 3.4 })).toBeNull();
    expect(describeMoodDelta({ ...base, weekAvg: 3.8, baselineAvg: null })).toBeNull();
  });
});
