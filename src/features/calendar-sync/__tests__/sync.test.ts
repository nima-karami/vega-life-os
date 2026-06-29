import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
  saveBulk: vi.fn(),
}));

const calls = { patched: [] as string[], deleted: [] as string[], inserted: [] as unknown[] };
vi.mock("../gcal", () => ({
  listEvents: vi.fn(async (_cal: string, o: { filtered: boolean }) =>
    o.filtered
      ? { events: [], nextSyncToken: "tok", expired: false }
      : {
          events: [
            {
              id: "g1",
              iCalUID: "u1",
              summary: "Show",
              status: "confirmed",
              start: { dateTime: "2026-07-11T17:00:00Z" },
              end: { dateTime: "2026-07-11T20:00:00Z" },
              updated: "2026-06-20T10:00:00Z",
            },
          ],
          nextSyncToken: "tok",
          expired: false,
        },
  ),
  insertEvent: vi.fn(async (_c: string, b: unknown) => {
    calls.inserted.push(b);
    return b;
  }),
  patchEvent: vi.fn(async (_c: string, id: string) => {
    calls.patched.push(id);
  }),
  deleteEvent: vi.fn(async (_c: string, id: string) => {
    calls.deleted.push(id);
  }),
}));
vi.mock("../calendars", () => ({ ensureVegaCalendar: vi.fn(async () => "cal_vega") }));
vi.mock("../state", () => ({
  getReadCalendarIds: () => ["cal_personal"],
  getWriteCalendarId: () => "cal_vega",
  getSyncToken: () => null,
  setSyncToken: vi.fn(),
  getWindow: () => ({ backDays: 28, fwdDays: 56 }),
  getShowGoogleEvents: () => true,
  setShowGoogleEvents: vi.fn(),
}));

import { useStore } from "@/core/store";
import type { CalendarEvent } from "../events-model";
import { syncNow } from "../sync";

const ce = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "ce",
  googleId: "g",
  iCalUID: "u",
  calendarId: "cal_personal",
  title: "X",
  date: "2026-07-04",
  time: "10:00",
  durationMin: 30,
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

beforeEach(() => {
  calls.patched = [];
  calls.deleted = [];
  calls.inserted = [];
  useStore.setState({ tasks: [], calendarEvents: [] });
});

describe("syncNow — lived lane", () => {
  it("pulls an external event into a mirror", async () => {
    const r = await syncNow(false);
    expect(r.lived).toBeGreaterThanOrEqual(1);
    expect(useStore.getState().calendarEvents[0]).toMatchObject({
      googleId: "g1",
      title: "Show",
      valueId: null,
    });
  });

  it("pushes a pending edit and a pending delete back to Google", async () => {
    useStore.setState({
      calendarEvents: [
        ce({ id: "ce_e", googleId: "ge", iCalUID: "ue", vegaEditedAt: "2026-06-27T00:00:00Z" }),
        ce({ id: "ce_d", googleId: "gd", iCalUID: "ud", pendingDelete: true }),
      ],
    });
    await syncNow(false);
    expect(calls.patched).toContain("ge");
    expect(calls.deleted).toContain("gd");
    expect(useStore.getState().calendarEvents.find((e) => e.id === "ce_d")).toBeUndefined();
  });
});
