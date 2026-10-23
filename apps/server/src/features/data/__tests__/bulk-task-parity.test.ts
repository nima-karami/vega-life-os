import { readSyncReceipt } from "@vega/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { listTombstones } from "../../../core/tombstone";
import { connectCalendar, isoDaysFromToday, taskInput } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { countFirestoreReads } from "../../../test/read-counter";

const WRITE_CAL = "cal-write-bulk-tasks";

/** A day of habit instances, as the web store's runway or reorder sends them. */
const dayOfInstances = (prefix: string, count: number, date = isoDaysFromToday(2)) =>
  Array.from({ length: count }, (_, index) =>
    taskInput(`${prefix}-${index}`, {
      kind: "habit",
      habitId: "h-bulk",
      date,
      slotDate: date,
      time: null,
      status: "todo",
      order: index,
    }),
  );

describe("bulk task writes keep per-row parity (real server vs emulator)", () => {
  let server: TestServer;
  let reads: ReturnType<typeof countFirestoreReads> | undefined;
  let uidSeq = 0;
  const freshUid = () => `u-bulk-tasks-${Date.now()}-${uidSeq++}`;

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });
  afterEach(() => {
    reads?.restore();
    reads = undefined;
  });

  it("a 30-instance reorder costs one counter bump and one read per row", async () => {
    const uid = freshUid();
    const call = server.asUid(uid);
    const rows = dayOfInstances("reorder", 30);
    await call.data.importCollection.mutate({ collection: "tasks", records: rows });
    const before = await call.data.syncVersion.query();
    reads = countFirestoreReads();

    const response = await call.data.importCollection.mutate({
      collection: "tasks",
      records: rows.map((row, index) => ({ ...row, order: 29 - index })),
    });

    expect(reads.tally).toEqual({ dataset: 30, counter: 1, other: 0 });
    expect(await call.data.syncVersion.query()).toBe(before + 1);
    // contiguous with the writer's cursor, so its next poll does not refetch its own write
    expect(readSyncReceipt(response)).toBe(before + 1);
    const orderById = new Map((await call.tasks.list.query()).map((task) => [task.id, task.order]));
    expect(rows.map((row) => orderById.get(row.id))).toEqual(rows.map((_, index) => 29 - index));
  });

  it("the same reorder row by row costs a bump per row", async () => {
    const uid = freshUid();
    const call = server.asUid(uid);
    const rows = dayOfInstances("serial", 30);
    await call.data.importCollection.mutate({ collection: "tasks", records: rows });
    const before = await call.data.syncVersion.query();

    for (const [index, row] of rows.entries())
      await call.tasks.upsert.mutate({ ...row, order: 29 - index });

    expect(await call.data.syncVersion.query()).toBe(before + 30);
  });

  it("a 30-instance removal costs one bump and tombstones every row like a per-row delete", async () => {
    const uid = freshUid();
    const call = server.asUid(uid);
    const rows = dayOfInstances("remove", 31);
    await call.data.importCollection.mutate({ collection: "tasks", records: rows });
    await call.tasks.delete.mutate({ id: "remove-30" });
    const bulkIds = rows.slice(0, 30).map((row) => row.id);
    const before = await call.data.syncVersion.query();
    reads = countFirestoreReads();

    const response = await call.data.bulkRemove.mutate({ collection: "tasks", ids: bulkIds });

    expect(reads.tally).toEqual({ dataset: 30, counter: 1, other: 0 });
    expect(response).toEqual({
      removed: 30,
      missing: 0,
      writtenChunks: 1,
      syncVersion: before + 1,
    });
    expect(await call.tasks.list.query()).toEqual([]);
    const tombstones = (await listTombstones(server.firestore, uid)).filter(
      (tombstone) => tombstone.collection === "tasks",
    );
    expect(tombstones.map((tombstone) => tombstone.id).sort()).toEqual(
      [...bulkIds, "remove-30"].sort(),
    );
    const shapes = new Set(tombstones.map((tombstone) => Object.keys(tombstone).sort().join(",")));
    expect([...shapes]).toEqual(["collection,deletedAt,id"]);
  });

  it("a bulk insert and a bulk removal of tasks each schedule a calendar reconcile", async () => {
    const uid = freshUid();
    await connectCalendar(server, uid, { writeCalendarId: WRITE_CAL });
    const call = server.asUid(uid);
    const timed = ["09:00", "10:00", "11:00"].map((time, index) =>
      taskInput(`timed-${index}`, {
        title: `Timed ${index}`,
        date: isoDaysFromToday(3),
        time,
        status: "todo",
      }),
    );
    const liveSummaries = () =>
      server.google
        .rawEvents(WRITE_CAL)
        .filter((event) => event.status !== "cancelled")
        .map((event) => event.summary)
        .sort();

    await call.data.importCollection.mutate({ collection: "tasks", records: timed });
    await server.flushReconciles();
    expect(liveSummaries()).toEqual(["Timed 0", "Timed 1", "Timed 2"]);

    await call.data.bulkRemove.mutate({
      collection: "tasks",
      ids: timed.map((task) => task.id),
    });
    await server.flushReconciles();
    expect(liveSummaries()).toEqual([]);
  });
});
