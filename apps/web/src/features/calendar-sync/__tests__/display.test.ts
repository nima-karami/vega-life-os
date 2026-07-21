import type { CalendarEvent } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { dedupeForDisplay, filterVisibleEvents } from "../display";

function event(over: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "ce_1",
    googleId: "g1",
    iCalUID: "u1",
    calendarId: "cal-a",
    title: "E",
    date: "2026-07-21",
    endDate: "2026-07-21",
    time: null,
    durationMin: 0,
    allDay: true,
    recurringEventId: null,
    googleUpdated: null,
    status: "confirmed",
    responseStatus: null,
    valueId: null,
    goalId: null,
    note: "",
    vegaEditedAt: null,
    pendingDelete: false,
    removedAt: null,
    updatedAt: "2026-07-20T00:00:00.000Z",
    fieldUpdatedAt: {},
    ...over,
  };
}

describe("filterVisibleEvents", () => {
  it("hides calendars toggled off, declined invites, and removed rows", () => {
    const events = [
      event({ id: "ce_1", calendarId: "cal-a" }),
      event({ id: "ce_2", calendarId: "cal-b", iCalUID: "u2", googleId: "g2" }),
      event({ id: "ce_3", iCalUID: "u3", googleId: "g3", responseStatus: "declined" }),
      event({ id: "ce_4", iCalUID: "u4", googleId: "g4", removedAt: "2026-07-20T00:00:00.000Z" }),
    ];
    const visible = filterVisibleEvents(events, { "cal-b": { visible: false } });
    expect(visible.map((row) => row.id)).toEqual(["ce_1"]);
  });

  it("treats a calendar with no pref as visible", () => {
    const events = [event({ id: "ce_1", calendarId: "cal-unknown" })];
    expect(filterVisibleEvents(events, {})).toHaveLength(1);
  });
});

describe("dedupeForDisplay", () => {
  it("collapses two rows sharing an iCalUID into one (shared invite)", () => {
    const events = [event({ id: "ce_1", googleId: "g1" }), event({ id: "ce_2", googleId: "g2" })];
    expect(dedupeForDisplay(events).map((row) => row.id)).toEqual(["ce_1"]);
  });

  it("keeps a declined invite when it carries a value, goal, or note", () => {
    const events = [event({ id: "ce_1", responseStatus: "declined", valueId: "v1" })];
    expect(dedupeForDisplay(events).map((row) => row.id)).toEqual(["ce_1"]);
  });

  it("excludes a removed row", () => {
    const events = [event({ id: "ce_1", removedAt: "2026-07-20T00:00:00.000Z" })];
    expect(dedupeForDisplay(events)).toHaveLength(0);
  });

  it("excludes a row pending deletion", () => {
    const events = [event({ id: "ce_1", pendingDelete: true })];
    expect(dedupeForDisplay(events)).toHaveLength(0);
  });
});
