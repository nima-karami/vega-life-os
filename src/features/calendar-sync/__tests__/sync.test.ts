import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
  saveBulk: vi.fn(),
}));

const calls = { patched: [] as string[], deleted: [] as string[], inserted: [] as unknown[] };
vi.mock("../gcal", () => ({
  GcalHttpError: class extends Error {
    constructor(public status: number) {
      super(`gcal ${status}`);
      this.name = "GcalHttpError";
    }
  },
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
  getSyncToken: () => null,
  setSyncToken: vi.fn(),
  getWindow: () => ({ backDays: 28, fwdDays: 56 }),
}));

import { useStore } from "@/core/store";
import { ensureVegaCalendar } from "../calendars";
import { defaultGcalConfig } from "../config";
import type { CalendarEvent } from "../events-model";
import { GcalHttpError, listEvents } from "../gcal";
import { syncNow } from "../sync";

const gcal = (over: Partial<ReturnType<typeof defaultGcalConfig>> = {}) => ({
  ...defaultGcalConfig(),
  enabled: true,
  writeCalendarId: "cal_vega",
  readCalendarIds: ["cal_personal"],
  ...over,
});

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
  useStore.setState({ tasks: [], calendarEvents: [], gcal: gcal() });
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

  it("never reads the VEGA write-calendar as a source (no loop)", async () => {
    useStore.setState({ gcal: gcal({ readCalendarIds: ["cal_personal", "cal_vega"] }) });
    vi.mocked(listEvents).mockClear();
    await syncNow(false);
    const readVegaUnfiltered = vi
      .mocked(listEvents)
      .mock.calls.some(([cal, opts]) => cal === "cal_vega" && opts.filtered === false);
    expect(readVegaUnfiltered).toBe(false);
  });

  it("no-ops when sync is disabled", async () => {
    useStore.setState({ gcal: gcal({ enabled: false }) });
    vi.mocked(listEvents).mockClear();
    const r = await syncNow(false);
    expect(r).toEqual({ pushed: 0, pulled: 0, lived: 0 });
    expect(listEvents).not.toHaveBeenCalled();
  });
});

describe("syncNow — VEGA write-calendar missing (Q3)", () => {
  it("background null write-cal pauses the task lane and flags gcalMissing", async () => {
    vi.mocked(ensureVegaCalendar).mockResolvedValueOnce(null);
    vi.mocked(listEvents).mockClear();
    const r = await syncNow(false);
    const ranTaskLane = vi.mocked(listEvents).mock.calls.some(([, o]) => o.filtered === true);
    expect(ranTaskLane).toBe(false);
    expect(calls.inserted).toHaveLength(0);
    expect(calls.patched).toHaveLength(0);
    expect(calls.deleted).toHaveLength(0);
    expect(useStore.getState().gcalMissing).toBe(true);
    expect(r).toMatchObject({ pushed: 0, pulled: 0 });
  });

  it("clears gcalMissing once the write-calendar resolves again", async () => {
    useStore.setState({ gcalMissing: true });
    await syncNow(false);
    expect(useStore.getState().gcalMissing).toBe(false);
  });
});

describe("syncNow — read-calendar fault isolation", () => {
  const okEvent = {
    id: "g1",
    iCalUID: "u1",
    summary: "Show",
    status: "confirmed",
    start: { dateTime: "2026-07-11T17:00:00Z" },
    end: { dateTime: "2026-07-11T20:00:00Z" },
    updated: "2026-06-20T10:00:00Z",
  };

  it("skips one dead read calendar but still syncs the healthy one", async () => {
    useStore.setState({ gcal: gcal({ readCalendarIds: ["cal_dead", "cal_ok"] }) });
    vi.mocked(listEvents).mockImplementation(async (cal: string, o: { filtered: boolean }) => {
      if (o.filtered) return { events: [], nextSyncToken: "tok", expired: false };
      if (cal === "cal_dead") throw new GcalHttpError(404);
      return { events: [okEvent], nextSyncToken: "tok", expired: false };
    });
    await expect(syncNow(false)).resolves.toBeDefined();
    const events = useStore.getState().calendarEvents;
    expect(events.some((e) => e.googleId === "g1" && e.calendarId === "cal_ok")).toBe(true);
  });

  it("propagates a non-404/410 read error so the UI can surface needs-reconnect", async () => {
    useStore.setState({ gcal: gcal({ readCalendarIds: ["cal_personal"] }) });
    vi.mocked(listEvents).mockImplementation(async (_cal: string, o: { filtered: boolean }) => {
      if (o.filtered) return { events: [], nextSyncToken: "tok", expired: false };
      throw new GcalHttpError(401);
    });
    await expect(syncNow(false)).rejects.toThrow();
  });
});
