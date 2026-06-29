import { describe, expect, it } from "vitest";
import { calendarEventToGPatch, gEventToCalendarEvent } from "../events-map";
import type { GEvent } from "../map";

// Tests run under TZ=UTC (vitest.config), so a UTC dateTime maps to the same wall clock.
const timed: GEvent = {
  id: "g1",
  iCalUID: "u1@google.com",
  summary: "Jazz in the Park",
  start: { dateTime: "2026-07-11T17:00:00Z" },
  end: { dateTime: "2026-07-11T20:00:00Z" },
  updated: "2026-06-20T10:00:00Z",
  status: "confirmed",
  attendees: [{ self: true, responseStatus: "accepted" }],
};

describe("gEventToCalendarEvent", () => {
  it("maps a timed event to date/time/duration", () => {
    const e = gEventToCalendarEvent(timed, "cal_personal");
    expect(e).toMatchObject({
      googleId: "g1",
      iCalUID: "u1@google.com",
      calendarId: "cal_personal",
      title: "Jazz in the Park",
      date: "2026-07-11",
      time: "17:00",
      durationMin: 180,
      allDay: false,
      status: "confirmed",
      responseStatus: "accepted",
      recurringEventId: null,
      googleUpdated: "2026-06-20T10:00:00Z",
    });
  });
  it("maps an all-day event (date only, no time, allDay true)", () => {
    const e = gEventToCalendarEvent(
      {
        id: "g2",
        iCalUID: "u2",
        start: { date: "2026-07-05" },
        end: { date: "2026-07-06" },
        status: "confirmed",
      },
      "cal_personal",
    );
    expect(e).toMatchObject({ date: "2026-07-05", time: null, allDay: true, durationMin: 0 });
  });
  it("captures a cancelled deletion and a declined self-response", () => {
    expect(gEventToCalendarEvent({ id: "g3", status: "cancelled" }, "c").status).toBe("cancelled");
    expect(
      gEventToCalendarEvent(
        { id: "g4", status: "confirmed", attendees: [{ self: true, responseStatus: "declined" }] },
        "c",
      ).responseStatus,
    ).toBe("declined");
  });
  it("falls back to googleId when iCalUID is absent (dedupe still keyed safely)", () => {
    const e = gEventToCalendarEvent(
      { id: "g5", status: "confirmed", start: { date: "2026-07-01" } },
      "c",
    );
    expect(e.iCalUID).toBe("g5");
  });
});

describe("calendarEventToGPatch", () => {
  it("emits a timed start/end patch from a CalendarEvent", () => {
    const patch = calendarEventToGPatch({
      title: "Date night",
      date: "2026-07-04",
      time: "19:30",
      durationMin: 90,
      allDay: false,
    });
    expect(patch.summary).toBe("Date night");
    expect(patch.start?.dateTime).toMatch(/^2026-07-04T19:30:00/);
    expect(patch.end?.dateTime).toMatch(/^2026-07-04T21:00:00/);
  });
  it("emits an all-day start/end patch", () => {
    const patch = calendarEventToGPatch({
      title: "Trip",
      date: "2026-07-05",
      time: null,
      durationMin: 0,
      allDay: true,
    });
    expect(patch.start?.date).toBe("2026-07-05");
  });
});
