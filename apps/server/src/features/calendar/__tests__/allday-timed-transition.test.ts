import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const DATE = "2026-07-25";

const liveEvent = (server: TestServer, calendarId: string) =>
  server.google.rawEvents(calendarId).find((event) => event.status !== "cancelled");

describe("all-day ⇄ timed transitions survive Google's patch merge", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("all-day → timed: the merged event keeps only dateTime, never a stale date", async () => {
    const uid = "u-allday-to-timed";
    const writeCalendarId = "cal-allday-to-timed";
    await connectCalendar(server, uid, { writeCalendarId });
    await upsertTask(server, uid, "t-a", { date: DATE, time: null });
    await runReconcile(server.reconcileDeps, uid);
    expect(liveEvent(server, writeCalendarId)?.start?.date).toBe(DATE);

    await upsertTask(server, uid, "t-a", { date: DATE, time: "09:00" });
    const result = await runReconcile(server.reconcileDeps, uid);

    const event = liveEvent(server, writeCalendarId);
    expect(event?.start?.dateTime).toBeTruthy();
    expect(event?.start?.date).toBeFalsy();
    expect(result.pushFailures).toBe(0);
  });

  it("timed → all-day: the merged event keeps only date, never a stale dateTime", async () => {
    const uid = "u-timed-to-allday";
    const writeCalendarId = "cal-timed-to-allday";
    await connectCalendar(server, uid, { writeCalendarId });
    await upsertTask(server, uid, "t-b", { date: DATE, time: "09:00" });
    await runReconcile(server.reconcileDeps, uid);
    expect(liveEvent(server, writeCalendarId)?.start?.dateTime).toBeTruthy();

    await upsertTask(server, uid, "t-b", { date: DATE, time: null });
    const result = await runReconcile(server.reconcileDeps, uid);

    const event = liveEvent(server, writeCalendarId);
    expect(event?.start?.date).toBe(DATE);
    expect(event?.start?.dateTime).toBeFalsy();
    expect(result.pushFailures).toBe(0);
  });
});
