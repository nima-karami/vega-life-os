import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-resolved-del";

const liveVegaEvents = (server: TestServer) =>
  server.google
    .rawEvents(WRITE_CAL)
    .filter((e) => e.id?.startsWith("vega") && e.status !== "cancelled");

/** L3: a completed task stays scheduled (its day keeps counting), so deleting its Google block is a
 * soft delete — tombstoned so the push won't resurrect it, while the completion is left untouched. */
describe("deleting a completed task's block in Google stays deleted", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("does not resurrect a done task's event, and keeps the completion intact", async () => {
    const uid = "u-resolved-del";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-done", { date: "2026-08-20", time: "10:00", status: "done" });
    await runReconcile(server.reconcileDeps, uid); // push the event
    await runReconcile(server.reconcileDeps, uid); // idle: advance the token past the insert

    const pushed = liveVegaEvents(server)[0];
    if (!pushed?.id) throw new Error("done task's event was not pushed");

    await server.google.client.deleteEvent(WRITE_CAL, pushed.id); // user deletes the block in Google
    await runReconcile(server.reconcileDeps, uid); // pull tombstones it; push must not resurrect
    await runReconcile(server.reconcileDeps, uid); // another cycle to be sure

    expect(liveVegaEvents(server)).toHaveLength(0);
    const task = await createRepository(server.firestore, uid, "tasks").get("t-done");
    expect(task?.status).toBe("done");
    expect(task?.date).toBe("2026-08-20");
  });

  it("resurrects the block once the task is re-scheduled (deletion outdated by LWW)", async () => {
    const uid = "u-resolved-resched";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-r", { date: "2026-08-20", time: "10:00", status: "done" });
    await runReconcile(server.reconcileDeps, uid);
    await runReconcile(server.reconcileDeps, uid);

    const pushed = liveVegaEvents(server)[0];
    if (!pushed?.id) throw new Error("event was not pushed");
    await server.google.client.deleteEvent(WRITE_CAL, pushed.id);
    await runReconcile(server.reconcileDeps, uid); // tombstone, stays deleted
    expect(liveVegaEvents(server)).toHaveLength(0);

    await upsertTask(server, uid, "t-r", { date: "2026-08-21", time: "10:00", status: "todo" });
    await runReconcile(server.reconcileDeps, uid); // schedule newer than the tombstone → re-create

    expect(liveVegaEvents(server)).toHaveLength(1);
  });
});
