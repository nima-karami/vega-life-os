import type { Card } from "@vega/shared";
import { matchKey } from "./model";

export type QueueEntry = { cardId: string };

export type QueueOptions = {
  seed: number;
  today: string;
  exclude?: string[];
};

const NO_REPEAT_WINDOW = 20;
const CATEGORY_SHARE_CAP = 0.3;
const DUE_EVERY = 4;
const LIKED_BOOST = 1.5;
const RECAP_PREFIX = "recap:";

export const isRecapId = (cardId: string): boolean => cardId.startsWith(RECAP_PREFIX);

export const computePassSeed = (baseSeed: number, passIndex: number): number =>
  baseSeed + passIndex;

export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function groupByCategory(pool: Card[]): Map<string, Card[]> {
  const groups = new Map<string, Card[]>();
  for (const card of pool) {
    const key = matchKey(card.category);
    const group = groups.get(key);
    if (group) group.push(card);
    else groups.set(key, [card]);
  }
  return groups;
}

function violatesInterleave(placed: Card[], candidate: Card, categoryCount: number): boolean {
  if (categoryCount < 2 || placed.length < 2) return false;
  const key = matchKey(candidate.category);
  return (
    matchKey(placed[placed.length - 1].category) === key &&
    matchKey(placed[placed.length - 2].category) === key
  );
}

function pickWeighted(
  candidates: Card[],
  weightOf: (card: Card) => number,
  rng: () => number,
): Card {
  const total = candidates.reduce((sum, card) => sum + weightOf(card), 0);
  let threshold = rng() * total;
  for (const card of candidates) {
    threshold -= weightOf(card);
    if (threshold < 0) return card;
  }
  return candidates[candidates.length - 1];
}

type PassContext = {
  placed: Card[];
  placedPerCategory: Map<string, number>;
  categoryCount: number;
  categoryCap: number;
  excludeSet: Set<string>;
  excludeWindow: number;
};

type Relaxation = "none" | "exclude" | "interleave" | "cap";

// The share cap is the one constraint that may cost a card: normalising a lopsided deck
// means leaving its tail for the next pass, not printing it anyway.
const RELAXATIONS: readonly Relaxation[] = ["none", "exclude", "interleave"];

function isPlaceable(card: Card, position: number, relaxed: Relaxation, ctx: PassContext): boolean {
  const key = matchKey(card.category);
  if (relaxed !== "cap" && (ctx.placedPerCategory.get(key) ?? 0) >= ctx.categoryCap) return false;
  if (
    relaxed !== "cap" &&
    relaxed !== "interleave" &&
    violatesInterleave(ctx.placed, card, ctx.categoryCount)
  ) {
    return false;
  }
  if (relaxed === "none" && position < ctx.excludeWindow && ctx.excludeSet.has(card.id)) {
    return false;
  }
  return true;
}

/**
 * Give the shaping constraints up in turn — the exclusion first, then the interleave guard —
 * so a single-category pool still drains instead of dead-ending and losing its tail. The
 * share cap is deliberately not in that ladder; see RELAXATIONS.
 */
function selectCandidates(remaining: Card[], position: number, ctx: PassContext): Card[] {
  for (const relaxation of RELAXATIONS) {
    const candidates = remaining.filter((card) => isPlaceable(card, position, relaxation, ctx));
    if (candidates.length > 0) return candidates;
  }
  return [];
}

export const isDueLearning = (card: Card, today: string): boolean =>
  card.box !== null && card.nextDue !== null && card.nextDue <= today;

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function placeCard(card: Card, ctx: PassContext): void {
  ctx.placed.push(card);
  const key = matchKey(card.category);
  ctx.placedPerCategory.set(key, (ctx.placedPerCategory.get(key) ?? 0) + 1);
}

type PassPools = { dueQueue: Card[]; restRemaining: Card[] };

function sampleRest(
  pools: PassPools,
  position: number,
  ctx: PassContext,
  weightOf: (card: Card) => number,
  rng: () => number,
): Card | null {
  const candidates = selectCandidates(pools.restRemaining, position, ctx);
  if (candidates.length === 0) return null;
  const chosen = pickWeighted(candidates, weightOf, rng);
  pools.restRemaining.splice(pools.restRemaining.indexOf(chosen), 1);
  return chosen;
}

// Due cards land only on every `dueEvery`-th slot; a slot with no due card left (or a
// non-due slot the shuffle can't fill) falls back to the other pool, draining both.
function chooseNextCard(
  pools: PassPools,
  position: number,
  dueEvery: number,
  ctx: PassContext,
  weightOf: (card: Card) => number,
  rng: () => number,
): Card | null {
  const isDueSlot = (position + 1) % dueEvery === 0;
  if (isDueSlot && pools.dueQueue.length > 0) return pools.dueQueue.shift() ?? null;
  return sampleRest(pools, position, ctx, weightOf, rng) ?? pools.dueQueue.shift() ?? null;
}

export function buildFeedQueue(pool: Card[], options: QueueOptions): QueueEntry[] {
  const { seed, exclude = [] } = options;
  const rng = createSeededRng(seed);
  const groups = groupByCategory(pool);
  const counts = new Map([...groups].map(([key, cards]) => [key, cards.length]));
  const ctx: PassContext = {
    placed: [],
    placedPerCategory: new Map(),
    categoryCount: groups.size,
    categoryCap:
      groups.size >= 4 ? Math.ceil(CATEGORY_SHARE_CAP * pool.length) : Number.POSITIVE_INFINITY,
    excludeSet: new Set(exclude),
    excludeWindow: Math.min(NO_REPEAT_WINDOW, Math.max(1, pool.length - 1)),
  };
  const weightOf = (card: Card): number =>
    (card.likedAt !== null ? LIKED_BOOST : 1) / (counts.get(matchKey(card.category)) ?? 1);
  const pools: PassPools = {
    dueQueue: shuffleWithRng(
      pool.filter((card) => isDueLearning(card, options.today)),
      rng,
    ),
    restRemaining: pool.filter((card) => !isDueLearning(card, options.today)),
  };

  while (pools.dueQueue.length > 0 || pools.restRemaining.length > 0) {
    const chosen = chooseNextCard(pools, ctx.placed.length, DUE_EVERY, ctx, weightOf, rng);
    if (!chosen) break;
    placeCard(chosen, ctx);
  }

  const entries: QueueEntry[] = ctx.placed.map((card) => ({ cardId: card.id }));
  entries.push({ cardId: `${RECAP_PREFIX}${seed}` });
  return entries;
}
