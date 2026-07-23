import { describe, expect, it } from "vitest";
import type { MindCard } from "../model";
import {
  type CardFilter,
  computeStats,
  listCategories,
  parseBulkImport,
  queryMindCards,
} from "../queries";

const card = (over: Partial<MindCard> = {}): MindCard => ({
  id: over.id ?? "mc_1",
  title: "",
  body: "",
  type: "model",
  category: "",
  source: null,
  addedAt: "2026-07-01",
  hiddenAt: null,
  likedAt: null,
  flippable: true,
  box: null,
  lastReviewed: null,
  nextDue: null,
  updatedAt: "",
  fieldUpdatedAt: {},
  ...over,
});

const query = (cards: MindCard[], over: Partial<Parameters<typeof queryMindCards>[1]> = {}) =>
  queryMindCards(cards, { query: "", filter: "all", sort: "newest", category: null, ...over });

describe("queryMindCards", () => {
  it("searches title AND body case-insensitively", () => {
    const cards = [
      card({ id: "a", title: "Inversion", body: "avoid stupidity" }),
      card({ id: "b", title: "Mirroring", body: "repeat the last words" }),
    ];
    expect(query(cards, { query: "INVERSION" }).map((c) => c.id)).toEqual(["a"]);
    expect(query(cards, { query: "STUPID" }).map((c) => c.id)).toEqual(["a"]);
    expect(query(cards, { query: "repeat" }).map((c) => c.id)).toEqual(["b"]);
    expect(query(cards, { query: "zzz" })).toHaveLength(0);
  });

  it("filters learning / regular / hidden / all", () => {
    const learning = card({ id: "l", box: 2 });
    const regular = card({ id: "r" });
    const hidden = card({ id: "h", hiddenAt: "2026-07-02" });
    const cards = [learning, regular, hidden];

    const ids = (filter: CardFilter) =>
      query(cards, { filter })
        .map((c) => c.id)
        .sort();

    expect(ids("learning")).toEqual(["l"]);
    expect(ids("regular")).toEqual(["r"]);
    expect(ids("hidden")).toEqual(["h"]);
    expect(ids("all")).toEqual(["l", "r"]);
  });

  it("filters by category using case-insensitive match", () => {
    const cards = [
      card({ id: "a", category: "Topic M" }),
      card({ id: "b", category: "topic g" }),
    ];
    expect(query(cards, { category: "topic m" }).map((c) => c.id)).toEqual(["a"]);
    expect(
      query(cards, { category: null })
        .map((c) => c.id)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("sorts newest by addedAt desc with id tiebreak", () => {
    const cards = [
      card({ id: "b", addedAt: "2026-07-01" }),
      card({ id: "a", addedAt: "2026-07-01" }),
      card({ id: "c", addedAt: "2026-07-03" }),
    ];
    expect(query(cards, { sort: "newest" }).map((c) => c.id)).toEqual(["c", "b", "a"]);
  });

  it("sorts by category A→Z then newest", () => {
    const cards = [
      card({ id: "x", category: "Zeta", addedAt: "2026-07-05" }),
      card({ id: "y", category: "alpha", addedAt: "2026-07-01" }),
      card({ id: "z", category: "alpha", addedAt: "2026-07-04" }),
    ];
    expect(query(cards, { sort: "category" }).map((c) => c.id)).toEqual(["z", "y", "x"]);
  });

  it("sorts by box desc with nulls last", () => {
    const cards = [
      card({ id: "n", box: null, addedAt: "2026-07-09" }),
      card({ id: "b1", box: 1 }),
      card({ id: "b3", box: 3 }),
    ];
    expect(query(cards, { sort: "box", filter: "all" }).map((c) => c.id)).toEqual([
      "b3",
      "b1",
      "n",
    ]);
  });

  it("does not mutate the input array", () => {
    const cards = [
      card({ id: "a", addedAt: "2026-07-01" }),
      card({ id: "b", addedAt: "2026-07-02" }),
    ];
    const snapshot = cards.map((c) => c.id);
    query(cards, { sort: "newest" });
    expect(cards.map((c) => c.id)).toEqual(snapshot);
  });
});

describe("listCategories", () => {
  it("collapses case-insensitively keeping first-authored casing, sorted A→Z", () => {
    const cards = [
      card({ id: "a", category: "Topic M" }),
      card({ id: "b", category: "topic g" }),
      card({ id: "c", category: "topic m" }),
      card({ id: "d", category: "Topic G" }),
    ];
    expect(listCategories(cards)).toEqual(["topic g", "Topic M"]);
  });

  it("ignores blank categories", () => {
    const cards = [card({ id: "a", category: "" }), card({ id: "b", category: "Focus" })];
    expect(listCategories(cards)).toEqual(["Focus"]);
  });
});

describe("computeStats", () => {
  it("counts total, learning (box set), and due (nextDue <= today)", () => {
    const cards = [
      card({ id: "a" }),
      card({ id: "b", box: 2 }),
      card({ id: "c", box: 1, nextDue: "2026-07-01" }),
      card({ id: "d", box: 3, nextDue: "2026-08-01" }),
    ];
    expect(computeStats(cards, "2026-07-23")).toEqual({ cards: 4, learning: 3, dueToday: 1 });
  });

  it("is empty for no cards", () => {
    expect(computeStats([], "2026-07-23")).toEqual({ cards: 0, learning: 0, dueToday: 0 });
  });
});

describe("parseBulkImport", () => {
  it("parses lines, skips blank + duplicate, defaults missing body", () => {
    const result = parseBulkImport("a :: b\n\n a :: b\nc");
    expect(result.cards).toEqual([
      { title: "a", body: "b" },
      { title: "c", body: "" },
    ]);
    expect(result.skipped).toBe(2);
    expect(result.overLength).toBe(0);
  });

  it("flags and excludes over-length titles and bodies", () => {
    const longTitle = "t".repeat(201);
    const longBody = "b".repeat(2001);
    const result = parseBulkImport(`${longTitle}\nok :: ${longBody}\nfine :: short`);
    expect(result.cards).toEqual([{ title: "fine", body: "short" }]);
    expect(result.overLength).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it("keeps only the body after the first :: separator", () => {
    const result = parseBulkImport("title :: body :: with colons");
    expect(result.cards).toEqual([{ title: "title", body: "body :: with colons" }]);
  });
});
