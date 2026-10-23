import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initAdmin } from "../../../core/firebase-admin";
import { createRepository } from "../../../core/repository";
import { listTombstones } from "../../../core/tombstone";
import { connectCalendar, isoDaysFromToday } from "../../../test/calendar-fixtures";
import { mindCards as cards } from "../../../test/data-fixtures";
import { resolveEmulatorConfig } from "../../../test/emulator";
import { withFailingCommit } from "../../../test/failing-commit";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { runReconcile } from "../../calendar/reconcile";

const idsOf = (records: { id: string }[]) => records.map((record) => record.id);

describe("batched data.bulkRemove (real server vs emulator)", () => {
  let server: TestServer;
  let failing: TestServer;
  let armFailure: (failAt: number) => void;

  const seedCards = async (uid: string, records: { id: string }[], target: () => TestServer) => {
    await target().asUid(uid).data.importCollection.mutate({
      collection: "mindCards",
      records,
    });
  };

  const tombstonedIds = async (uid: string, collection: string) =>
    (await listTombstones(server.firestore, uid))
      .filter((tombstone) => tombstone.collection === collection)
      .map((tombstone) => tombstone.id);

  beforeAll(async () => {
    server = await bootTestServer();
    const wrapped = withFailingCommit(initAdmin(resolveEmulatorConfig()).firestore);
    armFailure = wrapped.armFailure;
    failing = await bootTestServer({ firestore: wrapped.firestore });
  });
  afterAll(async () => {
    await failing.close();
    await server.close();
  });

  it("removes a payload larger than one batch, chunked so delete and tombstone commit together", async () => {
    const uid = "remove-chunking";
    const records = cards(451, "chunk");
    await seedCards(uid, records, () => server);

    const result = await server.asUid(uid).data.bulkRemove.mutate({
      collection: "mindCards",
      ids: idsOf(records),
    });

    // 451 rows at two writes each is three ≤450-write batches.
    expect(result).toEqual({
      removed: 451,
      missing: 0,
      writtenChunks: 3,
      syncVersion: expect.any(Number),
    });
    expect(await server.asUid(uid).data.list.query({ collection: "mindCards" })).toEqual([]);
  });

  it("bumps the sync counter exactly once for a multi-chunk removal", async () => {
    const uid = "remove-counter";
    const records = cards(451, "counter");
    await seedCards(uid, records, () => server);
    const before = await server.asUid(uid).data.syncVersion.query();

    await server.asUid(uid).data.bulkRemove.mutate({
      collection: "mindCards",
      ids: idsOf(records),
    });

    expect((await server.asUid(uid).data.syncVersion.query()) - before).toBe(1);
  });

  it("writes a tombstone for every removed id", async () => {
    const uid = "remove-tombstones";
    const records = cards(3, "stone");
    await seedCards(uid, records, () => server);

    await server.asUid(uid).data.bulkRemove.mutate({
      collection: "mindCards",
      ids: idsOf(records),
    });

    expect((await tombstonedIds(uid, "mindCards")).sort()).toEqual(idsOf(records).sort());
  });

  it("re-running a removal writes nothing and leaves the counter still", async () => {
    const uid = "remove-idempotent";
    const records = cards(20, "again");
    await seedCards(uid, records, () => server);
    await server.asUid(uid).data.bulkRemove.mutate({
      collection: "mindCards",
      ids: idsOf(records),
    });
    const afterFirst = await server.asUid(uid).data.syncVersion.query();

    const replay = await server.asUid(uid).data.bulkRemove.mutate({
      collection: "mindCards",
      ids: idsOf(records),
    });

    expect(replay).toEqual({ removed: 0, missing: 20, writtenChunks: 0, syncVersion: null });
    expect(await server.asUid(uid).data.syncVersion.query()).toBe(afterFirst);
  });

  it("reports ids that were never there as missing and still removes the rest", async () => {
    const uid = "remove-missing";
    const records = cards(2, "present");
    await seedCards(uid, records, () => server);

    const result = await server.asUid(uid).data.bulkRemove.mutate({
      collection: "mindCards",
      ids: [...idsOf(records), "ghost_1", "ghost_2"],
    });

    expect(result).toEqual({
      removed: 2,
      missing: 2,
      writtenChunks: 1,
      syncVersion: expect.any(Number),
    });
    expect(await tombstonedIds(uid, "mindCards")).not.toContain("ghost_1");
  });

  it("removes nothing and moves no counter for an empty id list", async () => {
    const uid = "remove-empty";
    const before = await server.asUid(uid).data.syncVersion.query();

    const result = await server.asUid(uid).data.bulkRemove.mutate({
      collection: "mindCards",
      ids: [],
    });

    expect(result).toEqual({ removed: 0, missing: 0, writtenChunks: 0, syncVersion: null });
    expect(await server.asUid(uid).data.syncVersion.query()).toBe(before);
  });

  it("still bumps the counter once when a later chunk fails, and reports the written chunks", async () => {
    const uid = "remove-partial-commit";
    const records = cards(451, "partial");
    await seedCards(uid, records, () => failing);
    const before = await failing.asUid(uid).data.syncVersion.query();
    armFailure(2);

    await expect(
      failing.asUid(uid).data.bulkRemove.mutate({
        collection: "mindCards",
        ids: idsOf(records),
      }),
    ).rejects.toMatchObject({
      data: { partialCommit: { writtenRows: 225, writtenChunks: 1, failedChunk: 1 } },
    });

    armFailure(Number.POSITIVE_INFINITY);
    expect((await failing.asUid(uid).data.syncVersion.query()) - before).toBe(1);
    expect((await failing.asUid(uid).data.list.query({ collection: "mindCards" })).length).toBe(
      226,
    );
  });

  it("retrying after a partial commit removes only what is left", async () => {
    const uid = "remove-partial-commit";
    const records = cards(451, "partial");

    const retry = await failing.asUid(uid).data.bulkRemove.mutate({
      collection: "mindCards",
      ids: idsOf(records),
    });

    expect(retry).toEqual({
      removed: 226,
      missing: 225,
      writtenChunks: 2,
      syncVersion: expect.any(Number),
    });
    expect(await failing.asUid(uid).data.list.query({ collection: "mindCards" })).toEqual([]);
  });

  it("tombstones a mirror event's googleId so a later reconcile cannot resurrect it", async () => {
    const uid = "remove-mirror-reconcile";
    const extCal = "cal-ext-remove";
    const eventDate = isoDaysFromToday(2);
    await connectCalendar(server, uid, {
      writeCalendarId: "cal-write-remove",
      readCalendarIds: [extCal],
    });
    server.google.seedEvent(extCal, {
      id: "g-remove-1",
      iCalUID: "ical-remove-1",
      summary: "External",
      start: { dateTime: `${eventDate}T09:00:00+00:00` },
      end: { dateTime: `${eventDate}T09:30:00+00:00` },
      updated: "2026-08-04T08:00:00.000Z",
      status: "confirmed",
    });
    const mirror = createRepository(server.firestore, uid, "calendarEvents");
    await runReconcile(server.reconcileDeps, uid);
    const mirrored = await mirror.list();
    expect(mirrored.map((event) => event.googleId)).toContain("g-remove-1");

    await server.asUid(uid).data.bulkRemove.mutate({
      collection: "calendarEvents",
      ids: idsOf(mirrored),
    });
    expect(await tombstonedIds(uid, "calendarEvents")).toContain("g-remove-1");

    await runReconcile(server.reconcileDeps, uid);
    expect((await mirror.list()).map((event) => event.googleId)).not.toContain("g-remove-1");
  });

  it("rejects an unauthenticated removal with UNAUTHORIZED", async () => {
    await expect(
      server.call.data.bulkRemove.mutate({ collection: "mindCards", ids: ["anon_1"] }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
  });
});
