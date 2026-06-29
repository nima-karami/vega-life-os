import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/features/calendar-sync/events-model";
import { allDayLivedForDay, timedLivedForDay } from "../grid-data";

const e = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "ce",
  googleId: "g",
  iCalUID: "u",
  calendarId: "c",
  title: "X",
  date: "2026-07-04",
  endDate: "2026-07-04",
  time: "20:00",
  durationMin: 60,
  allDay: false,
  recurringEventId: null,
  googleUpdated: null,
  status: "confirmed",
  responseStatus: "accepted",
  valueId: null,
  goalId: null,
  note: "",
  vegaEditedAt: null,
  pendingDelete: false,
  removedAt: null,
  ...over,
});

describe("lived-event grid partition", () => {
  it("timed events match the day and have a time", () => {
    expect(
      timedLivedForDay([e({}), e({ id: "x", date: "2026-07-05" })], "2026-07-04"),
    ).toHaveLength(1);
  });
  it("all-day events match the day and have no time", () => {
    expect(
      allDayLivedForDay([e({ allDay: true, time: null, endDate: "2026-07-04" })], "2026-07-04"),
    ).toHaveLength(1);
    expect(
      timedLivedForDay([e({ allDay: true, time: null, endDate: "2026-07-04" })], "2026-07-04"),
    ).toHaveLength(0);
  });

  describe("multi-day spans show on every covered day, in the all-day row", () => {
    const span = e({ allDay: true, time: null, date: "2026-07-04", endDate: "2026-07-08" });
    it("appears in the all-day row on the first, a middle, and the last day", () => {
      for (const day of ["2026-07-04", "2026-07-06", "2026-07-08"]) {
        expect(allDayLivedForDay([span], day)).toHaveLength(1);
      }
    });
    it("does not appear before it starts or after it ends", () => {
      expect(allDayLivedForDay([span], "2026-07-03")).toHaveLength(0);
      expect(allDayLivedForDay([span], "2026-07-09")).toHaveLength(0);
    });
    it("a ≥24h timed block is treated as a multi-day all-day span, not a timed chip", () => {
      const longTimed = e({
        date: "2026-07-04",
        endDate: "2026-07-06",
        time: "10:00",
        durationMin: 48 * 60,
      });
      expect(timedLivedForDay([longTimed], "2026-07-04")).toHaveLength(0);
      expect(allDayLivedForDay([longTimed], "2026-07-05")).toHaveLength(1);
    });
    it("a short timed block crossing midnight stays a single-day timed chip", () => {
      const crossMidnight = e({
        date: "2026-07-04",
        endDate: "2026-07-05",
        time: "23:00",
        durationMin: 120,
      });
      expect(timedLivedForDay([crossMidnight], "2026-07-04")).toHaveLength(1);
      expect(allDayLivedForDay([crossMidnight], "2026-07-05")).toHaveLength(0);
    });
  });
});
