import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMinutes,
  daysBetween,
  dowIndex,
  formatRelativeDay,
  getWeekDays,
  minutesOf,
  shiftISO,
  todayISO,
  weekRefFor,
} from "./date";
import { getZonedWallClock } from "./zone";

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

describe("shiftISO", () => {
  it("steps forward and backward across month boundaries", () => {
    expect(shiftISO("2026-06-22", 1)).toBe("2026-06-23");
    expect(shiftISO("2026-06-22", -1)).toBe("2026-06-21");
    expect(shiftISO("2026-06-30", 1)).toBe("2026-07-01");
    expect(shiftISO("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftISO("2026-06-22", 0)).toBe("2026-06-22");
  });
});

describe("formatRelativeDay", () => {
  const ref = "2026-06-22"; // a Monday
  it("labels adjacent days", () => {
    expect(formatRelativeDay("2026-06-22", ref)).toBe("Today");
    expect(formatRelativeDay("2026-06-23", ref)).toBe("Tomorrow");
    expect(formatRelativeDay("2026-06-21", ref)).toBe("Yesterday");
  });
  it("falls back to the weekday name for further dates", () => {
    expect(formatRelativeDay("2026-06-27", ref)).toBe("Saturday");
    expect(formatRelativeDay("2026-06-18", ref)).toBe("Thursday");
  });
  it("defaults the reference to today", () => {
    vi.setSystemTime(new Date("2026-06-22T08:00:00"));
    expect(formatRelativeDay("2026-06-22")).toBe("Today");
    vi.useRealTimers();
  });
});

describe("getWeekDays / todayISO", () => {
  beforeEach(() => vi.setSystemTime(new Date("2026-06-15T08:00:00"))); // a Monday
  afterEach(() => vi.useRealTimers());

  it("builds a Monday-anchored week with today flagged", () => {
    const days = getWeekDays();
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

  // A Monday pins both anchors at 0, so the invariant is only load-bearing off a Monday.
  it("dowIndex agrees with the flagged day off a Monday", () => {
    for (const iso of ["2026-06-17", "2026-06-19", "2026-06-21"]) {
      vi.setSystemTime(new Date(`${iso}T08:00:00`));
      expect(dowIndex(todayISO())).toBe(getWeekDays().findIndex((d) => d.today));
    }
  });
});

/**
 * The calendar grid seeds a week reference from a date and flags its columns against a
 * display-zone today. Seeding from the browser instant while flagging in the display zone
 * lets the two land in different Mon-anchored weeks, and the grid then has no today column
 * at all — silently dropping the highlight, aria-current, the now-line and the backlog drop
 * target. No e2e here can reach it: it needs display zone != browser zone, which the
 * signed-out sandbox never produces.
 */
describe("the calendar grid's week reference", () => {
  // The runner pins TZ=UTC, so UTC is the browser zone and New York sits 4h behind it.
  const instant = Date.UTC(2026, 8, 21, 2, 0);
  const todayIn = (zone: string) => getZonedWallClock(instant, zone).date;

  it("loses today entirely when the week is seeded from the browser instant", () => {
    const todayIso = todayIn("America/New_York");
    expect(todayIso).toBe("2026-09-20");
    const days = getWeekDays(new Date(instant), todayIso);
    expect(days[0].iso).toBe("2026-09-21");
    expect(days.some((d) => d.today)).toBe(false);
  });

  it("always contains its own today when seeded from the display-zone day", () => {
    const todayIso = todayIn("America/New_York");
    const days = getWeekDays(weekRefFor(todayIso), todayIso);
    expect(days.find((d) => d.today)?.iso).toBe(todayIso);
    expect(dowIndex(todayIso)).toBe(days.findIndex((d) => d.today));
  });

  it("holds every hour of the day, either side of the browser", () => {
    for (const zone of ["America/New_York", "Asia/Tokyo", "UTC"]) {
      for (let hour = 0; hour < 24; hour += 1) {
        const todayIso = getZonedWallClock(Date.UTC(2026, 8, 21, hour, 0), zone).date;
        const days = getWeekDays(weekRefFor(todayIso), todayIso);
        expect(days.find((d) => d.today)?.iso).toBe(todayIso);
        expect(dowIndex(todayIso)).toBe(days.findIndex((d) => d.today));
      }
    }
  });
});
