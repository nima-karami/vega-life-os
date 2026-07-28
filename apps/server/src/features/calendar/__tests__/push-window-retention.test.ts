import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RETENTION_DAYS } from "../../../core/tombstone";
import {
  connectCalendar,
  isoDaysFromToday,
  storedTask,
  upsertTask,
} from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { type GEvent, getGoogleEventId, toGEvent } from "../event-map";
import { runReconcile } from "../reconcile";
import { computeTaskBatch, makeWindowGuard } from "../sync-engine";

const inWindow = makeWindowGuard(isoDaysFromToday(0));
const confirmed = (event: GEvent): GEvent => ({ ...event, status: "confirmed" });

/**
 * The push window's back edge is the tombstone retention period: inside it we still hold an exact
 * record of what the user deleted, so creating an event is safe; past it a missing event is
 * indistinguishable from a deletion we would resurrect on every sync.
 */
describe("push window back edge derives from tombstone retention", () => {
  it("inserts the event of a task scheduled inside retention but past the old 7-day edge", () => {
    const task = storedTask({ id: "t-recent-past", date: isoDaysFromToday(-8), time: "09:00" });
    expect(computeTaskBatch([task], [], inWindow, "UTC")).toEqual([
      { kind: "insert", id: getGoogleEventId(task), body: toGEvent(task, "UTC") },
    ]);
  });

  it("refuses to insert a task one day older than retention", () => {
    const task = storedTask({
      id: "t-past-retention",
      date: isoDaysFromToday(-RETENTION_DAYS - 1),
      time: "09:00",
    });
    expect(computeTaskBatch([task], [], inWindow, "UTC")).toEqual([]);
  });

  it("tracks RETENTION_DAYS rather than a literal, so the two can never drift apart", () => {
    expect(inWindow({ date: isoDaysFromToday(-RETENTION_DAYS) })).toBe(true);
    expect(inWindow({ date: isoDaysFromToday(-RETENTION_DAYS - 1) })).toBe(false);
  });

  it("still reaches 90 days forward", () => {
    expect(inWindow({ date: isoDaysFromToday(90) })).toBe(true);
    expect(inWindow({ date: isoDaysFromToday(91) })).toBe(false);
  });

  it("patches an existing event whose task sits outside the window — updates are never gated", () => {
    const task = storedTask({
      id: "t-drifted",
      date: isoDaysFromToday(-RETENTION_DAYS - 10),
      time: "09:00",
    });
    const drifted = [confirmed(toGEvent({ ...task, time: "17:00" }, "UTC"))];
    expect(computeTaskBatch([task], drifted, inWindow, "UTC")).toEqual([
      { kind: "patch", id: getGoogleEventId(task), body: toGEvent(task, "UTC") },
    ]);
  });

  it("keeps the event of an out-of-window task that is still scheduled (commit f550ae2)", () => {
    const task = storedTask({
      id: "t-aged",
      date: isoDaysFromToday(-RETENTION_DAYS - 10),
      time: "09:00",
    });
    const ops = computeTaskBatch([task], [confirmed(toGEvent(task, "UTC"))], inWindow, "UTC");
    expect(ops).toEqual([]);
  });
});

describe("push window back edge end to end", () => {
  let server: TestServer;
  const live = (calendarId: string) =>
    server.google.rawEvents(calendarId).filter((event) => event.status !== "cancelled");

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("pushes a task scheduled two weeks back, which the 7-day edge silently dropped", async () => {
    const writeCalendarId = "cal-write-in-retention";
    const uid = "u-push-in-retention";
    await connectCalendar(server, uid, { writeCalendarId });
    await upsertTask(server, uid, "t-two-weeks-back", {
      date: isoDaysFromToday(-14),
      time: "09:00",
    });
    await runReconcile(server.reconcileDeps, uid);
    expect(live(writeCalendarId)).toHaveLength(1);
  });

  it("leaves a task older than retention unpushed", async () => {
    const writeCalendarId = "cal-write-past-retention";
    const uid = "u-push-past-retention";
    await connectCalendar(server, uid, { writeCalendarId });
    await upsertTask(server, uid, "t-ancient", {
      date: isoDaysFromToday(-RETENTION_DAYS - 30),
      time: "09:00",
    });
    await runReconcile(server.reconcileDeps, uid);
    expect(live(writeCalendarId)).toHaveLength(0);
  });
});
