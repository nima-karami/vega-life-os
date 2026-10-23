import { createSyncCursor, readSyncReceipt } from "@vega/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { taskInput } from "../../../test/calendar-fixtures";
import { mindCard, mindCards } from "../../../test/data-fixtures";
import { type AppClient, bootTestServer, type TestServer } from "../../../test/harness";
import { countFirestoreReads } from "../../../test/read-counter";

/** The web store's poll loop, reduced to the part that decides whether a poll pays for `loadAll`. */
function createPollingClient(call: AppClient) {
  const cursor = createSyncCursor();
  let refetches = 0;
  return {
    async connect() {
      cursor.reset(await call.data.syncVersion.query());
    },
    async write<T>(mutation: (client: AppClient) => Promise<T>): Promise<T> {
      const response = await mutation(call);
      const syncVersion = readSyncReceipt(response);
      if (syncVersion !== null) cursor.recordOwnWrite(syncVersion);
      return response;
    },
    async poll() {
      if (!cursor.shouldRefetch(await call.data.syncVersion.query())) return;
      refetches += 1;
      await call.data.loadAll.query();
    },
    get refetches() {
      return refetches;
    },
  };
}

describe("sync read budget (real server vs emulator)", () => {
  let server: TestServer;
  let reads: ReturnType<typeof countFirestoreReads>;
  let uidSeq = 0;
  const freshUid = () => `u-read-budget-${Date.now()}-${uidSeq++}`;

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });
  afterEach(() => reads?.restore());

  async function seededAccount(uid: string) {
    await server.asUid(uid).data.importCollection.mutate({
      collection: "mindCards",
      records: mindCards(20, "seed"),
    });
  }

  it("a client's own writes never make its next poll re-read the dataset", async () => {
    const uid = freshUid();
    await seededAccount(uid);
    const device = createPollingClient(server.asUid(uid));
    await device.connect();
    reads = countFirestoreReads();

    await device.write((c) => c.tasks.upsert.mutate(taskInput("t-own", { title: "Own" })));
    await device.write((c) => c.tasks.delete.mutate({ id: "t-own" }));
    await device.write((c) =>
      c.data.upsert.mutate({ collection: "mindCards", record: mindCard("m-own") }),
    );
    await device.write((c) => c.data.remove.mutate({ collection: "mindCards", id: "m-own" }));
    await device.write((c) =>
      c.data.importCollection.mutate({ collection: "mindCards", records: mindCards(3, "own") }),
    );
    await device.write((c) =>
      c.data.bulkRemove.mutate({ collection: "mindCards", ids: ["own_0", "own_1"] }),
    );
    reads.reset();
    await device.poll();

    expect(device.refetches).toBe(0);
    expect(reads.tally).toEqual({ dataset: 0, counter: 1, other: 0 });
  });

  it("concurrent own writes still leave the next poll at one counter read", async () => {
    const uid = freshUid();
    await seededAccount(uid);
    const device = createPollingClient(server.asUid(uid));
    await device.connect();

    await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        device.write((c) =>
          c.data.upsert.mutate({ collection: "mindCards", record: mindCard(`m-burst-${index}`) }),
        ),
      ),
    );
    reads = countFirestoreReads();
    await device.poll();

    expect(device.refetches).toBe(0);
    expect(reads.tally.dataset).toBe(0);
  });

  it("another device's write costs exactly one refetch, then polls go quiet", async () => {
    const uid = freshUid();
    await seededAccount(uid);
    const laptop = createPollingClient(server.asUid(uid));
    const phone = createPollingClient(server.asUid(uid));
    await laptop.connect();
    await phone.connect();

    await laptop.write((c) =>
      c.data.upsert.mutate({ collection: "mindCards", record: mindCard("m-laptop") }),
    );
    await phone.write((c) =>
      c.data.upsert.mutate({ collection: "mindCards", record: mindCard("m-phone") }),
    );
    reads = countFirestoreReads();
    await laptop.poll();
    await laptop.poll();

    expect(laptop.refetches).toBe(1);
    expect(reads.tally.counter).toBe(2);
    expect(reads.tally.dataset).toBeGreaterThanOrEqual(22);
  });

  it("an own write costs one extra counter read and nothing more", async () => {
    const uid = freshUid();
    await seededAccount(uid);
    const device = createPollingClient(server.asUid(uid));
    await device.connect();
    reads = countFirestoreReads();

    await device.write((c) =>
      c.data.upsert.mutate({ collection: "mindCards", record: mindCard("m-cost") }),
    );

    expect(reads.tally).toEqual({ dataset: 1, counter: 1, other: 0 });
  });

  it("a contended counter still moves, but the writer is told nothing and so refetches", async () => {
    const contended = new Proxy(server.firestore, {
      get(target, key) {
        if (key === "runTransaction") return () => Promise.reject(new Error("contention"));
        const member = Reflect.get(target, key, target);
        return typeof member === "function" ? member.bind(target) : member;
      },
    });
    const failing = await bootTestServer({ firestore: contended });
    try {
      const uid = freshUid();
      const device = createPollingClient(failing.asUid(uid));
      await device.connect();

      const response = await device.write((c) =>
        c.data.upsert.mutate({ collection: "mindCards", record: mindCard("m-contended") }),
      );
      await device.poll();

      expect(readSyncReceipt(response)).toBeNull();
      expect(await failing.asUid(uid).data.syncVersion.query()).toBe(1);
      expect(device.refetches).toBe(1);
    } finally {
      await failing.close();
    }
  });

  it("a write that changes nothing reports no version and moves nothing", async () => {
    const uid = freshUid();
    await seededAccount(uid);
    const call = server.asUid(uid);
    const record = mindCard("m-replay");
    await call.data.upsert.mutate({ collection: "mindCards", record });
    const before = await call.data.syncVersion.query();

    const replay = await call.data.upsert.mutate({ collection: "mindCards", record });

    expect(readSyncReceipt(replay)).toBeNull();
    expect(await call.data.syncVersion.query()).toBe(before);
  });
});
