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
      importCollection: {
        mutate: vi.fn(async () => ({ inserted: 2, skipped: 0, writtenChunks: 1 })),
      },
      bulkRemove: {
        mutate: vi.fn(async () => ({ removed: 2, missing: 0, writtenChunks: 1 })),
      },
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

  it("routes router-less collections (mindCards, mindMeta) through the generic data router", async () => {
    const client = makeClient();
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);
    await adapter.put("mindCards", asTask("mc1"));
    expect(client.data.upsert.mutate).toHaveBeenCalledWith({
      collection: "mindCards",
      record: { id: "mc1" },
    });
    await adapter.remove("mindMeta", "category:life");
    expect(client.data.remove.mutate).toHaveBeenCalledWith({
      collection: "mindMeta",
      id: "category:life",
    });
  });

  it("routes bulkPut to data.importCollection and clearAll to data.deleteAll", async () => {
    const client = makeClient();
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);
    expect(await adapter.bulkPut("tasks", [asTask("t1"), asTask("t2")])).toEqual({
      inserted: 2,
      skipped: 0,
      writtenChunks: 1,
    });
    expect(client.data.importCollection.mutate).toHaveBeenCalledWith({
      collection: "tasks",
      records: [{ id: "t1" }, { id: "t2" }],
    });
    await adapter.clearAll();
    expect(client.data.deleteAll.mutate).toHaveBeenCalled();
  });

  it("routes bulkRemove through the generic data router for a domain collection too", async () => {
    const client = makeClient();
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);

    expect(await adapter.bulkRemove("tasks", ["t1", "t2"])).toEqual({
      removed: 2,
      missing: 0,
      writtenChunks: 1,
    });
    expect(client.data.bulkRemove.mutate).toHaveBeenCalledWith({
      collection: "tasks",
      ids: ["t1", "t2"],
    });
    expect(client.tasks.delete.mutate).not.toHaveBeenCalled();
  });

  it("turns a rejected bulkRemove's partial-commit detail into a PartialWriteError", async () => {
    const client = makeClient();
    const detail = { writtenRows: 225, writtenChunks: 1, failedChunk: 1 };
    client.data.bulkRemove.mutate.mockRejectedValueOnce(
      Object.assign(new Error("partial commit"), { data: { partialCommit: detail } }),
    );
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);
    await expect(adapter.bulkRemove("tasks", ["t1"])).rejects.toMatchObject({ detail });
  });

  it("turns the server's partial-commit detail into a PartialWriteError", async () => {
    const client = makeClient();
    const detail = { writtenRows: 450, writtenChunks: 1, failedChunk: 1 };
    client.data.importCollection.mutate.mockRejectedValueOnce(
      Object.assign(new Error("partial commit"), { data: { partialCommit: detail } }),
    );
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);
    await expect(adapter.bulkPut("tasks", [asTask("t1")])).rejects.toMatchObject({ detail });
  });

  it("propagates a bulk write that lost the whole call untouched", async () => {
    const client = makeClient();
    client.data.importCollection.mutate.mockRejectedValueOnce(new Error("backend down"));
    const adapter = new TrpcAdapter(client as unknown as TrpcClient);
    await expect(adapter.bulkPut("tasks", [asTask("t1")])).rejects.toThrow("backend down");
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
