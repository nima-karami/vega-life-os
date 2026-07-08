import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/features/tasks";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
  saveBulk: vi.fn(),
}));

type RecordedBatch = { cal: string; ops: { kind: string; id: string; body?: unknown }[] };
const calls = { batches: [] as RecordedBatch[] };
const okEvent = {
  id: "g1",
  iCalUID: "u1",
  summary: "Show",
  status: "confirmed",
  start: { dateTime: "2026-07-11T17:00:00Z" },
  end: { dateTime: "2026-07-11T20:00:00Z" },
  updated: "2026-06-20T10:00:00Z",
};
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
      : { events: [okEvent], nextSyncToken: "tok", expired: false },
  ),
  batchWrite: vi.fn(async (cal: string, ops: { kind: string; id: string }[]) => {
    calls.batches.push({ cal, ops });
    return ops.map((o) => ({ id: o.id, status: 200, class: "ok" as const }));
  }),
}));
vi.mock("../calendars", () => ({ ensureVegaCalendar: vi.fn(async () => "cal_vega") }));
vi.mock("../state", () => ({
  getSyncToken: () => null,
  setSyncToken: vi.fn(),
  getWindow: () => ({ backDays: 28, fwdDays: 56 }),
  setLastSyncedAt: vi.fn(),
  ensureSpanBackfill: vi.fn(),
  getNextAllowedSyncAt: () => 0,
  recordSyncFailure: vi.fn(),
  clearSyncBackoff: vi.fn(),
  setScopeVersion: vi.fn(),
}));

import { useStore } from "@/core/store";
import { ensureVegaCalendar } from "../calendars";
import { defaultGcalConfig } from "../config";
import type { CalendarEvent } from "../events-model";
import { batchWrite, GcalHttpError, listEvents } from "../gcal";
import { toGEvent } from "../map";
import { syncNow } from "../sync";

const defaultListImpl = async (_cal: string, o: { filtered: boolean }) =>
  o.filtered
    ? { events: [], nextSyncToken: "tok", expired: false }
    : { events: [okEvent], nextSyncToken: "tok", expired: false };

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
  endDate: "2026-07-04",
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

const today = new Date().toISOString().slice(0, 10);
const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Task",
  kind: "oneoff",
  habitId: null,
  goalId: null,
  valueId: null,
  date: today,
  slotDate: null,
  time: "09:00",
  durationMin: 30,
  status: "todo",
  detached: false,
  note: "",
  order: 0,
  ...over,
});

beforeEach(() => {
  calls.batches = [];
  useStore.setState({
    tasks: [],
    calendarEvents: [],
    gcal: gcal(),
    gcalMissing: false,
    gcalNeedsReconnect: false,
    gcalBackingOff: false,
  });
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

  it("batches a pending edit + delete back to Google and prunes the deleted row", async () => {
    useStore.setState({
      calendarEvents: [
        ce({ id: "ce_e", googleId: "ge", iCalUID: "ue", vegaEditedAt: "2026-06-27T00:00:00Z" }),
        ce({ id: "ce_d", googleId: "gd", iCalUID: "ud", pendingDelete: true }),
      ],
    });
    await syncNow(false);
    const lived = calls.batches.find((b) => b.cal === "cal_personal");
    expect(lived?.ops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "delete", id: "gd" }),
        expect.objectContaining({ kind: "patch", id: "ge" }),
      ]),
    );
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

describe("syncNow — task lane batching", () => {
  it("pushes a scheduled task as a single batch insert", async () => {
    useStore.setState({ tasks: [task()] });
    await syncNow(false);
    const taskBatch = calls.batches.find((b) => b.cal === "cal_vega");
    expect(taskBatch?.ops).toHaveLength(1);
    expect(taskBatch?.ops[0]).toMatchObject({ kind: "insert" });
  });

  it("does NOT evict the event of a scheduled task that has aged out of the push window", async () => {
    // Regression for the evict→pull-unschedule loop: an old-but-scheduled task keeps its event.
    const old = task({ id: "t_old", date: "2020-01-01" });
    useStore.setState({ tasks: [old] });
    const ev = { ...toGEvent(old), status: "confirmed" };
    vi.mocked(listEvents).mockImplementation(async (_cal, o) =>
      o.filtered
        ? { events: [ev], nextSyncToken: "tok", expired: false }
        : { events: [okEvent], nextSyncToken: "tok", expired: false },
    );
    await syncNow(false);
    const vegaBatch = calls.batches.find((b) => b.cal === "cal_vega");
    const deletes = (vegaBatch?.ops ?? []).filter((o) => o.kind === "delete");
    expect(deletes).toHaveLength(0);
    expect(useStore.getState().tasks[0].date).toBe("2020-01-01"); // still scheduled, not unscheduled
    vi.mocked(listEvents).mockImplementation(defaultListImpl);
  });

  it("converges a 409 insert into a status:confirmed patch (tombstone)", async () => {
    useStore.setState({ tasks: [task()] });
    vi.mocked(batchWrite).mockImplementationOnce(async (cal, ops) => {
      calls.batches.push({ cal, ops });
      return ops.map((o) => ({ id: o.id, status: 409, class: "needs-patch" as const }));
    });
    await syncNow(false);
    const taskBatches = calls.batches.filter((b) => b.cal === "cal_vega");
    expect(taskBatches).toHaveLength(2); // initial insert, then the resurrect patch
    expect(taskBatches[1].ops[0]).toMatchObject({
      kind: "patch",
      body: expect.objectContaining({ status: "confirmed" }),
    });
  });

  it("flags needs-reconnect when a batch sub-op returns auth", async () => {
    useStore.setState({ tasks: [task()] });
    vi.mocked(batchWrite).mockImplementationOnce(async (cal, ops) => {
      calls.batches.push({ cal, ops });
      return ops.map((o) => ({ id: o.id, status: 401, class: "auth" as const }));
    });
    await expect(syncNow(false)).resolves.toEqual({ pushed: 0, pulled: 0, lived: 0 });
    expect(useStore.getState().gcalNeedsReconnect).toBe(true);
  });

  it("flags backing-off when a batch sub-op returns transient", async () => {
    useStore.setState({ tasks: [task()] });
    vi.mocked(batchWrite).mockImplementationOnce(async (cal, ops) => {
      calls.batches.push({ cal, ops });
      return ops.map((o) => ({ id: o.id, status: 500, class: "transient" as const }));
    });
    await syncNow(false);
    expect(useStore.getState().gcalBackingOff).toBe(true);
  });
});

describe("syncNow — VEGA write-calendar missing (Q3)", () => {
  it("background null write-cal pauses the task lane and flags gcalMissing", async () => {
    vi.mocked(ensureVegaCalendar).mockResolvedValueOnce(null);
    vi.mocked(listEvents).mockClear();
    const r = await syncNow(false);
    const ranTaskLane = vi.mocked(listEvents).mock.calls.some(([, o]) => o.filtered === true);
    expect(ranTaskLane).toBe(false);
    expect(calls.batches.some((b) => b.cal === "cal_vega")).toBe(false);
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

  it("flags needs-reconnect on a 401 background read without throwing", async () => {
    useStore.setState({ gcal: gcal({ readCalendarIds: ["cal_personal"] }) });
    vi.mocked(listEvents).mockImplementation(async (_cal: string, o: { filtered: boolean }) => {
      if (o.filtered) return { events: [], nextSyncToken: "tok", expired: false };
      throw new GcalHttpError(401);
    });
    await expect(syncNow(false)).resolves.toEqual({ pushed: 0, pulled: 0, lived: 0 });
    expect(useStore.getState().gcalNeedsReconnect).toBe(true);
  });

  it("rethrows for an interactive run so the control can toast", async () => {
    useStore.setState({ gcal: gcal({ readCalendarIds: ["cal_personal"] }) });
    vi.mocked(listEvents).mockImplementation(async (_cal: string, o: { filtered: boolean }) => {
      if (o.filtered) return { events: [], nextSyncToken: "tok", expired: false };
      throw new GcalHttpError(500);
    });
    await expect(syncNow(true)).rejects.toThrow();
    expect(useStore.getState().gcalBackingOff).toBe(true);
  });
});
