import type { FeedCard } from "./feed-cards";
import { matchKey } from "./model";

export type QueueEntry = { cardId: string; reversed: boolean };

export type QueueOptions = {
  seed: number;
  today: string;
  exclude?: string[];
};

const NO_REPEAT_WINDOW = 20;
const CATEGORY_SHARE_CAP = 0.3;
const DUE_EVERY = 4;
const REVERSED_SHARE = 1 / 3;
const LIKED_BOOST = 1.5;
const RECAP_PREFIX = "recap:";

export const isRecapId = (cardId: string): boolean => cardId.startsWith(RECAP_PREFIX);

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

function groupByCategory(pool: FeedCard[]): Map<string, FeedCard[]> {
  const groups = new Map<string, FeedCard[]>();
  for (const card of pool) {
    const key = matchKey(card.category);
    const group = groups.get(key);
    if (group) group.push(card);
    else groups.set(key, [card]);
  }
  return groups;
}

function violatesInterleave(
  placed: FeedCard[],
  candidate: FeedCard,
  categoryCount: number,
): boolean {
  if (categoryCount < 2 || placed.length < 2) return false;
  const key = matchKey(candidate.category);
  return (
    matchKey(placed[placed.length - 1].category) === key &&
    matchKey(placed[placed.length - 2].category) === key
  );
}

function pickWeighted(
  candidates: FeedCard[],
  weightOf: (card: FeedCard) => number,
  rng: () => number,
): FeedCard {
  const total = candidates.reduce((sum, card) => sum + weightOf(card), 0);
  let threshold = rng() * total;
  for (const card of candidates) {
    threshold -= weightOf(card);
    if (threshold < 0) return card;
  }
  return candidates[candidates.length - 1];
}

type PassContext = {
  placed: FeedCard[];
  placedPerCategory: Map<string, number>;
  categoryCount: number;
  categoryCap: number;
  excludeSet: Set<string>;
  excludeWindow: number;
};

function isPlaceable(
  card: FeedCard,
  position: number,
  applyExclude: boolean,
  ctx: PassContext,
): boolean {
  const key = matchKey(card.category);
  if ((ctx.placedPerCategory.get(key) ?? 0) >= ctx.categoryCap) return false;
  if (violatesInterleave(ctx.placed, card, ctx.categoryCount)) return false;
  if (applyExclude && position < ctx.excludeWindow && ctx.excludeSet.has(card.id)) return false;
  return true;
}

// exclude is a soft preference: honour it unless doing so leaves nothing to place.
function selectCandidates(remaining: FeedCard[], position: number, ctx: PassContext): FeedCard[] {
  const strict = remaining.filter((card) => isPlaceable(card, position, true, ctx));
  if (strict.length > 0) return strict;
  return remaining.filter((card) => isPlaceable(card, position, false, ctx));
}

export const isDueLearning = (card: FeedCard): boolean => card.due && card.learning;

const isReversibleLearning = (card: FeedCard): boolean =>
  card.learning && card.box !== null && card.box >= 2;

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function placeCard(card: FeedCard, ctx: PassContext): void {
  ctx.placed.push(card);
  const key = matchKey(card.category);
  ctx.placedPerCategory.set(key, (ctx.placedPerCategory.get(key) ?? 0) + 1);
}

type PassPools = { dueQueue: FeedCard[]; restRemaining: FeedCard[] };

function sampleRest(
  pools: PassPools,
  position: number,
  ctx: PassContext,
  weightOf: (card: FeedCard) => number,
  rng: () => number,
): FeedCard | null {
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
  weightOf: (card: FeedCard) => number,
  rng: () => number,
): FeedCard | null {
  const isDueSlot = (position + 1) % dueEvery === 0;
  if (isDueSlot && pools.dueQueue.length > 0) return pools.dueQueue.shift() ?? null;
  return sampleRest(pools, position, ctx, weightOf, rng) ?? pools.dueQueue.shift() ?? null;
}

export function buildFeedQueue(pool: FeedCard[], options: QueueOptions): QueueEntry[] {
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
  const weightOf = (card: FeedCard): number =>
    (card.liked ? LIKED_BOOST : 1) / (counts.get(matchKey(card.category)) ?? 1);
  const pools: PassPools = {
    dueQueue: shuffleWithRng(pool.filter(isDueLearning), rng),
    restRemaining: pool.filter((card) => !isDueLearning(card)),
  };

  while (pools.dueQueue.length > 0 || pools.restRemaining.length > 0) {
    const chosen = chooseNextCard(pools, ctx.placed.length, DUE_EVERY, ctx, weightOf, rng);
    if (!chosen) break;
    placeCard(chosen, ctx);
  }

  const entries: QueueEntry[] = ctx.placed.map((card) => ({
    cardId: card.id,
    reversed: isReversibleLearning(card) ? rng() < REVERSED_SHARE : false,
  }));
  entries.push({ cardId: `${RECAP_PREFIX}${seed}`, reversed: false });
  return entries;
}
