import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";
import { readGcalAccount } from "../token-store";

// A fresh server per test: the paused reconcile deliberately never lists, so a seeded
// `failNextList` stays queued — a shared GoogleMock would leak it into the next test.
describe("deleted VEGA calendar pauses sync and recreate re-pushes (pause-and-ask)", () => {
  let server: TestServer;
  beforeEach(async () => {
    server = await bootTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it("a 404 on the write calendar sets writeCalendarMissing and pauses both lanes", async () => {
    const uid = "u-missing";
    await connectCalendar(server, uid, { writeCalendarId: "cal-deleted" });
    await upsertTask(server, uid, "t-m", { date: "2026-07-28", time: "09:00" });
    server.google.failNextList(404);
    await runReconcile(server.reconcileDeps, uid);

    const account = await readGcalAccount(server.firestore, uid);
    expect(account?.writeCalendarMissing).toBe(true);

    // Paused: a further reconcile is a no-op — it must not call Google at all.
    server.google.failNextList(500); // would blow up if a list happened
    const result = await runReconcile(server.reconcileDeps, uid);
    expect(result.pushed + result.pulled + result.lived).toBe(0);
  });

  it("recreateWriteCalendar makes a fresh calendar and re-pushes every scheduled task", async () => {
    const uid = "u-recreate";
    await connectCalendar(server, uid, { writeCalendarId: "cal-was-deleted" });
    await upsertTask(server, uid, "t-r", { date: "2026-07-29", time: "10:00" });
    server.google.failNextList(404);
    await runReconcile(server.reconcileDeps, uid);

    const outcome = await server.asUid(uid).calendar.recreateWriteCalendar.mutate();
    expect(outcome.writeCalendarId).not.toBe("cal-was-deleted");

    const account = await readGcalAccount(server.firestore, uid);
    expect(account?.writeCalendarMissing).toBeFalsy();
    const events = server.google
      .rawEvents(outcome.writeCalendarId)
      .filter((event) => event.status !== "cancelled");
    expect(events).toHaveLength(1);
  });
});
