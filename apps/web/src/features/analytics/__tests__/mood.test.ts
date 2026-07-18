import { format, subDays } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayEntry } from "@/features/journal/model";
import { computeMoodByWeekday, computeMoodSeries, downsampleMoodWeekly } from "../selectors";

// A Wednesday, so weekday math is unambiguous.
const NOW = new Date("2026-07-15T12:00:00");
const iso = (back: number) => format(subDays(NOW, back), "yyyy-MM-dd");

function moodEntry(back: number, mood: number | null): DayEntry {
  return {
    id: `e${back}`,
    date: iso(back),
    gratitude: [],
    mood,
    journal: "",
    createdAt: "",
    updatedAt: "",
  };
}

describe("computeMoodSeries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("keeps unlogged days as null gaps, not zeros", () => {
    const journal = [moodEntry(0, 4), moodEntry(3, 2)];
    const series = computeMoodSeries(journal, 7);
    expect(series).toHaveLength(7);
    expect(series[6].mood).toBe(4); // today
    expect(series[3].mood).toBe(2);
    expect(series[5].mood).toBeNull(); // gap
    expect(series.filter((d) => d.mood !== null)).toHaveLength(2);
  });

  it("a null-mood entry is a gap", () => {
    expect(computeMoodSeries([moodEntry(0, null)], 3).every((d) => d.mood === null)).toBe(true);
  });
});

describe("computeMoodByWeekday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("averages mood per weekday and leaves empty weekdays null", () => {
    // back 0 = Wed, back 7 = Wed a week earlier
    const journal = [moodEntry(0, 5), moodEntry(7, 3)];
    const byWeekday = computeMoodByWeekday(journal, 30);
    const wed = byWeekday[2];
    expect(wed.label).toBe("Wed");
    expect(wed.count).toBe(2);
    expect(wed.avg).toBeCloseTo(4);
    expect(byWeekday[0].avg).toBeNull(); // Monday had no mood
    expect(byWeekday[0].count).toBe(0);
  });
});

describe("downsampleMoodWeekly", () => {
  const point = (iso: string, mood: number | null) => ({ iso, label: iso, mood });

  it("averages logged moods within each 7-day bucket, oldest-first", () => {
    const series = [
      point("d0", 4),
      point("d1", null),
      point("d2", 2),
      point("d3", null),
      point("d4", null),
      point("d5", null),
      point("d6", null),
      point("d7", 5),
    ];
    const weekly = downsampleMoodWeekly(series);
    expect(weekly).toHaveLength(2);
    expect(weekly[0]).toEqual({ iso: "d0", label: "d0", mood: 3 }); // (4+2)/2
    expect(weekly[1]).toEqual({ iso: "d7", label: "d7", mood: 5 });
  });

  it("leaves a bucket with no logged mood as a null gap, never zero", () => {
    const empty = Array.from({ length: 7 }, (_, i) => point(`e${i}`, null));
    const weekly = downsampleMoodWeekly(empty);
    expect(weekly).toHaveLength(1);
    expect(weekly[0].mood).toBeNull();
  });
});
