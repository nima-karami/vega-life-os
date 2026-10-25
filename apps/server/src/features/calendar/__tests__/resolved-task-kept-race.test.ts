import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, isoDaysFromToday, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { getGoogleEventId } from "../event-map";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-resolved-race";
const SCHEDULED_DATE = isoDaysFromToday(1);

/**
 * Invariant (commit 145b8e2) hardened under a reconcile race: a task the user already resolved
 * (done/skip) is not unscheduled when Google cancels its event, even when reconciles overlap.
 */
describe("resolved task is not unscheduled on a cancelled event under a reconcile race", () => {
  let server: TestServer;
  const taskRepo = (uid: string) => createRepository(server.firestore, uid, "tasks");

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("keeps a done task's schedule after its Google event is cancelled and reconciles race", async () => {
    const uid = "u-resolved-race";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    const stored = await upsertTask(server, uid, "t-done", {
      date: SCHEDULED_DATE,
      time: "09:00",
      status: "done",
    });
    await runReconcile(server.reconcileDeps, uid);

    // Google cancels the event out from under the resolved task.
    const eventId = getGoogleEventId(stored);
    await (await server.reconcileDeps.getClient(uid)).deleteEvent(WRITE_CAL, eventId);
    expect(server.google.eventById(WRITE_CAL, eventId)?.status).toBe("cancelled");

    const settled = await Promise.allSettled([
      runReconcile(server.reconcileDeps, uid),
      runReconcile(server.reconcileDeps, uid),
    ]);
    expect(settled.some((r) => r.status === "fulfilled")).toBe(true);
    await runReconcile(server.reconcileDeps, uid);

    const task = await taskRepo(uid).get("t-done");
    expect(task?.status).toBe("done");
    expect(task?.date).toBe(SCHEDULED_DATE);
    expect(task?.time).toBe("09:00");
  }, 30_000);
});
