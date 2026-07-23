import type { FeedCard } from "./feed-cards";

export type QueueEntry = { cardId: string; reversed: boolean };

export type QueueOptions = {
  seed: number;
  today: string;
  noRepeatWindow?: number;
  shareCap?: number;
  exclude?: string[];
};

const NO_REPEAT_WINDOW = 20;
const CATEGORY_SHARE_CAP = 0.3;

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

const categoryKey = (category: string): string => category.trim().toLowerCase();

function groupByCategory(pool: FeedCard[]): Map<string, FeedCard[]> {
  const groups = new Map<string, FeedCard[]>();
  for (const card of pool) {
    const key = categoryKey(card.category);
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
  const key = categoryKey(candidate.category);
  return (
    categoryKey(placed[placed.length - 1].category) === key &&
    categoryKey(placed[placed.length - 2].category) === key
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
  const key = categoryKey(card.category);
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

export function buildFeedQueue(pool: FeedCard[], opts: QueueOptions): QueueEntry[] {
  const {
    seed,
    noRepeatWindow = NO_REPEAT_WINDOW,
    shareCap = CATEGORY_SHARE_CAP,
    exclude = [],
  } = opts;
  const rng = createSeededRng(seed);
  const groups = groupByCategory(pool);
  const counts = new Map([...groups].map(([key, cards]) => [key, cards.length]));
  const ctx: PassContext = {
    placed: [],
    placedPerCategory: new Map(),
    categoryCount: groups.size,
    categoryCap: groups.size >= 4 ? Math.ceil(shareCap * pool.length) : Number.POSITIVE_INFINITY,
    excludeSet: new Set(exclude),
    excludeWindow: Math.min(noRepeatWindow, Math.max(1, pool.length - 1)),
  };
  const weightOf = (card: FeedCard): number => 1 / (counts.get(categoryKey(card.category)) ?? 1);
  const remaining = [...pool];

  while (remaining.length > 0) {
    const candidates = selectCandidates(remaining, ctx.placed.length, ctx);
    if (candidates.length === 0) break;
    const chosen = pickWeighted(candidates, weightOf, rng);
    remaining.splice(remaining.indexOf(chosen), 1);
    ctx.placed.push(chosen);
    const key = categoryKey(chosen.category);
    ctx.placedPerCategory.set(key, (ctx.placedPerCategory.get(key) ?? 0) + 1);
  }

  const entries: QueueEntry[] = ctx.placed.map((card) => ({ cardId: card.id, reversed: false }));
  entries.push({ cardId: `recap:${seed}`, reversed: false });
  return entries;
}
