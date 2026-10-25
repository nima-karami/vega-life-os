import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, storedTask, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { toGEvent } from "../event-map";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-aged-race";

/**
 * Invariant (commit 2c3cd67) hardened under a reconcile race: an event whose task is still
 * scheduled but has aged past the push window is kept — the window gates inserts only, the
 * desired set is ALL scheduled tasks — even when reconciles overlap.
 */
describe("aged-out event of a live task is never evicted, even under concurrent reconciles", () => {
  let server: TestServer;
  const taskRepo = (uid: string) => createRepository(server.firestore, uid, "tasks");
  const owned = () =>
    server.google
      .rawEvents(WRITE_CAL)
      .filter(
        (event) => event.status !== "cancelled" && event.extendedProperties?.private?.vegaTaskId,
      );

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("keeps the aged event and the task's schedule across racing reconciles", async () => {
    const uid = "u-aged-race";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    // The task is still scheduled, but its date has aged far past the push window.
    await upsertTask(server, uid, "t-aged", { date: "2020-01-01", time: "09:00" });
    server.google.seedEvent(WRITE_CAL, {
      ...toGEvent(storedTask({ id: "t-aged", date: "2020-01-01", time: "09:00" }), "UTC"),
      status: "confirmed",
      updated: "2020-01-01T09:00:00.000Z",
    });

    const settled = await Promise.allSettled([
      runReconcile(server.reconcileDeps, uid),
      runReconcile(server.reconcileDeps, uid),
    ]);
    expect(settled.some((r) => r.status === "fulfilled")).toBe(true);

    await runReconcile(server.reconcileDeps, uid);
    expect(owned()).toHaveLength(1);
    const task = await taskRepo(uid).get("t-aged");
    expect(task?.date).toBe("2020-01-01");
    expect(task?.time).toBe("09:00");
  }, 30_000);
});
