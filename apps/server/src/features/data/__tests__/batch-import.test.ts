import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initAdmin } from "../../../core/firebase-admin";
import { createRepository } from "../../../core/repository";
import { mindCard as card, mindCards as cards } from "../../../test/data-fixtures";
import { resolveEmulatorConfig } from "../../../test/emulator";
import { withFailingCommit } from "../../../test/failing-commit";
import { bootTestServer, type TestServer } from "../../../test/harness";

describe("batched importCollection (real server vs emulator)", () => {
  let server: TestServer;
  let failing: TestServer;
  let armFailure: (failAt: number) => void;

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

  it("splits a payload larger than one batch into 450-write chunks", async () => {
    const uid = "import-chunking";
    const result = await server.asUid(uid).data.importCollection.mutate({
      collection: "mindCards",
      records: cards(451, "chunk"),
    });

    expect(result).toEqual({
      inserted: 451,
      skipped: 0,
      writtenChunks: 2,
      syncVersion: expect.any(Number),
    });
    expect((await server.asUid(uid).data.list.query({ collection: "mindCards" })).length).toBe(451);
  });

  it("bumps the sync counter exactly once for a multi-chunk import", async () => {
    const uid = "import-counter";
    const before = await server.asUid(uid).data.syncVersion.query();

    await server.asUid(uid).data.importCollection.mutate({
      collection: "mindCards",
      records: cards(451, "counter"),
    });

    expect((await server.asUid(uid).data.syncVersion.query()) - before).toBe(1);
  });

  it("re-running an identical import writes nothing and leaves the counter still", async () => {
    const uid = "import-idempotent";
    const records = cards(20, "same");
    await server.asUid(uid).data.importCollection.mutate({ collection: "mindCards", records });
    const afterFirst = await server.asUid(uid).data.syncVersion.query();

    const replay = await server.asUid(uid).data.importCollection.mutate({
      collection: "mindCards",
      records,
    });

    expect(replay).toEqual({ inserted: 0, skipped: 20, writtenChunks: 0, syncVersion: null });
    expect(await server.asUid(uid).data.syncVersion.query()).toBe(afterFirst);
  });

  it("writes only the rows that actually changed", async () => {
    const uid = "import-partial-change";
    const records = cards(5, "delta");
    await server.asUid(uid).data.importCollection.mutate({ collection: "mindCards", records });

    const result = await server.asUid(uid).data.importCollection.mutate({
      collection: "mindCards",
      records: [card("delta_0", "edited"), ...records.slice(1)],
    });

    expect(result).toEqual({
      inserted: 1,
      skipped: 4,
      writtenChunks: 1,
      syncVersion: expect.any(Number),
    });
    const stored = await createRepository(server.firestore, uid, "mindCards").get("delta_0");
    expect(stored?.body).toBe("edited");
  });

  it("stamps exactly the meta a single-record upsert would", async () => {
    const batchedUid = "import-meta-batched";
    const singleUid = "import-meta-single";
    await server.asUid(batchedUid).data.importCollection.mutate({
      collection: "mindCards",
      records: [card("meta_1")],
    });
    await server.asUid(singleUid).data.upsert.mutate({
      collection: "mindCards",
      record: card("meta_1"),
    });

    const batched = await createRepository(server.firestore, batchedUid, "mindCards").get("meta_1");
    const single = await createRepository(server.firestore, singleUid, "mindCards").get("meta_1");

    expect(typeof batched?.updatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(batched?.updatedAt ?? ""))).toBe(false);
    // A null value equals the absent prior value, so it draws no stamp — on both write paths.
    expect(Object.keys(batched?.fieldUpdatedAt ?? {}).sort()).toEqual(
      Object.entries(card("meta_1"))
        .filter(([, value]) => value !== null)
        .map(([key]) => key)
        .sort(),
    );
    expect(Object.keys(batched?.fieldUpdatedAt ?? {}).sort()).toEqual(
      Object.keys(single?.fieldUpdatedAt ?? {}).sort(),
    );
    expect(new Set(Object.values(batched?.fieldUpdatedAt ?? {}))).toEqual(
      new Set([batched?.updatedAt]),
    );
  });

  it("re-stamps only the changed field on a second import", async () => {
    const uid = "import-meta-delta";
    await server.asUid(uid).data.importCollection.mutate({
      collection: "mindCards",
      records: [card("meta_2")],
    });
    const first = await createRepository(server.firestore, uid, "mindCards").get("meta_2");

    await server.asUid(uid).data.importCollection.mutate({
      collection: "mindCards",
      records: [card("meta_2", "rewritten")],
    });
    const second = await createRepository(server.firestore, uid, "mindCards").get("meta_2");

    expect(second?.fieldUpdatedAt.title).toBe(first?.fieldUpdatedAt.title);
    expect(second?.fieldUpdatedAt.body).not.toBe(first?.fieldUpdatedAt.body);
    expect(second?.updatedAt).toBe(second?.fieldUpdatedAt.body);
  });

  it("collapses a duplicated id within one payload to the last row", async () => {
    const uid = "import-dupes";
    const result = await server.asUid(uid).data.importCollection.mutate({
      collection: "mindCards",
      records: [card("dupe_1", "first"), card("dupe_1", "last")],
    });

    expect(result).toEqual({
      inserted: 1,
      skipped: 0,
      writtenChunks: 1,
      syncVersion: expect.any(Number),
    });
    const stored = await createRepository(server.firestore, uid, "mindCards").get("dupe_1");
    expect(stored?.body).toBe("last");
  });

  it("rejects the whole payload before writing anything when a record is malformed", async () => {
    const uid = "import-invalid";
    await expect(
      server.asUid(uid).data.importCollection.mutate({
        collection: "mindCards",
        records: [card("bad_1"), { ...card("bad_2"), title: 7 }],
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });

    expect(await server.asUid(uid).data.list.query({ collection: "mindCards" })).toEqual([]);
  });

  it("still bumps the counter once when a later chunk fails, and reports the written chunks", async () => {
    const uid = "import-partial-commit";
    const before = await failing.asUid(uid).data.syncVersion.query();
    armFailure(2);

    await expect(
      failing.asUid(uid).data.importCollection.mutate({
        collection: "mindCards",
        records: cards(451, "partial"),
      }),
    ).rejects.toMatchObject({
      data: { partialCommit: { writtenRows: 450, writtenChunks: 1, failedChunk: 1 } },
    });

    expect((await failing.asUid(uid).data.syncVersion.query()) - before).toBe(1);
    expect((await failing.asUid(uid).data.list.query({ collection: "mindCards" })).length).toBe(
      450,
    );
  });

  it("retrying after a partial commit lands only the rows that were missing", async () => {
    const uid = "import-partial-commit";
    armFailure(Number.POSITIVE_INFINITY);

    const retry = await failing.asUid(uid).data.importCollection.mutate({
      collection: "mindCards",
      records: cards(451, "partial"),
    });

    expect(retry).toEqual({
      inserted: 1,
      skipped: 450,
      writtenChunks: 1,
      syncVersion: expect.any(Number),
    });
    expect((await failing.asUid(uid).data.list.query({ collection: "mindCards" })).length).toBe(
      451,
    );
  });

  it("rejects an unauthenticated import with UNAUTHORIZED", async () => {
    await expect(
      server.call.data.importCollection.mutate({
        collection: "mindCards",
        records: [card("anon_1")],
      }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
  });
});
