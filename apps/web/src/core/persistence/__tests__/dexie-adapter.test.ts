import { beforeEach, describe, expect, it, vi } from "vitest";
import { COLLECTIONS } from "@/core/persistence";

const { fakeDb } = vi.hoisted(() => {
  type Row = { id: string };
  class FakeTable {
    private rows = new Map<string, Row>();
    async toArray() {
      return [...this.rows.values()];
    }
    async count() {
      return this.rows.size;
    }
    async put(item: Row) {
      this.rows.set(item.id, item);
    }
    async bulkPut(items: Row[]) {
      for (const item of items) this.rows.set(item.id, item);
    }
    async delete(id: string) {
      this.rows.delete(id);
    }
    async clear() {
      this.rows.clear();
    }
  }
  const columns = [
    "values",
    "goals",
    "habits",
    "tasks",
    "books",
    "movies",
    "vocab",
    "reviews",
    "journal",
    "calendarEvents",
    "mindCards",
    "mindMeta",
  ];
  return { fakeDb: Object.fromEntries(columns.map((col) => [col, new FakeTable()])) };
});

vi.mock("../db", () => ({ db: fakeDb }));

const { DexieAdapter } = await import("../dexie-adapter");

describe("DexieAdapter iterates every collection", () => {
  beforeEach(async () => {
    await Promise.all(COLLECTIONS.map((col) => fakeDb[col].clear()));
  });

  it("round-trips a newer collection (mindCards/mindMeta) through loadAll", async () => {
    const adapter = new DexieAdapter();
    await adapter.bulkPut("mindCards", [{ id: "c1" }, { id: "c2" }] as never);
    await adapter.bulkPut("mindMeta", [{ id: "m1" }] as never);

    const loaded = await adapter.loadAll();
    expect(loaded.mindCards.map((card) => card.id)).toEqual(["c1", "c2"]);
    expect(loaded.mindMeta.map((meta) => meta.id)).toEqual(["m1"]);

    await adapter.clearAll();
    const cleared = await adapter.loadAll();
    expect(cleared.mindCards).toEqual([]);
    expect(cleared.mindMeta).toEqual([]);
  });

  it("loadAll returns a key for every registered collection", async () => {
    const loaded = await new DexieAdapter().loadAll();
    for (const col of COLLECTIONS) expect(loaded).toHaveProperty(col);
  });
});
