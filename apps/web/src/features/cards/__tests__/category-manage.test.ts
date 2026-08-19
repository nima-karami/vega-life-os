import { DEFAULT_CARD_PREFS } from "@vega/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PersistenceAdapter } from "@/core/persistence";
import { persistence } from "@/core/persistence";
import { useStore } from "@/core/store";
import { setPersistAuth } from "@/core/store/persist";
import { buildCard } from "./fixtures";

const unreachable = () => Promise.reject(new Error("not part of this test"));

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
    writtenChunks: 1,
  }),
  bulkRemove: async (_collection, ids) => ({ removed: ids.length, missing: 0, writtenChunks: 1 }),
  clearAll: unreachable,
};

beforeEach(() => {
  persistence.setDelegate(adapter);
  setPersistAuth("uid_owner");
  useStore.setState({
    authUid: "uid_owner",
    toast: null,
    cards: [
      buildCard({ id: "a", title: "hygge", category: "Language" }),
      buildCard({ id: "b", title: "sonder", category: "Language" }),
      buildCard({ id: "c", title: "Inversion", category: "attention" }),
      buildCard({ id: "d", title: "On focus", category: "life" }),
      buildCard({ id: "e", title: "Loose ends", category: "" }),
    ],
    cardPrefs: { ...DEFAULT_CARD_PREFS, categories: ["Language", "attention", "life"] },
  });
});

afterEach(() => {
  setPersistAuth(null);
});

describe("renameCardCategory", () => {
  it("is a true no-op when the target is byte-identical to the source", async () => {
    await useStore.getState().renameCardCategory("Language", "Language");

    expect(useStore.getState().cards.map((card) => card.category)).toEqual([
      "Language",
      "Language",
      "attention",
      "life",
      "",
    ]);
    expect(useStore.getState().cardPrefs.categories).toEqual(["Language", "attention", "life"]);
  });

  it("rewrites every card on a case-only rename", async () => {
    await useStore.getState().renameCardCategory("Language", "language");

    expect(
      useStore
        .getState()
        .cards.filter((card) => card.category === "language")
        .map((card) => card.id),
    ).toEqual(["a", "b"]);
    expect(useStore.getState().cards.some((card) => card.category === "Language")).toBe(false);
    expect(useStore.getState().cardPrefs.categories).toEqual(["language", "attention", "life"]);
  });

  it("merges onto an existing different category, both groups spelled as typed", async () => {
    await useStore.getState().renameCardCategory("attention", "life");

    const byId = new Map(useStore.getState().cards.map((card) => [card.id, card]));
    expect(byId.get("c")?.category).toBe("life");
    expect(byId.get("d")?.category).toBe("life");
    expect(useStore.getState().cardPrefs.categories).toEqual(["Language", "life"]);
  });

  it("no-ops defensively on an empty target without writing anything", async () => {
    await useStore.getState().renameCardCategory("attention", "   ");

    expect(useStore.getState().cards.find((card) => card.id === "c")?.category).toBe("attention");
    expect(useStore.getState().cardPrefs.categories).toEqual(["Language", "attention", "life"]);
  });

  it("still rewrites prefs when the source category carries no cards", async () => {
    useStore.setState({
      cardPrefs: { ...DEFAULT_CARD_PREFS, categories: ["ghost"] },
    });

    await useStore.getState().renameCardCategory("ghost", "renamed");

    expect(useStore.getState().cards.every((card) => card.category !== "renamed")).toBe(true);
    expect(useStore.getState().cardPrefs.categories).toEqual(["renamed"]);
  });
});

describe("deleteCardCategory", () => {
  it("clears the category on every matching card and prunes prefs", async () => {
    await useStore.getState().deleteCardCategory("Language");

    expect(
      useStore
        .getState()
        .cards.filter((card) => card.category === "")
        .map((card) => card.id)
        .sort(),
    ).toEqual(["a", "b", "e"]);
    expect(useStore.getState().cardPrefs.categories).toEqual(["attention", "life"]);
  });

  it("is key-matched for both cards and prefs", async () => {
    await useStore.getState().deleteCardCategory("LANGUAGE");

    expect(useStore.getState().cards.some((card) => card.category === "Language")).toBe(false);
    expect(useStore.getState().cardPrefs.categories).toEqual(["attention", "life"]);
  });
});
