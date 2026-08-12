import type { Card } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { type CardFilter, computeStats, queryCards } from "../queries";
import { buildCard } from "./fixtures";

const card = (over: Partial<Card> = {}): Card =>
  buildCard({ title: "", body: "", category: "", ...over });

const query = (cards: Card[], over: Partial<Parameters<typeof queryCards>[1]> = {}) =>
  queryCards(cards, {
    query: "",
    filter: "all",
    sort: { column: "addedAt", direction: "desc" },
    category: null,
    ...over,
  });

describe("queryCards", () => {
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
    expect(
      query(cards, { sort: { column: "addedAt", direction: "desc" } }).map((c) => c.id),
    ).toEqual(["c", "b", "a"]);
  });

  it("sorts by category A→Z then newest", () => {
    const cards = [
      card({ id: "x", category: "Zeta", addedAt: "2026-07-05" }),
      card({ id: "y", category: "alpha", addedAt: "2026-07-01" }),
      card({ id: "z", category: "alpha", addedAt: "2026-07-04" }),
    ];
    expect(
      query(cards, { sort: { column: "category", direction: "asc" } }).map((c) => c.id),
    ).toEqual(["z", "y", "x"]);
  });

  it("sorts by box desc with nulls last", () => {
    const cards = [
      card({ id: "n", box: null, addedAt: "2026-07-09" }),
      card({ id: "b1", box: 1 }),
      card({ id: "b3", box: 3 }),
    ];
    expect(
      query(cards, { sort: { column: "status", direction: "asc" }, filter: "all" }).map(
        (c) => c.id,
      ),
    ).toEqual(["b3", "b1", "n"]);
  });

  it("sorts by type ascending with newest as tiebreak", () => {
    const cards = [
      card({ id: "m", type: "quote", addedAt: "2026-07-01" }),
      card({ id: "f2", type: "note", addedAt: "2026-07-02" }),
      card({ id: "f1", type: "note", addedAt: "2026-07-05" }),
    ];
    const rows = query(cards, { sort: { column: "type", direction: "asc" } });
    expect(rows.map((row) => row.type)).toEqual([...rows.map((row) => row.type)].sort());
    expect(rows.map((row) => row.id)).toEqual(["f1", "f2", "m"]);
  });

  it("sorts by type descending with newest as tiebreak", () => {
    const cards = [
      card({ id: "m", type: "quote", addedAt: "2026-07-01" }),
      card({ id: "f2", type: "note", addedAt: "2026-07-02" }),
      card({ id: "f1", type: "note", addedAt: "2026-07-05" }),
    ];
    const rows = query(cards, { sort: { column: "type", direction: "desc" } });
    expect(rows.map((row) => row.type)).toEqual([...rows.map((row) => row.type)].sort().reverse());
    expect(rows.map((row) => row.id)).toEqual(["m", "f1", "f2"]);
  });

  it("does not mutate the input array", () => {
    const cards = [
      card({ id: "a", addedAt: "2026-07-01" }),
      card({ id: "b", addedAt: "2026-07-02" }),
    ];
    const snapshot = cards.map((c) => c.id);
    query(cards, { sort: { column: "addedAt", direction: "desc" } });
    expect(cards.map((c) => c.id)).toEqual(snapshot);
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
