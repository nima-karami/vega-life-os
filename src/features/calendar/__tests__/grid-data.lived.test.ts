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
    expect(allDayLivedForDay([e({ allDay: true, time: null })], "2026-07-04")).toHaveLength(1);
    expect(timedLivedForDay([e({ allDay: true, time: null })], "2026-07-04")).toHaveLength(0);
  });
});
