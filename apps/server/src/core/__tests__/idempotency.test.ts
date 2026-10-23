import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootTestServer, type TestServer } from "../../test/harness";
import { sampleByCollection } from "../../test/samples";
import { toWireRow } from "../wire";

let server: TestServer;

beforeAll(async () => {
  server = await bootTestServer();
});
afterAll(async () => {
  await server.close();
});

describe("set-by-id upsert is idempotent (no opId mechanism)", () => {
  it("replays an identical client-id'd upsert to exactly one document", async () => {
    const uid = "idem-user";
    const record = sampleByCollection.tasks("idem-task");
    const client = server.asUid(uid);

    const first = await client.tasks.upsert.mutate(record);
    const second = await client.tasks.upsert.mutate(record);
    const { syncVersion: _firstVersion, ...firstRecord } = first;
    const { syncVersion: replayVersion, ...replayRecord } = second;
    expect(replayRecord).toEqual(firstRecord);
    expect(replayVersion).toBeNull();

    const matches = (await client.tasks.list.query()).filter((task) => task.id === record.id);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual(toWireRow(firstRecord));
  });
});
