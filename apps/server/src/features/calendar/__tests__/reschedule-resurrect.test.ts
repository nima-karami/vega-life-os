import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-resurrect";

describe("reschedule over a cancelled stable id", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("resurrects the 409-conflicting event instead of wedging the reconcile", async () => {
    const uid = "u-resurrect";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-r", { date: "2026-08-10", time: "09:00" });
    await runReconcile(server.reconcileDeps, uid); // full push
    await runReconcile(server.reconcileDeps, uid); // idle: advance token past the insert

    await upsertTask(server, uid, "t-r", { date: null, time: null });
    await runReconcile(server.reconcileDeps, uid); // delete → event cancelled on Google
    await runReconcile(server.reconcileDeps, uid); // idle: advance token past the cancellation

    await upsertTask(server, uid, "t-r", { date: "2026-08-10", time: "09:00" });
    const result = await runReconcile(server.reconcileDeps, uid); // re-insert same id → 409 → resurrect

    const live = server.google.rawEvents(WRITE_CAL).filter((event) => event.status !== "cancelled");
    expect(live).toHaveLength(1);
    expect(result.pushFailures).toBe(0);
    const task = await createRepository(server.firestore, uid, "tasks").get("t-r");
    expect(task?.date).toBe("2026-08-10");
  });
});
