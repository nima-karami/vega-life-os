import {
  CARD_TYPES,
  type Card,
  type CardCreate,
  type CardPrefs,
  canPromote,
  DEFAULT_CARD_PREFS,
  isLearnable,
  type MindCard,
  type MindMetaRecord,
  type SlotId,
} from "@vega/shared";
import { todayISO } from "@/core/lib/date";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import { stepLeitner } from "./leitner";
import { normalizeCategory } from "./model";

export interface CardsSlice {
  cards: Card[];
  cardPrefs: CardPrefs;
  addCard: (input: CardCreate) => Card;
  updateCard: (id: string, patch: Partial<Card>) => void;
  removeCard: (id: string) => void;
  restoreCard: (card: Card) => void;
  hideCard: (id: string) => void;
  toggleCardLike: (id: string) => void;
  setCardLearning: (id: string, learning: boolean) => void;
  promoteCard: (id: string) => void;
  gradeCard: (id: string, correct: boolean) => void;
  setCardPrefs: (patch: Partial<CardPrefs>) => void;
}

/** One document, so the loaded collection resolves to the single record the store holds. */
export function resolveCardPrefs(rows: CardPrefs[]): CardPrefs {
  return rows.find((row) => row.id === "feed") ?? DEFAULT_CARD_PREFS;
}

const EMPTY_SLOT: Record<SlotId, "" | null | string[]> = {
  title: "",
  body: "",
  author: null,
  work: null,
  locator: null,
  phonetic: null,
  language: null,
  examples: [],
  synonyms: [],
};

const NO_SCHEDULE = { box: null, nextDue: null, lastReviewed: null } as const;

/** Rule 2 and rule 4 of the schema, applied on the way in so no write can violate them. */
function conformCard(card: Card): Card {
  const declared = CARD_TYPES[card.type].slots;
  const next = { ...card };
  for (const slot of Object.keys(EMPTY_SLOT) as SlotId[]) {
    if (declared[slot]) continue;
    (next as Record<string, unknown>)[slot] = Array.isArray(EMPTY_SLOT[slot])
      ? []
      : EMPTY_SLOT[slot];
  }
  if (!isLearnable(next)) return { ...next, ...NO_SCHEDULE };
  return next;
}

/** Retired sources, kept on state so migration v4 can read them. Never written again (spec §3.1). */
export interface RetiredMindState {
  mindCards: MindCard[];
  mindMeta: MindMetaRecord[];
}

export const createCardsSlice: Slice<CardsSlice & RetiredMindState> = (set, get) => {
  const write = (next: Card) => {
    set((s) => ({ cards: s.cards.map((c) => (c.id === next.id ? next : c)) }));
    savePut("cards", next);
  };

  return {
    cards: [],
    cardPrefs: DEFAULT_CARD_PREFS,
    mindCards: [],
    mindMeta: [],

    addCard: (input) => {
      const card = conformCard({
        ...input,
        id: uid("c_"),
        category: normalizeCategory(input.category),
        updatedAt: "",
        fieldUpdatedAt: {},
      });
      set((s) => ({ cards: [...s.cards, card] }));
      savePut("cards", card);
      return card;
    },

    updateCard: (id, patch) => {
      const card = get().cards.find((c) => c.id === id);
      if (!card) return;
      const merged = { ...card, ...patch, id };
      write(
        conformCard({
          ...merged,
          category: normalizeCategory(merged.category),
          reviewCount: patch.reviewCount ?? card.reviewCount,
        }),
      );
    },

    removeCard: (id) => {
      set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }));
      saveRemove("cards", id);
    },

    restoreCard: (card) => {
      set((s) => ({ cards: [...s.cards.filter((c) => c.id !== card.id), card] }));
      savePut("cards", card);
    },

    hideCard: (id) => get().updateCard(id, { hiddenAt: new Date().toISOString() }),

    toggleCardLike: (id) => {
      const card = get().cards.find((c) => c.id === id);
      if (!card) return;
      get().updateCard(id, { likedAt: card.likedAt === null ? new Date().toISOString() : null });
    },

    setCardLearning: (id, learning) => {
      const card = get().cards.find((c) => c.id === id);
      if (!card) return;
      if (!learning) {
        get().updateCard(id, NO_SCHEDULE);
        return;
      }
      if (!isLearnable(card)) return;
      get().updateCard(id, { box: 1, nextDue: todayISO(), lastReviewed: null });
    },

    promoteCard: (id) => {
      const card = get().cards.find((c) => c.id === id);
      if (!card || !canPromote(card)) return;
      get().updateCard(id, { hasRecall: true });
    },

    gradeCard: (id, correct) => {
      const card = get().cards.find((c) => c.id === id);
      const today = todayISO();
      // Idempotent per day: a released drag that fires twice must not advance two boxes.
      if (!card || card.box === null || card.lastReviewed === today) return;
      get().updateCard(id, {
        ...stepLeitner(card.box, correct, today),
        reviewCount: card.reviewCount + 1,
      });
    },

    setCardPrefs: (patch) => {
      const next: CardPrefs = { ...get().cardPrefs, ...patch, id: "feed" };
      set({ cardPrefs: next });
      savePut("cardPrefs", next);
    },
  };
};
