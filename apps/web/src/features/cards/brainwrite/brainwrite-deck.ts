import type { Card, CardPrefs } from "@vega/shared";
import { buildFeedPool } from "../feed-pool";
import { buildFeedQueue, isRecapId, type QueueEntry } from "../queue";

/** The feed's own deck, minus the trailing recap entry — BrainWrite is a card and nothing else. */
export function buildBrainWriteQueue(
  cards: Card[],
  prefs: CardPrefs,
  today: string,
  options: {
    seed: number;
    exclude?: string[];
    reinsert?: { cardId: string; offset: number } | null;
  },
): QueueEntry[] {
  const entries = buildFeedQueue(buildFeedPool(cards, prefs, today), {
    seed: options.seed,
    today,
    exclude: options.exclude,
    reinsert: options.reinsert,
  });
  return entries.filter((entry) => !isRecapId(entry.cardId));
}
