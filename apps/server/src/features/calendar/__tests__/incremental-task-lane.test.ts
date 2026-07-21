import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";
import { readGcalAccount } from "../token-store";

const WRITE_CAL = "cal-write-incr";

describe("incremental task lane over the write-calendar mirror", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("stores a sync token after the first reconcile and reuses it", async () => {
    const uid = "u-incr-token";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-a", { date: "2026-07-25", time: "09:00" });
    await runReconcile(server.reconcileDeps, uid);
    const account = await readGcalAccount(server.firestore, uid);
    expect(account?.syncTokens?.[WRITE_CAL]).toBeTruthy();
  });

  it("deletes the Google event of a task unscheduled in VEGA even when no delta mentions it", async () => {
    const uid = "u-incr-orphan";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-orphan", { date: "2026-07-26", time: "10:00" });
    await runReconcile(server.reconcileDeps, uid); // full list, event pushed, mirror seeded
    await runReconcile(server.reconcileDeps, uid); // incremental idle pass

    await upsertTask(server, uid, "t-orphan", { date: null, time: null }); // VEGA-side unschedule
    await runReconcile(server.reconcileDeps, uid); // delta contains nothing about the event

    const remaining = server.google
      .rawEvents(WRITE_CAL)
      .filter((event) => event.status !== "cancelled");
    expect(remaining).toHaveLength(0);
  });

  it("recovers from an expired sync token without fabricating deletions", async () => {
    const uid = "u-incr-410";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-keep", { date: "2026-07-27", time: "11:00" });
    await runReconcile(server.reconcileDeps, uid);
    server.google.expireSyncTokens(WRITE_CAL);
    await runReconcile(server.reconcileDeps, uid); // 410 → full-list fallback

    const task = await createRepository(server.firestore, uid, "tasks").get("t-keep");
    expect(task?.date).toBe("2026-07-27"); // still scheduled
    const live = server.google.rawEvents(WRITE_CAL).filter((event) => event.status !== "cancelled");
    expect(live).toHaveLength(1); // event kept, not delete+reinserted
  });
});
