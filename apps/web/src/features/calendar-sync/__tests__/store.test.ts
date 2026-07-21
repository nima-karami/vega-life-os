import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/store/persist", () => ({ savePut: vi.fn(), saveRemove: vi.fn() }));

const { setCalendarVisibility } = vi.hoisted(() => ({
  setCalendarVisibility: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/core/persistence/trpc-client", () => ({
  getTrpcClient: () => ({ calendar: { setCalendarVisibility: { mutate: setCalendarVisibility } } }),
}));

import type { CalendarEvent } from "@vega/shared";
import { create } from "zustand";
import { type CalendarEventsSlice, createCalendarEventsSlice, type GcalStatus } from "../store";

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
  updatedAt: "2026-07-04T00:00:00.000Z",
  fieldUpdatedAt: {},
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
  it("visibleEvents drops rows on a calendar toggled off", () => {
    const s = mk([ev({ id: "ce_a", calendarId: "hidden" })]);
    s.setState({
      gcalStatus: statusWith({ hidden: { visible: false, summary: "H", color: null } }),
    });
    expect(s.getState().visibleEvents()).toHaveLength(0);
  });
});

const statusWith = (calendarPrefs: GcalStatus["calendarPrefs"]): GcalStatus => ({
  connected: true,
  needsReauth: false,
  writeCalendarMissing: false,
  writeCalendarId: "cal_vega",
  readCalendarIds: ["primary"],
  calendarPrefs,
  lastSyncedAt: null,
  backoffUntil: null,
  timeZone: null,
});

describe("setCalendarVisible", () => {
  it("optimistically flips the pref and fires the mutation", () => {
    const s = mk([]);
    s.setState({
      gcalStatus: statusWith({ work: { visible: true, summary: "Work", color: "#123" } }),
    });
    s.getState().setCalendarVisible("work", false);
    expect(s.getState().gcalStatus?.calendarPrefs.work).toEqual({
      visible: false,
      summary: "Work",
      color: "#123",
    });
    expect(setCalendarVisibility).toHaveBeenCalledWith({ calendarId: "work", visible: false });
  });
  it("does nothing without a connected status", () => {
    const s = mk([]);
    s.getState().setCalendarVisible("work", false);
    expect(setCalendarVisibility).not.toHaveBeenCalled();
  });
});

describe("showGoogleEvents", () => {
  it("hydrates and toggles the display pref", () => {
    const s = mk([]);
    expect(s.getState().showGoogleEvents).toBe(true);
    s.getState().setShowGoogleEvents(false);
    expect(s.getState().showGoogleEvents).toBe(false);
    s.getState().hydrateShowGoogleEvents(true);
    expect(s.getState().showGoogleEvents).toBe(true);
  });
});
