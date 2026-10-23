import type { Card } from "@vega/shared";
import { matchKey } from "./model";
import { createRestLane, type RestFilter, type RestLane, type RestLaneCard } from "./rest-lane";

export type QueueEntry = { cardId: string };

export type QueueOptions = {
  seed: number;
  today: string;
  exclude?: string[];
};

export const NO_REPEAT_WINDOW = 20;
const CATEGORY_SHARE_CAP = 0.3;
const REST_EVERY = 3;
const LIKED_BOOST = 1.5;
const RECAP_PREFIX = "recap:";
export const REVIEW_SET_LIMIT = 20;
export const FAILED_REAPPEAR_OFFSET = 5;
export const FAILED_REAPPEAR_LIMIT = 3;
const NO_CATEGORY = -1;

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

export const isDueLearning = (card: Card, today: string): boolean =>
  card.box !== null && card.nextDue !== null && card.nextDue <= today;

// Solidify what's nearly known before drilling something new: rank the due backlog
// highest box first, cap it to a bounded working set so a large backlog gets worked in a
// stable rotation instead of a fresh random sample every pass.
export function selectReviewSet(pool: Card[], today: string): Card[] {
  return pool
    .filter((card) => isDueLearning(card, today))
    .sort((a, b) => (b.box ?? 0) - (a.box ?? 0) || (a.nextDue ?? "").localeCompare(b.nextDue ?? ""))
    .slice(0, REVIEW_SET_LIMIT);
}

type Relaxation = "none" | "exclude" | "interleave";

/**
 * Give the shaping constraints up in turn — the exclusion first, then the interleave guard —
 * so a single-category pool still drains instead of dead-ending and losing its tail. The
 * share cap is deliberately not in that ladder: normalising a lopsided deck means leaving its
 * tail for the next pass, not printing it anyway. A due card is a review obligation, not feed
 * shaping, so neither the cap nor the interleave guard may be the reason one goes unseen.
 */
const RELAXATIONS: readonly Relaxation[] = ["none", "exclude", "interleave"];

type PassState = {
  rng: () => number;
  position: number;
  lastCategory: number;
  previousCategory: number;
  placedPerCategory: Int32Array;
  categoryCount: number;
  categoryCap: number;
  categoryOf: Map<string, number>;
  excludeSet: Set<string>;
  excludeWindow: number;
  dueQueue: Card[];
  rest: RestLane;
};

const isExcludedAt = (card: Card, state: PassState): boolean =>
  state.position < state.excludeWindow && state.excludeSet.has(card.id);

function findInterleaveBlock(state: PassState): number {
  if (state.categoryCount < 2 || state.position < 2) return NO_CATEGORY;
  return state.lastCategory === state.previousCategory ? state.lastCategory : NO_CATEGORY;
}

function buildRestFilter(relaxation: Relaxation, state: PassState): RestFilter {
  return {
    blockedCategory: relaxation === "interleave" ? NO_CATEGORY : findInterleaveBlock(state),
    isExcludeActive: relaxation === "none" && state.position < state.excludeWindow,
  };
}

function sampleRest(state: PassState): Card | null {
  for (const relaxation of RELAXATIONS) {
    const filter = buildRestFilter(relaxation, state);
    if (state.rest.countCandidates(filter) === 0) continue;
    return state.rest.takeCard(state.rest.pickWeighted(filter, state.rng()));
  }
  return null;
}

function takeDue(state: PassState): Card | null {
  const index = state.dueQueue.findIndex((card) => !isExcludedAt(card, state));
  return index === -1 ? null : state.dueQueue.splice(index, 1)[0];
}

// Rest lands only on every REST_EVERY-th slot; the review set takes the other slots while any
// remain, falling back to rest once it is drained. Both lanes honour the exclude window; the
// share cap and the interleave guard shape the rest lane only. The trailing `shift` is the
// last resort that keeps a pool smaller than its own window from dead-ending.
function chooseNextCard(state: PassState): Card | null {
  const isRestSlot = (state.position + 1) % REST_EVERY === 0;
  const chosen = isRestSlot
    ? (sampleRest(state) ?? takeDue(state))
    : (takeDue(state) ?? sampleRest(state));
  return chosen ?? state.dueQueue.shift() ?? null;
}

function placeCard(card: Card, state: PassState): void {
  const category = state.categoryOf.get(card.category) ?? NO_CATEGORY;
  state.position += 1;
  state.previousCategory = state.lastCategory;
  state.lastCategory = category;
  state.placedPerCategory[category] += 1;
  if (state.placedPerCategory[category] >= state.categoryCap) state.rest.capCategory(category);
}

// Keyed by the raw label so matchKey runs once per distinct spelling, not once per card.
function indexCategories(pool: Card[]): { categoryOf: Map<string, number>; sizes: number[] } {
  const indexByKey = new Map<string, number>();
  const categoryOf = new Map<string, number>();
  const sizes: number[] = [];
  for (const card of pool) {
    let index = categoryOf.get(card.category);
    if (index === undefined) {
      const key = matchKey(card.category);
      index = indexByKey.get(key) ?? sizes.length;
      if (index === sizes.length) {
        indexByKey.set(key, index);
        sizes.push(0);
      }
      categoryOf.set(card.category, index);
    }
    sizes[index] += 1;
  }
  return { categoryOf, sizes };
}

function createPassState(pool: Card[], options: QueueOptions): PassState {
  const { categoryOf, sizes } = indexCategories(pool);
  const reviewSet = selectReviewSet(pool, options.today);
  const reviewIds = new Set(reviewSet.map((card) => card.id));
  const excludeSet = new Set(options.exclude ?? []);
  // The review-set limit paces the due lane; it must not strand the backlog behind it, so
  // a due card ranked past the limit stays eligible in the rest lane.
  const restCards: RestLaneCard[] = pool
    .filter((card) => !reviewIds.has(card.id))
    .map((card) => {
      const categoryIndex = categoryOf.get(card.category) ?? 0;
      return {
        card,
        categoryIndex,
        weight: (card.likedAt !== null ? LIKED_BOOST : 1) / sizes[categoryIndex],
        isDue: isDueLearning(card, options.today),
      };
    });
  return {
    rng: createSeededRng(options.seed),
    position: 0,
    lastCategory: NO_CATEGORY,
    previousCategory: NO_CATEGORY,
    placedPerCategory: new Int32Array(sizes.length),
    categoryCount: sizes.length,
    categoryCap:
      sizes.length >= 4 ? Math.ceil(CATEGORY_SHARE_CAP * pool.length) : Number.POSITIVE_INFINITY,
    categoryOf,
    excludeSet,
    excludeWindow: Math.min(NO_REPEAT_WINDOW, Math.max(1, pool.length - 1)),
    dueQueue: reviewSet,
    rest: createRestLane(restCards, excludeSet, sizes.length),
  };
}

/** Reads one pass in order, a chunk at a time; each chunk is planned once and kept. */
export type PassReader = (chunkIndex: number) => QueueEntry[];

/**
 * One pass over the pool, planned lazily: the order is exactly what a whole pass would be,
 * but only the chunks asked for are ever computed.
 */
export function createPassReader(
  pool: Card[],
  options: QueueOptions,
  chunkSize: number,
): PassReader {
  const state = createPassState(pool, options);
  const chunks: QueueEntry[][] = [];
  let isDrained = false;

  const planChunk = (): QueueEntry[] => {
    const chunk: QueueEntry[] = [];
    while (!isDrained && chunk.length < chunkSize) {
      const chosen =
        state.dueQueue.length > 0 || state.rest.hasRemaining() ? chooseNextCard(state) : null;
      if (!chosen) {
        isDrained = true;
        break;
      }
      placeCard(chosen, state);
      chunk.push({ cardId: chosen.id });
    }
    return chunk;
  };

  return (chunkIndex) => {
    while (chunks.length <= chunkIndex) chunks.push(planChunk());
    return chunks[chunkIndex];
  };
}

export function buildFeedQueue(pool: Card[], options: QueueOptions): QueueEntry[] {
  const readPass = createPassReader(pool, options, Math.max(1, pool.length));
  const entries = [...readPass(0)];
  entries.push({ cardId: `${RECAP_PREFIX}${options.seed}` });
  return entries;
}
