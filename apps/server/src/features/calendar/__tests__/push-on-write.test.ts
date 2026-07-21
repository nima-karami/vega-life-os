import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectCalendar, taskInput } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";
import { createReconcileScheduler } from "../schedule-reconcile";
import { readGcalAccount, writeGcalAccount } from "../token-store";

const WRITE_CAL = "cal-write-pow";

describe("debounced push-on-write", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("coalesces a burst of schedules into one reconcile that pushes them all", async () => {
    const uid = "u-pow";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    const scheduler = createReconcileScheduler(server.reconcileDeps, 20);
    const client = server.asUid(uid);
    for (let index = 0; index < 5; index += 1) {
      await client.tasks.upsert.mutate(
        taskInput(`t-burst-${index}`, { date: "2026-07-30", time: `0${index + 1}:00` }),
      );
      scheduler.schedule(uid);
    }
    await scheduler.flush();
    const events = server.google
      .rawEvents(WRITE_CAL)
      .filter((event) => event.status !== "cancelled");
    expect(events).toHaveLength(5);
  });

  it("a task upsert through the router schedules a reconcile (wiring)", async () => {
    const uid = "u-pow-wired";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await server
      .asUid(uid)
      .tasks.upsert.mutate(taskInput("t-wired", { date: "2026-07-31", time: "09:00" }));
    await server.flushReconciles();
    const pushed = server.google
      .rawEvents(WRITE_CAL)
      .some((event) => event.summary && event.status !== "cancelled");
    expect(pushed).toBe(true);
  });

  it("a backing-off account skips Google entirely and the scheduler net later recovers", async () => {
    const uid = "u-pow-backoff";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await writeGcalAccount(server.firestore, uid, {
      backoff: { failures: 1, nextAllowedAt: "2999-01-01T00:00:00.000Z" },
    });
    server.google.failNextList(500);
    const result = await runReconcile(server.reconcileDeps, uid);
    expect(result.pushed + result.pulled + result.lived).toBe(0);

    await writeGcalAccount(server.firestore, uid, { backoff: null });
    await runReconcile(server.reconcileDeps, uid);
    const account = await readGcalAccount(server.firestore, uid);
    expect(account?.backoff?.failures).toBe(1);
    expect(account?.backoff?.nextAllowedAt).toBeTruthy();
  });
});
