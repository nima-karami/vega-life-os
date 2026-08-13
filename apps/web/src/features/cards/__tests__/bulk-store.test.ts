import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PersistenceAdapter } from "@/core/persistence";
import { PartialWriteError, persistence } from "@/core/persistence";
import { useStore } from "@/core/store";
import { setPersistAuth } from "@/core/store/persist";
import { buildCard } from "./fixtures";

type BulkAnswer = () => Promise<{ writtenChunks: number }>;

const unreachable = () => Promise.reject(new Error("not part of this test"));
let answer: BulkAnswer = async () => ({ writtenChunks: 1 });

const adapter: PersistenceAdapter = {
  init: async () => {},
  isEmpty: async () => false,
  loadAll: () => unreachable() as Promise<never>,
  readSyncVersion: () => unreachable() as Promise<never>,
  load: () => unreachable() as Promise<never>,
  put: async () => {},
  remove: async () => {},
  bulkPut: async (_collection, items) => ({
    inserted: items.length,
    skipped: 0,
    writtenChunks: (await answer()).writtenChunks,
  }),
  bulkRemove: async (_collection, ids) => ({
    removed: ids.length,
    missing: 0,
    writtenChunks: (await answer()).writtenChunks,
  }),
  clearAll: unreachable,
};

beforeEach(() => {
  persistence.setDelegate(adapter);
  setPersistAuth("uid_owner");
  answer = async () => ({ writtenChunks: 1 });
  useStore.setState({
    authUid: "uid_owner",
    toast: null,
    cards: [
      buildCard({ id: "a", title: "Inversion", category: "Mental models" }),
      buildCard({ id: "b", title: "hygge", category: "Language", box: 3 }),
      buildCard({ id: "c", title: "Loss aversion", category: "Mental models" }),
    ],
  });
});

afterEach(() => {
  setPersistAuth(null);
});

describe("patchCards", () => {
  it("applies the patch to every named row and returns their prior state", async () => {
    const result = await useStore.getState().patchCards(["a", "c"], { category: "Deep work" });

    expect(useStore.getState().cards.map((card) => card.category)).toEqual([
      "Deep work",
      "Language",
      "Deep work",
    ]);
    expect(result.failedIds).toEqual([]);
    expect(result.priorCards.map((card) => card.category)).toEqual([
      "Mental models",
      "Mental models",
    ]);
  });

  it("ignores ids that are not in the store", async () => {
    const result = await useStore.getState().patchCards(["ghost"], { category: "x" });
    expect(result.priorCards).toEqual([]);
    expect(result.failedIds).toEqual([]);
  });

  it("names the rows past the landed prefix when a chunk is rejected", async () => {
    answer = () =>
      Promise.reject(new PartialWriteError({ writtenRows: 1, writtenChunks: 1, failedChunk: 1 }));

    const result = await useStore
      .getState()
      .patchCards(["a", "b", "c"], { hiddenAt: "2026-08-11" });

    expect(result.failedIds).toEqual(["b", "c"]);
  });

  it("skips a card that has nothing to recall instead of giving it a box", async () => {
    useStore.setState({
      cards: [
        buildCard({ id: "p", type: "prompt", title: "What would this look like if it were easy?" }),
        buildCard({ id: "q", type: "quote", title: "On attention", hasRecall: false }),
        buildCard({ id: "n", type: "note", title: "Inversion" }),
      ],
    });

    const result = await useStore
      .getState()
      .patchCards(["p", "q", "n"], { box: 1, nextDue: "2026-08-11" });

    expect(result.skippedIds).toEqual(["p", "q"]);
    expect(result.priorCards.map((card) => card.id)).toEqual(["n"]);
    const byId = new Map(useStore.getState().cards.map((card) => [card.id, card]));
    expect(byId.get("p")?.box).toBeNull();
    expect(byId.get("q")?.box).toBeNull();
    expect(byId.get("n")?.box).toBe(1);
  });

  it("ends the schedule when a patch lands a graded card on a type that cannot hold one", async () => {
    useStore.setState({
      cards: [
        buildCard({
          id: "g",
          type: "note",
          box: 3,
          nextDue: "2026-08-20",
          lastReviewed: "2026-08-01",
          reviewCount: 7,
        }),
      ],
    });

    const result = await useStore.getState().patchCards(["g"], { type: "prompt" });

    const [patched] = useStore.getState().cards;
    expect(patched.box).toBeNull();
    expect(patched.nextDue).toBeNull();
    expect(patched.lastReviewed).toBeNull();
    expect(patched.reviewCount).toBe(7);
    expect(result.skippedIds).toEqual([]);
  });
});

describe("deleteCards", () => {
  it("drops the rows and hands back what it removed", async () => {
    const result = await useStore.getState().deleteCards(["a", "b"]);

    expect(useStore.getState().cards.map((card) => card.id)).toEqual(["c"]);
    expect(result.priorCards.map((card) => card.id)).toEqual(["a", "b"]);
  });
});

describe("restoreCards", () => {
  it("puts deleted rows back with their review state intact", async () => {
    const removed = await useStore.getState().deleteCards(["b"]);
    await useStore.getState().restoreCards(removed.priorCards);

    const restored = useStore.getState().cards.find((card) => card.id === "b");
    expect(restored?.box).toBe(3);
  });
});
