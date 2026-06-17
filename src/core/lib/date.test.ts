import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addMinutes, daysBetween, dowIndex, minutesOf, todayISO, weekDays } from "./date";

describe("minutesOf", () => {
  it("converts HH:mm to minutes since midnight", () => {
    expect(minutesOf("00:00")).toBe(0);
    expect(minutesOf("09:30")).toBe(570);
    expect(minutesOf("23:59")).toBe(1439);
  });
});

describe("addMinutes", () => {
  it("adds within the day", () => {
    expect(addMinutes("09:00", 90)).toBe("10:30");
  });
  it("wraps past midnight", () => {
    expect(addMinutes("23:30", 60)).toBe("00:30");
  });
});

describe("dowIndex", () => {
  it("returns Mon=0 .. Sun=6", () => {
    expect(dowIndex("2026-06-15")).toBe(0); // Monday
    expect(dowIndex("2026-06-19")).toBe(4); // Friday
    expect(dowIndex("2026-06-21")).toBe(6); // Sunday
  });
});

describe("daysBetween", () => {
  it("counts calendar days a - b", () => {
    expect(daysBetween("2026-06-17", "2026-06-15")).toBe(2);
    expect(daysBetween("2026-06-15", "2026-06-17")).toBe(-2);
    expect(daysBetween("2026-06-15", "2026-06-15")).toBe(0);
  });
});

describe("weekDays / todayISO", () => {
  beforeEach(() => vi.setSystemTime(new Date("2026-06-15T08:00:00"))); // a Monday
  afterEach(() => vi.useRealTimers());

  it("builds a Monday-anchored week with today flagged", () => {
    const days = weekDays();
    expect(days).toHaveLength(7);
    expect(days[0].iso).toBe("2026-06-15");
    expect(days[0].dow).toBe("Mon");
    expect(days[0].today).toBe(true);
    expect(days[6].iso).toBe("2026-06-21"); // Sunday
    expect(days.map((d) => d.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("todayISO reflects the system date", () => {
    expect(todayISO()).toBe("2026-06-15");
  });
});
