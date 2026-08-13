import { describe, expect, it } from "vitest";
import { EMPTY_CARD_FILTER } from "../manager-filter";
import {
  computeCardStats,
  DEFAULT_CARD_SORT,
  describeCardLearning,
  describeCardStats,
  queryCards,
} from "../manager-query";
import { buildCard } from "./fixtures";

const TODAY = "2026-08-11";

const run = (cards: Parameters<typeof queryCards>[0], over = {}) =>
  queryCards(cards, {
    query: "",
    filter: EMPTY_CARD_FILTER,
    sort: DEFAULT_CARD_SORT,
    today: TODAY,
    ...over,
  });

describe("queryCards", () => {
  it("defaults to newest added first", () => {
    const rows = run([
      buildCard({ id: "old", addedAt: "2026-07-14" }),
      buildCard({ id: "new", addedAt: "2026-08-08" }),
    ]);
    expect(rows.map((card) => card.id)).toEqual(["new", "old"]);
  });

  it("sorts by title ascending when asked", () => {
    const rows = run(
      [buildCard({ id: "b", title: "hygge" }), buildCard({ id: "a", title: "Attention" })],
      { sort: { column: "title", direction: "asc" } },
    );
    expect(rows.map((card) => card.id)).toEqual(["a", "b"]);
  });

  it("orders learning by box, deepest first, with not-learning last", () => {
    const rows = run(
      [
        buildCard({ id: "none", box: null }),
        buildCard({ id: "box1", box: 1 }),
        buildCard({ id: "box5", box: 5 }),
      ],
      { sort: { column: "learning", direction: "desc" } },
    );
    expect(rows.map((card) => card.id)).toEqual(["box5", "box1", "none"]);
  });

  it("applies the search and the filter together", () => {
    const rows = run(
      [
        buildCard({ id: "keep", type: "vocabulary", title: "saudade" }),
        buildCard({ id: "wrong-type", type: "note", title: "saudade note" }),
        buildCard({ id: "wrong-text", type: "vocabulary", title: "hygge" }),
      ],
      { query: "saudade", filter: { ...EMPTY_CARD_FILTER, types: ["vocabulary"] } },
    );
    expect(rows.map((card) => card.id)).toEqual(["keep"]);
  });
});

describe("computeCardStats", () => {
  it("counts total, learning and due today", () => {
    const stats = computeCardStats(
      [
        buildCard({ id: "a", box: 3, nextDue: "2026-08-10" }),
        buildCard({ id: "b", box: 1, nextDue: "2026-08-20" }),
        buildCard({ id: "c" }),
      ],
      TODAY,
    );
    expect(stats).toEqual({ total: 3, learning: 2, dueToday: 1 });
  });
});

describe("describeCardStats", () => {
  it("reads as the full deck when nothing is filtered out", () => {
    expect(describeCardStats({ total: 48, learning: 12, dueToday: 6 }, 48)).toBe(
      "48 cards · 12 learning · 6 due today",
    );
  });

  it("restates the result count while filtered", () => {
    expect(describeCardStats({ total: 48, learning: 12, dueToday: 6 }, 2)).toBe(
      "2 of 48 cards · filtered",
    );
  });

  it("agrees with itself in the singular", () => {
    expect(describeCardStats({ total: 1, learning: 1, dueToday: 0 }, 1)).toBe(
      "1 card · 1 learning · 0 due today",
    );
  });
});

describe("describeCardLearning", () => {
  it("carries the box number inside the one label", () => {
    expect(describeCardLearning(buildCard({ box: 3 }))).toBe("Learning · box 3");
    expect(describeCardLearning(buildCard({ box: null }))).toBe("Not learning");
  });
});
