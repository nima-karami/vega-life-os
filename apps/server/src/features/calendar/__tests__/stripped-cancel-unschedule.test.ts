import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-stripped";

/**
 * Real Google strips a cancelled event down to {id,status,updated} — no `extendedProperties`. The pull
 * must still recognise a deleted VEGA event by its self-describing id, which the old property match couldn't.
 */
describe("stripped cancelled delta still unschedules via id-equality", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
    server.google.emitStrippedCancels();
  });
  afterAll(async () => {
    await server.close();
  });

  it("unschedules a todo task whose VEGA event was deleted in Google (properties stripped)", async () => {
    const uid = "u-stripped";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-s", { date: "2026-08-15", time: "09:00" });
    await runReconcile(server.reconcileDeps, uid); // push the event
    await runReconcile(server.reconcileDeps, uid); // idle: advance the token past the insert

    const pushed = server.google.rawEvents(WRITE_CAL).find((event) => event.id?.startsWith("vega"));
    if (!pushed?.id) throw new Error("event not pushed");
    await server.google.client.deleteEvent(WRITE_CAL, pushed.id);
    await runReconcile(server.reconcileDeps, uid); // pull the stripped cancellation → unschedule

    const task = await createRepository(server.firestore, uid, "tasks").get("t-s");
    expect(task?.date).toBeNull();
    expect(task?.status).toBe("open");
  });
});
