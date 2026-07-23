import { describe, expect, it } from "vitest";
import type { FeedCard } from "../feed-cards";
import { buildFeedQueue, createSeededRng } from "../queue";

const feedCard = (id: string, category: string): FeedCard => ({
  id,
  kind: "authored",
  category,
  title: id,
  body: "",
  source: null,
  learning: false,
  box: null,
  due: false,
  maskedBody: null,
});

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

const contentIds = (queue: { cardId: string }[]): string[] =>
  queue.filter((e) => !e.cardId.startsWith("recap:")).map((e) => e.cardId);

const TODAY = "2026-07-23";

describe("createSeededRng", () => {
  it("is deterministic and stays in [0, 1)", () => {
    const rngA = createSeededRng(123);
    const rngB = createSeededRng(123);
    const seqA = range(5).map(() => rngA());
    const seqB = range(5).map(() => rngB());
    expect(seqA).toEqual(seqB);
    for (const value of seqA) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("buildFeedQueue", () => {
  it("is deterministic under a seed", () => {
    const pool = [
      ...range(12).map((i) => feedCard(`v${i}`, "vocabulary")),
      ...range(8).map((i) => feedCard(`n${i}`, "negotiation")),
      ...range(6).map((i) => feedCard(`h${i}`, "history")),
    ];
    const first = buildFeedQueue(pool, { seed: 42, today: TODAY });
    const second = buildFeedQueue(pool, { seed: 42, today: TODAY });
    expect(first).toEqual(second);
    const other = buildFeedQueue(pool, { seed: 43, today: TODAY });
    expect(other).not.toEqual(first);
  });

  it("normalizes category share (cap high categories, floor small ones)", () => {
    const pool = [
      ...range(40).map((i) => feedCard(`v${i}`, "vocabulary")),
      ...range(5).map((i) => feedCard(`n${i}`, "negotiation")),
      ...range(5).map((i) => feedCard(`m${i}`, "mental models")),
      ...range(5).map((i) => feedCard(`h${i}`, "history")),
    ];
    const categoryOf = new Map(pool.map((c) => [c.id, c.category]));
    const queue = buildFeedQueue(pool, { seed: 7, today: TODAY });
    const cap = Math.ceil(0.3 * pool.length); // passLength = pool length = 55 -> 17
    const counts = new Map<string, number>();
    for (const id of contentIds(queue)) {
      const cat = categoryOf.get(id) as string;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    for (const [, count] of counts) expect(count).toBeLessThanOrEqual(cap);
    expect(counts.get("vocabulary")).toBeLessThanOrEqual(cap);
    expect(counts.get("negotiation") ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("never repeats a card within the no-repeat window", () => {
    const pool = [
      ...range(10).map((i) => feedCard(`a${i}`, "alpha")),
      ...range(10).map((i) => feedCard(`b${i}`, "beta")),
      ...range(10).map((i) => feedCard(`c${i}`, "gamma")),
    ];
    const ids = contentIds(buildFeedQueue(pool, { seed: 99, today: TODAY }));
    for (let i = 0; i < ids.length; i++) {
      const window = ids.slice(Math.max(0, i - 20), i);
      expect(window).not.toContain(ids[i]);
    }
  });

  it("relaxes the window for small pools and never dead-ends", () => {
    const pool = [feedCard("x1", "alpha"), feedCard("x2", "alpha"), feedCard("y1", "beta")];
    const ids = contentIds(buildFeedQueue(pool, { seed: 3, today: TODAY }));
    expect(ids.length).toBe(3);
    expect(new Set(ids)).toEqual(new Set(["x1", "x2", "y1"]));
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });

  it("never shows 3 consecutive same-category cards", () => {
    const pool = [
      ...range(24).map((i) => feedCard(`x${i}`, "vocabulary")),
      ...range(6).map((i) => feedCard(`y${i}`, "history")),
    ];
    const categoryOf = new Map(pool.map((c) => [c.id, c.category]));
    const cats = contentIds(buildFeedQueue(pool, { seed: 5, today: TODAY })).map(
      (id) => categoryOf.get(id) as string,
    );
    for (let i = 2; i < cats.length; i++)
      expect(cats[i] === cats[i - 1] && cats[i - 1] === cats[i - 2]).toBe(false);
  });

  it("allows consecutive cards when only one category exists", () => {
    const pool = range(4).map((i) => feedCard(`v${i}`, "vocabulary"));
    const ids = contentIds(buildFeedQueue(pool, { seed: 1, today: TODAY }));
    expect(ids.length).toBe(4);
  });

  it("ends the pass with the recap sentinel derived from the seed", () => {
    const pool = range(4).map((i) => feedCard(`v${i}`, "vocabulary"));
    const zero = buildFeedQueue(pool, { seed: 0, today: TODAY });
    expect(zero.at(-1)).toEqual({ cardId: "recap:0", reversed: false });
    const five = buildFeedQueue(pool, { seed: 5, today: TODAY });
    expect(five.at(-1)).toEqual({ cardId: "recap:5", reversed: false });
    expect(zero.every((e) => e.reversed === false)).toBe(true);
  });

  it("a continuation pass respects the previous pass's tail via exclude", () => {
    const pool = range(30).map((i) => feedCard(`v${i}`, "vocabulary"));
    const excluded = range(5).map((i) => `v${i}`);
    const ids = contentIds(buildFeedQueue(pool, { seed: 11, today: TODAY, exclude: excluded }));
    const firstWindow = ids.slice(0, 20);
    for (const id of excluded) expect(firstWindow).not.toContain(id);
    expect(new Set(ids)).toEqual(new Set(pool.map((c) => c.id)));
  });
});
