import { format, subDays } from "date-fns";
import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/features/calendar-sync/events-model";
import { valueTime } from "../selectors";

const recent = format(subDays(new Date(), 2), "yyyy-MM-dd");

const ce = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "ce",
  googleId: "g",
  iCalUID: "u",
  calendarId: "c",
  title: "X",
  date: recent,
  time: "20:00",
  durationMin: 180,
  allDay: false,
  recurringEventId: null,
  googleUpdated: null,
  status: "confirmed",
  responseStatus: "accepted",
  valueId: "v_connection",
  goalId: null,
  note: "",
  vegaEditedAt: null,
  pendingDelete: false,
  removedAt: null,
  ...over,
});

describe("valueTime", () => {
  it("credits a timed tagged event's duration to its value", () => {
    expect(valueTime([ce({})]).v_connection).toEqual({ minutes: 180, occurrences: 1 });
  });
  it("credits an all-day tagged event as one occurrence, zero minutes", () => {
    expect(valueTime([ce({ allDay: true, time: null, durationMin: 0 })]).v_connection).toEqual({
      minutes: 0,
      occurrences: 1,
    });
  });
  it("ignores untagged events", () => {
    expect(valueTime([ce({ valueId: null })])).toEqual({});
  });
  it("ignores events older than the window", () => {
    expect(valueTime([ce({ date: format(subDays(new Date(), 90), "yyyy-MM-dd") })])).toEqual({});
  });
  it("still counts tagged-past events removed in Google (history preserved)", () => {
    expect(valueTime([ce({ removedAt: "2026-07-10T00:00:00Z" })]).v_connection.occurrences).toBe(1);
  });
});
