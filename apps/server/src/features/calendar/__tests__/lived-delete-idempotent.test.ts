import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { hasTombstone } from "../../../core/tombstone";
import { connectCalendar, isoDaysFromToday } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../reconcile";

const WRITE_CAL = "cal-write-delete";
const READ_CAL = "cal-read-delete";

async function seedMirroredEvent(server: TestServer, uid: string, googleId: string) {
  await connectCalendar(server, uid, {
    writeCalendarId: WRITE_CAL,
    readCalendarIds: [READ_CAL],
  });
  server.google.seedEvent(READ_CAL, {
    id: googleId,
    iCalUID: `${googleId}@google.com`,
    summary: "Robin's weekend away",
    start: { date: isoDaysFromToday(3) },
    end: { date: isoDaysFromToday(4) },
  });
  await runReconcile(server.reconcileDeps, uid);
  const repo = createRepository(server.firestore, uid, "calendarEvents");
  const row = (await repo.list()).find((event) => event.googleId === googleId);
  if (!row) throw new Error("mirror row missing");
  await repo.upsert({ ...row, pendingDelete: true });
  return repo;
}

describe("a user delete of a lived event is idempotent", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("completes the delete when Google says the event is already gone", async () => {
    const uid = "u-delete-gone";
    const repo = await seedMirroredEvent(server, uid, "g-already-gone");

    server.google.failNextDelete(410);
    await runReconcile(server.reconcileDeps, uid);

    expect((await repo.list()).some((row) => row.googleId === "g-already-gone")).toBe(false);
    expect(await hasTombstone(server.firestore, uid, "calendarEvents", "g-already-gone")).toBe(
      true,
    );

    // Google's copy is untouched by a refused delete, so a full resync still lists it.
    server.google.expireSyncTokens(READ_CAL);
    await runReconcile(server.reconcileDeps, uid);

    expect((await repo.list()).some((row) => row.googleId === "g-already-gone")).toBe(false);
  });

  it("keeps the row pending when Google refuses the delete, so the retry survives", async () => {
    const uid = "u-delete-refused";
    const repo = await seedMirroredEvent(server, uid, "g-refused");

    server.google.failNextDelete(403);
    await runReconcile(server.reconcileDeps, uid);

    const kept = (await repo.list()).find((row) => row.googleId === "g-refused");
    expect(kept?.pendingDelete).toBe(true);
  });
});
