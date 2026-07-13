import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-unpushed";

describe("Firestore-confirmed but Google-push-failed self-heal", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("keeps the record persisted when the Google push fails, then heals on the next reconcile", async () => {
    const uid = "u-unpushed";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-unpushed", { date: "2026-07-21", time: "10:00" });

    server.google.failNextPushes(1);
    const first = await runReconcile(server.reconcileDeps, uid);
    expect(first.pushFailures).toBeGreaterThanOrEqual(1);
    expect(await createRepository(server.firestore, uid, "tasks").get("t-unpushed")).not.toBeNull();
    expect(server.google.rawEvents(WRITE_CAL).filter((e) => e.status !== "cancelled")).toHaveLength(
      0,
    );

    const second = await runReconcile(server.reconcileDeps, uid);
    expect(second.pushFailures).toBe(0);
    expect(server.google.rawEvents(WRITE_CAL).filter((e) => e.status !== "cancelled")).toHaveLength(
      1,
    );
  });
});
