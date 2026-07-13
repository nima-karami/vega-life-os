import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { hasTombstone, sweepTombstones, writeTombstone } from "../../../core/tombstone";
import { connectCalendar, upsertTask } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-tomb";

describe("deletion tombstones + reconcile-race (real server vs emulator + mocked Google)", () => {
  let server: TestServer;
  const tasksRepo = (uid: string) => createRepository(server.firestore, uid, "tasks");

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("removes the Google counterpart on delete and never re-creates the task", async () => {
    const uid = "u-tomb";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-tomb", { date: "2026-07-20", time: "09:00" });

    await runReconcile(server.reconcileDeps, uid);
    const confirmed = server.google
      .rawEvents(WRITE_CAL)
      .filter((event) => event.status !== "cancelled");
    expect(confirmed).toHaveLength(1);

    await tasksRepo(uid).remove("t-tomb");
    expect(await hasTombstone(server.firestore, uid, "tasks", "t-tomb")).toBe(true);

    await runReconcile(server.reconcileDeps, uid);
    const live = server.google.rawEvents(WRITE_CAL).filter((event) => event.status !== "cancelled");
    expect(live).toHaveLength(0);

    // A racing extra reconcile must not resurrect the deleted task.
    await runReconcile(server.reconcileDeps, uid);
    expect(await tasksRepo(uid).list()).toHaveLength(0);
  });

  it("sweeps a tombstone past the 30-day retention window", async () => {
    const uid = "u-sweep";
    const old = new Date(Date.now() - 40 * 864e5).toISOString();
    await writeTombstone(server.firestore, uid, "tasks", "t-old", old);
    await writeTombstone(server.firestore, uid, "tasks", "t-fresh", server.now());

    const swept = await sweepTombstones(server.firestore, uid, Date.now());
    expect(swept).toBe(1);
    expect(await hasTombstone(server.firestore, uid, "tasks", "t-old")).toBe(false);
    expect(await hasTombstone(server.firestore, uid, "tasks", "t-fresh")).toBe(true);
  });
});
