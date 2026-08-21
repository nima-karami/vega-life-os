import type { Card, CardPrefs } from "@vega/shared";
import { buildFeedPool } from "../feed-pool";
import {
  buildFeedQueue,
  computePassSeed,
  FAILED_REAPPEAR_LIMIT,
  FAILED_REAPPEAR_OFFSET,
  isRecapId,
  NO_REPEAT_WINDOW,
  type QueueEntry,
} from "../queue";

/** A queue entry stamped with the pass that built it, so a React key survives an edit to the tail. */
export type DeckEntry = QueueEntry & { passIndex: number };

/**
 * The planned session. Materialised once and thereafter only appended to, pruned, or
 * relocated: grading a card must never re-derive what is already planned ahead of the user.
 */
export type DeckPlan = {
  entries: DeckEntry[];
  passCount: number;
  reappears: Record<string, number>;
};

export type DeckSource = { cards: Card[]; prefs: CardPrefs; today: string; baseSeed: number };

export const EMPTY_DECK: DeckPlan = { entries: [], passCount: 0, reappears: {} };

/** The feed's own deck, minus the trailing recap entry — BrainWrite is a card and nothing else. */
export function buildBrainWriteQueue(
  cards: Card[],
  prefs: CardPrefs,
  today: string,
  options: { seed: number; exclude?: string[] },
): QueueEntry[] {
  const entries = buildFeedQueue(buildFeedPool(cards, prefs, today), {
    seed: options.seed,
    today,
    exclude: options.exclude,
  });
  return entries.filter((entry) => !isRecapId(entry.cardId));
}

function buildPass(source: DeckSource, passIndex: number, exclude: string[]): DeckEntry[] {
  return buildBrainWriteQueue(source.cards, source.prefs, source.today, {
    seed: computePassSeed(source.baseSeed, passIndex),
    exclude,
  }).map((entry) => ({ ...entry, passIndex }));
}

export function planDeck(source: DeckSource): DeckPlan {
  return { entries: buildPass(source, 0, []), passCount: 1, reappears: {} };
}

// Crossing into a new pass clears each card's reappearance count — the cap belongs to the
// pass just finished, not to the whole session.
export function extendDeck(plan: DeckPlan, source: DeckSource): DeckPlan {
  const exclude = plan.entries.slice(-NO_REPEAT_WINDOW).map((entry) => entry.cardId);
  return {
    entries: [...plan.entries, ...buildPass(source, plan.passCount, exclude)],
    passCount: plan.passCount + 1,
    reappears: {},
  };
}

/**
 * The one sanctioned repeat. A wrong grade pulls the card's next scheduled appearance forward
 * to the designed offset rather than adding a second one, so failing a card can never put it
 * twice inside the no-repeat window.
 */
export function relocateFailedCard(plan: DeckPlan, cardId: string, currentIndex: number): DeckPlan {
  const reappearCount = plan.reappears[cardId] ?? 0;
  if (reappearCount >= FAILED_REAPPEAR_LIMIT) return plan;
  const target = currentIndex + FAILED_REAPPEAR_OFFSET;
  const scheduledAt = plan.entries.findIndex(
    (entry, index) => index > currentIndex && entry.cardId === cardId,
  );
  if (scheduledAt !== -1 && scheduledAt <= target) return plan;
  const entries = [...plan.entries];
  const [moved] = scheduledAt === -1 ? [] : entries.splice(scheduledAt, 1);
  const returning = moved ?? { cardId, passIndex: Math.max(plan.passCount - 1, 0) };
  entries.splice(Math.min(target, entries.length), 0, returning);
  return { ...plan, entries, reappears: { ...plan.reappears, [cardId]: reappearCount + 1 } };
}

/** A card that leaves the pool mid-session would render as an empty slot: drop what is still ahead. */
export function prunePlannedEntries(
  plan: DeckPlan,
  liveIds: Set<string>,
  currentIndex: number,
): DeckPlan {
  const entries = plan.entries.filter(
    (entry, index) => index <= currentIndex || liveIds.has(entry.cardId),
  );
  return entries.length === plan.entries.length ? plan : { ...plan, entries };
}
