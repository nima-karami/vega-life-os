import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../../../core/repository";
import { taskInput } from "../../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";

/**
 * The counter is what lets a polling client spend one read instead of re-reading the whole
 * dataset, so every write path has to move it — a missed bump is a client that never refreshes.
 */
describe("sync version counter", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("starts at zero for a user that has never written", async () => {
    expect(await server.asUid("sv-fresh").data.syncVersion.query()).toBe(0);
  });

  it("advances on an upsert and again on a delete", async () => {
    const uid = "sv-writes";
    const call = server.asUid(uid);
    const start = await call.data.syncVersion.query();

    await call.tasks.upsert.mutate(taskInput("sv-t1"));
    const afterUpsert = await call.data.syncVersion.query();
    expect(afterUpsert).toBeGreaterThan(start);

    await call.tasks.delete.mutate({ id: "sv-t1" });
    expect(await call.data.syncVersion.query()).toBeGreaterThan(afterUpsert);
  });

  it("advances on a server-side write that never touches a router", async () => {
    const uid = "sv-server-side";
    const call = server.asUid(uid);
    const start = await call.data.syncVersion.query();

    await createRepository(server.firestore, uid, "tasks", server.now).upsert(taskInput("sv-t2"));

    expect(await call.data.syncVersion.query()).toBeGreaterThan(start);
  });

  it("advances on deleteAll, which deletes in batches around the repository", async () => {
    const uid = "sv-wipe";
    const call = server.asUid(uid);
    await call.tasks.upsert.mutate(taskInput("sv-t3"));
    const beforeWipe = await call.data.syncVersion.query();

    await call.data.deleteAll.mutate();

    expect(await call.data.syncVersion.query()).toBeGreaterThan(beforeWipe);
  });

  it("stays put when nothing is written", async () => {
    const call = server.asUid("sv-idle");
    await call.tasks.upsert.mutate(taskInput("sv-t4"));
    const settled = await call.data.syncVersion.query();

    expect(await call.data.syncVersion.query()).toBe(settled);
    expect(await call.data.syncVersion.query()).toBe(settled);
  });
});
