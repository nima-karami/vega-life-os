import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-unpushed-heal";

/** A persisted record survives an unbroken run of push failures and heals once Google recovers. */
describe("persisted-but-unpushed self-heal across repeated failures", () => {
  let server: TestServer;
  const taskRepo = (uid: string) => createRepository(server.firestore, uid, "tasks");
  const confirmed = () =>
    server.google.rawEvents(WRITE_CAL).filter((event) => event.status !== "cancelled");

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("keeps the record across three failed pushes, then pushes it on the fourth reconcile", async () => {
    const uid = "u-heal";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-heal", { date: "2026-07-21", time: "10:00" });
    server.google.failNextPushes(3);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const result = await runReconcile(server.reconcileDeps, uid);
      expect(result.pushFailures).toBeGreaterThanOrEqual(1);
      expect(await taskRepo(uid).get("t-heal")).not.toBeNull();
      expect(confirmed()).toHaveLength(0);
    }

    const healed = await runReconcile(server.reconcileDeps, uid);
    expect(healed.pushFailures).toBe(0);
    expect(confirmed()).toHaveLength(1);
    expect(await taskRepo(uid).get("t-heal")).not.toBeNull();
  });
});
