import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/store/persist", () => ({ savePut: vi.fn(), saveRemove: vi.fn() }));

import { create } from "zustand";
import type { CalendarEvent } from "../events-model";
import { type CalendarEventsSlice, createCalendarEventsSlice } from "../store";

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "ce_1",
  googleId: "g1",
  iCalUID: "u1",
  calendarId: "cal",
  title: "Show",
  date: "2026-07-04",
  endDate: "2026-07-04",
  time: "20:00",
  durationMin: 180,
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

const mk = (seed: CalendarEvent[]) => {
  const s = create<CalendarEventsSlice>((set, get, api) =>
    createCalendarEventsSlice(set as never, get as never, api as never),
  );
  s.setState({ calendarEvents: seed });
  return s;
};

beforeEach(() => vi.clearAllMocks());

describe("tagEvent", () => {
  it("sets the value and propagates to every row sharing the iCalUID", () => {
    const s = mk([
      ev({ id: "ce_a", googleId: "ga", calendarId: "personal" }),
      ev({ id: "ce_b", googleId: "gb", calendarId: "work" }),
    ]);
    s.getState().tagEvent("ce_a", { valueId: "v_presence" });
    expect(s.getState().calendarEvents.every((e) => e.valueId === "v_presence")).toBe(true);
  });
  it("clears goalId when the caller passes null on a value change", () => {
    const s = mk([ev({ valueId: "v_old", goalId: "g_old" })]);
    s.getState().tagEvent("ce_1", { valueId: "v_new", goalId: null });
    expect(s.getState().calendarEvents[0]).toMatchObject({ valueId: "v_new", goalId: null });
  });
});

describe("editEventTime / renameEvent / markEventForDelete", () => {
  it("stamps vegaEditedAt on a time edit", () => {
    const s = mk([ev({})]);
    s.getState().editEventTime("ce_1", { date: "2026-07-04", time: "21:00", durationMin: 120 });
    const e = s.getState().calendarEvents[0];
    expect(e).toMatchObject({ time: "21:00", durationMin: 120 });
    expect(e.vegaEditedAt).not.toBeNull();
  });
  it("stamps vegaEditedAt on a rename", () => {
    const s = mk([ev({})]);
    s.getState().renameEvent("ce_1", "Renamed");
    const e = s.getState().calendarEvents[0];
    expect(e.title).toBe("Renamed");
    expect(e.vegaEditedAt).not.toBeNull();
  });
  it("flags pendingDelete", () => {
    const s = mk([ev({})]);
    s.getState().markEventForDelete("ce_1");
    expect(s.getState().calendarEvents[0].pendingDelete).toBe(true);
  });
});

describe("applyLivedSync / visibleEvents", () => {
  it("replaces only the target calendar's rows and drops by id", () => {
    const s = mk([
      ev({ id: "ce_keep", calendarId: "other" }),
      ev({ id: "ce_old", calendarId: "personal" }),
    ]);
    s.getState().applyLivedSync(
      "personal",
      [ev({ id: "ce_new", calendarId: "personal", googleId: "gN", iCalUID: "uN" })],
      ["ce_old"],
    );
    const ids = s
      .getState()
      .calendarEvents.map((e) => e.id)
      .sort();
    expect(ids).toEqual(["ce_keep", "ce_new"]);
  });
  it("visibleEvents dedupes shared invites", () => {
    const s = mk([
      ev({ id: "ce_a", iCalUID: "shared" }),
      ev({ id: "ce_b", googleId: "gb", iCalUID: "shared" }),
    ]);
    expect(s.getState().visibleEvents()).toHaveLength(1);
  });
});
