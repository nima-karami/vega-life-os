import { createSyncCursor } from "@vega/shared";
import { Query, type QuerySnapshot } from "firebase-admin/firestore";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { taskInput } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";

/** Runs `write` once, right after the snapshot's read of `path` returns and before the request does. */
function writeAfterListing(path: string, write: () => Promise<unknown>) {
  const queryGet = Query.prototype.get;
  let hasWritten = false;
  vi.spyOn(Query.prototype, "get").mockImplementation(async function (this: Query) {
    const snapshot: QuerySnapshot = await queryGet.call(this);
    if (!hasWritten && (this as unknown as { path?: string }).path === path) {
      hasWritten = true;
      await write();
    }
    return snapshot;
  });
}

describe("data.loadSnapshot (real server vs emulator)", () => {
  let server: TestServer;
  let uidSeq = 0;
  const freshUid = () => `u-snapshot-${Date.now()}-${uidSeq++}`;

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns the loadAll dataset with the current counter version", async () => {
    const call = server.asUid(freshUid());
    await call.tasks.upsert.mutate(taskInput("t-seed", { title: "Seed" }));

    const snapshot = await call.data.loadSnapshot.query();

    expect(snapshot.dataset).toEqual(await call.data.loadAll.query());
    expect(snapshot.syncVersion).toBe(await call.data.syncVersion.query());
  });

  it("never reports a version newer than its rows, so a write mid-load is refetched", async () => {
    const uid = freshUid();
    const call = server.asUid(uid);
    await call.tasks.upsert.mutate(taskInput("t-seed", { title: "Seed" }));
    writeAfterListing(`users/${uid}/tasks`, () =>
      call.tasks.upsert.mutate(taskInput("t-mid-load", { title: "Elsewhere" })),
    );

    const snapshot = await call.data.loadSnapshot.query();
    vi.restoreAllMocks();

    expect(snapshot.dataset.tasks.map((task) => task.id)).toEqual(["t-seed"]);
    const cursor = createSyncCursor();
    cursor.reset(snapshot.syncVersion);
    expect(cursor.shouldRefetch(await call.data.syncVersion.query())).toBe(true);
  });
});
