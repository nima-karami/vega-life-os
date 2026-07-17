import { describe, expect, it, vi } from "vitest";
import { TrpcAdapter } from "../trpc-adapter";
import type { TrpcClient } from "../trpc-client";

function makeClient() {
  const emptyList = { query: vi.fn(async () => [] as unknown[]) };
  return {
    values: { list: { query: vi.fn(async () => [{ id: "v1" }]) } },
    goals: { list: emptyList },
    habits: { list: emptyList },
    tasks: {
      list: { query: vi.fn(async () => [{ id: "t1" }]) },
      upsert: { mutate: vi.fn(async (r: unknown) => r) },
      delete: { mutate: vi.fn(async (i: { id: string }) => i) },
    },
    books: { list: emptyList },
    movies: { list: emptyList },
    vocab: { list: emptyList },
    reviews: { list: emptyList },
    journal: { list: emptyList },
    data: {
      list: { query: vi.fn(async () => [{ id: "ce1" }]) },
      loadAll: {
        query: vi.fn(async () => ({
          values: [{ id: "v1" }],
          goals: [],
          habits: [],
          tasks: [{ id: "t1" }],
          books: [],
          movies: [],
          vocab: [],
          reviews: [],
          journal: [],
          calendarEvents: [{ id: "ce1" }],
        })),
      },
      upsert: { mutate: vi.fn(async (i: { record: unknown }) => i.record) },
      remove: { mutate: vi.fn(async (i: { id: string }) => i) },
      importCollection: { mutate: vi.fn(async () => ({ count: 2 })) },
      deleteAll: { mutate: vi.fn(async () => ({ ok: true })) },
    },
  };
}

const asTask = (id: string) => ({ id }) as never;

describe("TrpcAdapter", () => {
  it("routes a domain put to the domain upsert", async () => {
    const client = makeClient();
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);
    await adapter.put("tasks", asTask("t1"));
    expect(client.tasks.upsert.mutate).toHaveBeenCalledWith({ id: "t1" });
  });

  it("routes a calendarEvents put through the generic data router", async () => {
    const client = makeClient();
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);
    await adapter.put("calendarEvents", asTask("ce1"));
    expect(client.data.upsert.mutate).toHaveBeenCalledWith({
      collection: "calendarEvents",
      record: { id: "ce1" },
    });
  });

  it("routes bulkPut to data.importCollection and clearAll to data.deleteAll", async () => {
    const client = makeClient();
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);
    await adapter.bulkPut("tasks", [asTask("t1"), asTask("t2")]);
    expect(client.data.importCollection.mutate).toHaveBeenCalledWith({
      collection: "tasks",
      records: [{ id: "t1" }, { id: "t2" }],
    });
    await adapter.clearAll();
    expect(client.data.deleteAll.mutate).toHaveBeenCalled();
  });

  it("routes remove by collection (domain vs data)", async () => {
    const client = makeClient();
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);
    await adapter.remove("tasks", "t1");
    expect(client.tasks.delete.mutate).toHaveBeenCalledWith({ id: "t1" });
    await adapter.remove("calendarEvents", "ce1");
    expect(client.data.remove.mutate).toHaveBeenCalledWith({
      collection: "calendarEvents",
      id: "ce1",
    });
  });

  it("loadAll fetches the whole dataset in one data.loadAll request", async () => {
    const client = makeClient();
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);
    const data = await adapter.loadAll();
    expect(data.values).toEqual([{ id: "v1" }]);
    expect(data.tasks).toEqual([{ id: "t1" }]);
    expect(data.calendarEvents).toEqual([{ id: "ce1" }]);
    expect(client.data.loadAll.query).toHaveBeenCalledTimes(1);
    expect(client.tasks.list.query).not.toHaveBeenCalled();
  });

  it("propagates a rejected write so the caller can revert", async () => {
    const client = makeClient();
    client.tasks.upsert.mutate.mockRejectedValueOnce(new Error("backend down"));
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);
    await expect(adapter.put("tasks", asTask("t1"))).rejects.toThrow("backend down");
  });
});
