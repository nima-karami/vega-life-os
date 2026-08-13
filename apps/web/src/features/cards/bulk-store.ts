import { type Card, isLearnable } from "@vega/shared";
import type { Dataset } from "@/core/persistence";
import { saveBulkPut, saveBulkRemove, type WriteRollback } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";

export interface CardsBulkResult {
  /** what every touched row looked like before the action — the undo bar's payload */
  priorCards: Card[];
  /** rows the backend rejected, in order */
  failedIds: string[];
  /** rows the invariant refused to write, in order — never silently dropped */
  skippedIds: string[];
}

export interface CardsBulkSlice {
  patchCards: (ids: string[], patch: Partial<Card>) => Promise<CardsBulkResult>;
  deleteCards: (ids: string[]) => Promise<CardsBulkResult>;
  restoreCards: (cards: Card[]) => Promise<CardsBulkResult>;
}

const EMPTY_RESULT: CardsBulkResult = { priorCards: [], failedIds: [], skippedIds: [] };

/** The same clearing updateCard applies — a row that cannot be learned holds no schedule. */
const normalizeLearning = (card: Card): Card =>
  isLearnable(card) ? card : { ...card, box: null, nextDue: null, lastReviewed: null };

const selectCards = (cards: Card[], ids: string[]): Card[] => {
  const byId = new Map(cards.map((card) => [card.id, card]));
  return ids.flatMap((id) => {
    const card = byId.get(id);
    return card ? [card] : [];
  });
};

const mergeById = (existing: Card[], incoming: Card[]): Card[] => {
  const incomingById = new Map(incoming.map((card) => [card.id, card]));
  const existingIds = new Set(existing.map((card) => card.id));
  return [
    ...existing.map((card) => incomingById.get(card.id) ?? card),
    ...incoming.filter((card) => !existingIds.has(card.id)),
  ];
};

export const createCardsBulkSlice: Slice<CardsBulkSlice> = (set, get) => {
  const commitRows = async (
    next: Card[],
    rollbacks: WriteRollback<"cards">[],
  ): Promise<string[]> => {
    set({ cards: mergeById(get().cards, next) });
    const outcome = await saveBulkPut("cards", next as Dataset["cards"], rollbacks);
    return next.slice(outcome.landedRows).map((card) => card.id);
  };

  return {
    patchCards: async (ids, patch) => {
      const targets = selectCards(get().cards, ids);
      if (targets.length === 0) return EMPTY_RESULT;

      const startsLearning = patch.box !== undefined && patch.box !== null;
      const skippedIds = startsLearning
        ? targets.filter((card) => !isLearnable({ ...card, ...patch })).map((card) => card.id)
        : [];
      const skipped = new Set(skippedIds);
      const priorCards = targets.filter((card) => !skipped.has(card.id));
      if (priorCards.length === 0) return { priorCards: [], failedIds: [], skippedIds };

      const next = priorCards.map((card) => normalizeLearning({ ...card, ...patch, id: card.id }));
      const failedIds = await commitRows(
        next,
        priorCards.map((prior) => ({ kind: "update", prior })),
      );
      return { priorCards, failedIds, skippedIds };
    },

    deleteCards: async (ids) => {
      const priorCards = selectCards(get().cards, ids);
      if (priorCards.length === 0) return EMPTY_RESULT;
      const doomed = new Set(priorCards.map((card) => card.id));
      set({ cards: get().cards.filter((card) => !doomed.has(card.id)) });
      const outcome = await saveBulkRemove(
        "cards",
        priorCards.map((card) => card.id),
        priorCards,
      );
      return {
        priorCards,
        failedIds: priorCards.slice(outcome.landedRows).map((card) => card.id),
        skippedIds: [],
      };
    },

    restoreCards: async (cards) => {
      if (cards.length === 0) return EMPTY_RESULT;
      const failedIds = await commitRows(
        cards,
        cards.map(() => ({ kind: "insert" as const })),
      );
      return { priorCards: cards, failedIds, skippedIds: [] };
    },
  };
};
