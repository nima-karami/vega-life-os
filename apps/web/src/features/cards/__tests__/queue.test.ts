import type { Card } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { buildFeedQueue, computePassSeed, createSeededRng, isDueLearning } from "../queue";
import { buildCard } from "./fixtures";

const TODAY = "2026-07-23";

const feedCard = (id: string, category: string): Card =>
  buildCard({ id, category, title: id, body: `body ${id}` });

const dueCard = (id: string): Card =>
  buildCard({
    id,
    category: "vocabulary",
    title: id,
    body: `body ${id}`,
    box: 3,
    nextDue: TODAY,
    lastReviewed: "2026-07-15",
  });

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

const contentIds = (queue: { cardId: string }[]): string[] =>
  queue.filter((e) => !e.cardId.startsWith("recap:")).map((e) => e.cardId);

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

describe("isDueLearning", () => {
  it("is true only for a learning card whose next due date has arrived", () => {
    expect(isDueLearning(dueCard("d"), TODAY)).toBe(true);
    expect(isDueLearning(buildCard({ box: 2, nextDue: "2026-08-30" }), TODAY)).toBe(false);
    expect(isDueLearning(buildCard({ box: null, nextDue: TODAY }), TODAY)).toBe(false);
    expect(isDueLearning(buildCard({ box: 2, nextDue: null }), TODAY)).toBe(false);
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
    expect(buildFeedQueue(pool, { seed: 43, today: TODAY })).not.toEqual(first);
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
    const cap = Math.ceil(0.3 * pool.length);
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

  it("shrinks the window to a single-card pool instead of deadlocking", () => {
    const pool = [feedCard("only", "alpha")];
    for (const seed of range(5)) {
      const queue = buildFeedQueue(pool, { seed, today: TODAY, exclude: ["only"] });
      expect(contentIds(queue)).toEqual(["only"]);
      expect(queue.at(-1)).toEqual({ cardId: `recap:${seed}` });
    }
  });

  // The guard is shaping, not an invariant that may cost a card: 24 of one category against
  // 6 of another cannot be ordered without a run of three, and dropping the remainder from
  // the user's own feed is the worse failure. So it holds while an alternative exists.
  it("never shows 3 consecutive same-category cards while another category has cards left", () => {
    const pool = [
      ...range(24).map((i) => feedCard(`x${i}`, "vocabulary")),
      ...range(6).map((i) => feedCard(`y${i}`, "history")),
    ];
    const categoryOf = new Map(pool.map((c) => [c.id, c.category]));
    const ids = contentIds(buildFeedQueue(pool, { seed: 5, today: TODAY }));
    expect(new Set(ids), "every card is placed").toEqual(new Set(pool.map((c) => c.id)));

    const cats = ids.map((id) => categoryOf.get(id) as string);
    const remaining = new Map<string, number>();
    for (const cat of cats) remaining.set(cat, (remaining.get(cat) ?? 0) + 1);

    for (let i = 0; i < cats.length; i++) {
      const cat = cats[i];
      remaining.set(cat, (remaining.get(cat) ?? 0) - 1);
      if (i < 2) continue;
      const hasAlternative = [...remaining].some(([key, left]) => key !== cat && left > 0);
      if (cats[i] === cats[i - 1] && cats[i - 1] === cats[i - 2]) {
        expect(hasAlternative, `run of three at ${i} while another category had cards`).toBe(false);
      }
    }
  });

  it("allows consecutive cards when only one category exists", () => {
    const pool = range(4).map((i) => feedCard(`v${i}`, "vocabulary"));
    expect(contentIds(buildFeedQueue(pool, { seed: 1, today: TODAY })).length).toBe(4);
  });

  it("groups categories case-insensitively on the trimmed string", () => {
    const pool = [
      feedCard("a", "Mental models"),
      feedCard("b", " mental models "),
      feedCard("c", "MENTAL MODELS"),
      feedCard("d", "History"),
    ];
    const ids = contentIds(buildFeedQueue(pool, { seed: 4, today: TODAY }));
    expect(new Set(ids)).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("ends the pass with the recap sentinel derived from the seed", () => {
    const pool = range(4).map((i) => feedCard(`v${i}`, "vocabulary"));
    expect(buildFeedQueue(pool, { seed: 0, today: TODAY }).at(-1)).toEqual({ cardId: "recap:0" });
    expect(buildFeedQueue(pool, { seed: 5, today: TODAY }).at(-1)).toEqual({ cardId: "recap:5" });
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

const restCategories = ["alpha", "beta", "gamma", "delta"];

describe("SRS due-injection lane", () => {
  it("injects due cards at most every 4th position and exhausts leftovers gracefully", () => {
    const pool = [
      ...range(40).map((i) => dueCard(`due${i}`)),
      ...range(20).map((i) => feedCard(`r${i}`, restCategories[i % restCategories.length])),
    ];
    const dueIds = new Set(pool.filter((c) => isDueLearning(c, TODAY)).map((c) => c.id));
    const ids = contentIds(buildFeedQueue(pool, { seed: 7, today: TODAY }));

    expect(new Set(ids)).toEqual(new Set(pool.map((c) => c.id)));
    expect(ids.length).toBe(pool.length);

    const first20 = ids.slice(0, 20);
    expect(first20.filter((id) => dueIds.has(id)).length).toBeLessThanOrEqual(5);
    expect(first20.filter((id) => !dueIds.has(id)).length).toBeGreaterThanOrEqual(15);
  });

  it("falls back to shuffle when nothing is due", () => {
    const pool = range(20).map((i) => feedCard(`r${i}`, restCategories[i % restCategories.length]));
    const first = buildFeedQueue(pool, { seed: 5, today: TODAY });
    expect(first).toEqual(buildFeedQueue(pool, { seed: 5, today: TODAY }));
    expect(new Set(contentIds(first))).toEqual(new Set(pool.map((c) => c.id)));
  });

  it("treats a card as due only against the day it is asked about", () => {
    const pool = [dueCard("d0"), ...range(8).map((i) => feedCard(`r${i}`, "alpha"))];
    const before = buildFeedQueue(pool, { seed: 2, today: "2026-07-01" });
    const after = buildFeedQueue(pool, { seed: 2, today: TODAY });
    expect(new Set(contentIds(before))).toEqual(new Set(contentIds(after)));
    expect(before).not.toEqual(after);
  });
});

describe("liked-card weight boost", () => {
  it("boosts liked cards in the shuffle without letting them dominate", () => {
    const pool = [
      buildCard({
        id: "liked",
        title: "liked",
        category: "thinking",
        likedAt: "2026-07-01T00:00:00.000Z",
      }),
      feedCard("plain", "decisions"),
    ];
    let likedFirst = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const [first] = buildFeedQueue(pool, { seed, today: TODAY });
      if (first.cardId === "liked") likedFirst++;
    }
    expect(likedFirst).toBeGreaterThan(550);
    expect(likedFirst).toBeLessThan(650);
  });
});

describe("pass seeds", () => {
  it("increment by exactly 1 — the no-repeat rotation depends on it", () => {
    expect(computePassSeed(100, 0)).toBe(100);
    for (const passIndex of range(5))
      expect(computePassSeed(100, passIndex + 1)).toBe(computePassSeed(100, passIndex) + 1);
  });
});
