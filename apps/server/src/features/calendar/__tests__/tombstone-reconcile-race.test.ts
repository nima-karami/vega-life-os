import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { hasTombstone } from "../../../core/tombstone";
import {
  connectCalendar,
  isoDaysFromToday,
  storedTask,
  upsertTask,
} from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { toGEvent } from "../event-map";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-tomb-race";
const SCHEDULED_DATE = isoDaysFromToday(1);

/** A delete racing an in-flight inbound Google edit: the tombstone wins and the task is never resurrected. */
describe("deletion tombstone beats a racing inbound edit", () => {
  let server: TestServer;
  const tasksRepo = (uid: string) => createRepository(server.firestore, uid, "tasks");
  const confirmed = () =>
    server.google.rawEvents(WRITE_CAL).filter((event) => event.status !== "cancelled");

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("does not re-create a deleted task even when a newer inbound edit for it is still in Google", async () => {
    const uid = "u-tomb-race";
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    await upsertTask(server, uid, "t-race", { date: SCHEDULED_DATE, time: "09:00" });
    await runReconcile(server.reconcileDeps, uid);
    expect(confirmed()).toHaveLength(1);

    // An inbound edit (a moved event with a fresh `updated`) races the delete — it is already
    // sitting in Google when the user deletes the task locally.
    const inbound = {
      ...toGEvent(storedTask({ id: "t-race", date: SCHEDULED_DATE, time: "13:00" }), "UTC"),
      updated: new Date(Date.now() + 864e5).toISOString(),
      status: "confirmed",
    };
    server.google.seedEvent(WRITE_CAL, inbound);

    await tasksRepo(uid).remove("t-race");
    expect(await hasTombstone(server.firestore, uid, "tasks", "t-race")).toBe(true);

    await runReconcile(server.reconcileDeps, uid);
    expect(await tasksRepo(uid).list()).toHaveLength(0);
    expect(confirmed()).toHaveLength(0);
    expect(await hasTombstone(server.firestore, uid, "tasks", "t-race")).toBe(true);

    // A second reconcile (a later replay) must not resurrect it either.
    await runReconcile(server.reconcileDeps, uid);
    expect(await tasksRepo(uid).list()).toHaveLength(0);
  });
});
