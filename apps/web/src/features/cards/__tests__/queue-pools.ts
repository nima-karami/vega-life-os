import type { Card } from "@vega/shared";
import { createSeededRng } from "../queue";
import { buildCard } from "./fixtures";

export const POOL_TODAY = "2026-07-23";

export type PoolShape = {
  size: number;
  seed: number;
  categories: readonly string[];
  /** Relative odds per category, same order; uniform when omitted. */
  skew?: readonly number[];
  dueShare?: number;
  likedShare?: number;
};

function pickCategory(shape: PoolShape, roll: number): string {
  const odds = shape.skew ?? shape.categories.map(() => 1);
  const total = odds.reduce((sum, odd) => sum + odd, 0);
  let threshold = roll * total;
  for (let index = 0; index < odds.length; index++) {
    threshold -= odds[index];
    if (threshold < 0) return shape.categories[index];
  }
  return shape.categories[shape.categories.length - 1];
}

/** A deterministic synthetic pool: mixed categories, a due backlog, liked and resting cards. */
export function buildSyntheticPool(shape: PoolShape): Card[] {
  const rng = createSeededRng(shape.seed);
  return Array.from({ length: shape.size }, (_, index) => {
    const category = pickCategory(shape, rng());
    const isDue = rng() < (shape.dueShare ?? 0.25);
    const isResting = !isDue && rng() < 0.15;
    const box = isDue || isResting ? 1 + Math.floor(rng() * 5) : null;
    return buildCard({
      id: `p${index}`,
      category,
      title: `Card ${index}`,
      likedAt: rng() < (shape.likedShare ?? 0.15) ? "2026-07-01T00:00:00.000Z" : null,
      box,
      nextDue: isDue
        ? `2026-07-${String(10 + Math.floor(rng() * 14)).padStart(2, "0")}`
        : isResting
          ? "2026-09-01"
          : null,
      lastReviewed: box === null ? null : "2026-07-01",
    });
  });
}

/** FNV-1a over the joined ids — pins a long sequence without a page of literals. */
export function hashSequence(ids: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const char of ids.join(",")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${ids.length}:${hash.toString(16).padStart(8, "0")}`;
}
