import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { taskInput } from "../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../test/harness";

/** Set-by-id upsert is idempotent by construction: a replayed identical write yields one document. */
describe("idempotent double-submit (replay + concurrent, no opId)", () => {
  let server: TestServer;
  const uid = "u-replay";

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("a sequential replay after the first persisted returns an identical record and one document", async () => {
    const client = server.asUid(uid);
    const record = taskInput("t-seq", { title: "Replayed" });

    const first = await client.tasks.upsert.mutate(record);
    const second = await client.tasks.upsert.mutate(record);
    const third = await client.tasks.upsert.mutate(record);
    const { syncVersion: _firstVersion, ...firstRecord } = first;
    expect(second).toEqual({ ...firstRecord, syncVersion: null });
    expect(third).toEqual({ ...firstRecord, syncVersion: null });

    const matches = (await client.tasks.list.query()).filter((task) => task.id === "t-seq");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual(firstRecord);
  });

  it("a concurrent double-submit of the same id still collapses to one document", async () => {
    const client = server.asUid(uid);
    const record = taskInput("t-concurrent", { title: "Raced" });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => client.tasks.upsert.mutate(record)),
    );
    for (const result of results) expect(result.title).toBe("Raced");

    const matches = (await client.tasks.list.query()).filter((task) => task.id === "t-concurrent");
    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe("Raced");
  });
});
