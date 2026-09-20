import { parseISO } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMinutes,
  daysBetween,
  dowIndex,
  formatRelativeDay,
  getWeekDays,
  getWeekDaysFor,
  minutesOf,
  shiftISO,
  todayISO,
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
 * The grid's columns and the day they are flagged against must come from one zone. Any week
 * held as a snapshot breaks that: the snapshot is taken in whatever zone was resolved at the
 * time, and the grid then has no today column at all — no highlight, no aria-current, no
 * now-line, and a backlog drop landing on the wrong day. Holding an offset instead and
 * deriving the week per render is what makes the whole class unrepresentable.
 *
 * None of this is reachable from an e2e here: it needs display zone != browser zone, which
 * the signed-out sandbox cannot produce.
 */
describe("the calendar grid's week", () => {
  // The runner pins TZ=UTC, so UTC stands in for the browser zone and New York sits 4h behind.
  const instant = Date.UTC(2026, 8, 21, 2, 0);
  const todayIn = (zone: string) => getZonedWallClock(instant, zone).date;

  // Pinned so these read the same on any day: an implementation that reached for the wall
  // clock instead of the ISO it was handed would otherwise pass whenever the real week
  // happened to match, which is most weeks.
  beforeEach(() => vi.setSystemTime(new Date(instant)));
  afterEach(() => vi.useRealTimers());

  it("loses today entirely when the week is seeded from the browser instant", () => {
    const todayIso = todayIn("America/New_York");
    expect(todayIso).toBe("2026-09-20");
    const days = getWeekDays(new Date(instant), todayIso);
    expect(days[0].iso).toBe("2026-09-21");
    expect(days.some((d) => d.today)).toBe(false);
  });

  /**
   * The boot order is `ready: true` -> render -> `await refreshGcalStatus()`, so a signed-in
   * user's first paint has no account zone and the display zone only resolves afterwards. A
   * reference captured at mount describes the browser's week for the rest of the session.
   */
  it("still has a today column when the zone resolves after the first render", () => {
    const atBoot = todayIn("UTC"); // gcalStatus still null — browser zone
    const settled = todayIn("America/New_York"); // account zone lands
    expect(atBoot).toBe("2026-09-21");
    expect(settled).toBe("2026-09-20");

    const snapshotTakenAtMount = getWeekDays(parseISO(atBoot), settled);
    expect(snapshotTakenAtMount.some((d) => d.today)).toBe(false);

    expect(getWeekDaysFor(settled).find((d) => d.today)?.iso).toBe(settled);
  });

  it("always contains its own today, every hour, either side of the browser", () => {
    for (const zone of ["America/New_York", "Asia/Tokyo", "UTC"]) {
      for (let hour = 0; hour < 24; hour += 1) {
        const todayIso = getZonedWallClock(Date.UTC(2026, 8, 21, hour, 0), zone).date;
        const days = getWeekDaysFor(todayIso);
        expect(days.find((d) => d.today)?.iso).toBe(todayIso);
        expect(dowIndex(todayIso)).toBe(days.findIndex((d) => d.today));
      }
    }
  });

  it("steps whole weeks by offset and flags today only on the current one", () => {
    const todayIso = todayIn("America/New_York");
    expect(getWeekDaysFor(todayIso, 0)[0].iso).toBe("2026-09-14");
    expect(getWeekDaysFor(todayIso, -1)[0].iso).toBe("2026-09-07");
    expect(getWeekDaysFor(todayIso, 1)[0].iso).toBe("2026-09-21");
    expect(getWeekDaysFor(todayIso, -1).some((d) => d.today)).toBe(false);
    expect(getWeekDaysFor(todayIso, 1).some((d) => d.today)).toBe(false);
    // Returning to 0 restores it — the offset carries no zone of its own.
    expect(getWeekDaysFor(todayIso, 0).some((d) => d.today)).toBe(true);
  });

  it("keeps an offset week correct across a zone change", () => {
    // Same offset, zone resolves mid-session: the week must move with the day, not stay put.
    expect(getWeekDaysFor(todayIn("UTC"), 1)[0].iso).toBe("2026-09-28");
    expect(getWeekDaysFor(todayIn("America/New_York"), 1)[0].iso).toBe("2026-09-21");
  });
});
