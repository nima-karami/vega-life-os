import {
  CARD_TYPES,
  type Card,
  type CardCreate,
  type CardPrefs,
  canPromote,
  DEFAULT_CARD_PREFS,
  isLearnable,
  type SlotId,
} from "@vega/shared";
import { todayISO } from "@/core/lib/date";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import { stepLeitner } from "./leitner";
import {
  buildMetaId,
  isDerivedId,
  isFlippableByDefault,
  isSameCategory,
  type MindCard,
  type MindMetaRecord,
  normalizeCategory,
} from "./model";

export interface ScrollSlice {
  mindCards: MindCard[];
  mindMeta: MindMetaRecord[];
  addMindCard: (patch?: Partial<MindCard>) => MindCard;
  bulkAddMindCards: (cards: { title: string; body: string; category: string }[]) => void;
  updateMindCard: (id: string, patch: Partial<MindCard>) => void;
  removeMindCard: (id: string) => void;
  hideMindCard: (cardId: string) => void;
  restoreMindCard: (cardId: string) => void;
  setMindCardLearning: (id: string, enabled: boolean) => void;
  toggleMindCardLike: (cardId: string) => void;
  gradeMindCard: (id: string, correct: boolean) => void;
  setScrollToggle: (kind: "category" | "source", key: string, enabled: boolean) => void;
  renameMindCategory: (from: string, to: string) => void;
}

// Absence of a toggle record means enabled — first run needs zero config.
export function isScrollKeyEnabled(
  meta: MindMetaRecord[],
  kind: "category" | "source",
  key: string,
): boolean {
  const record = meta.find((m) => m.id === buildMetaId(kind, key));
  return record ? record.value : true;
}

function buildMindCard(patch: Partial<MindCard>): MindCard {
  const type = patch.type ?? "note";
  return {
    id: patch.id ?? uid("mc_"),
    title: patch.title ?? "",
    body: patch.body ?? "",
    type,
    origin: patch.origin ?? "manual",
    category: normalizeCategory(patch.category ?? ""),
    source: patch.source ?? null,
    addedAt: patch.addedAt ?? todayISO(),
    hiddenAt: patch.hiddenAt ?? null,
    likedAt: patch.likedAt ?? null,
    flippable: patch.flippable ?? isFlippableByDefault(type),
    box: patch.box ?? null,
    lastReviewed: patch.lastReviewed ?? null,
    nextDue: patch.nextDue ?? null,
    updatedAt: "",
    fieldUpdatedAt: {},
  };
}

export const createScrollSlice: Slice<ScrollSlice> = (set, get) => {
  const putMeta = (kind: MindMetaRecord["kind"], key: string, value: boolean) => {
    const record: MindMetaRecord = {
      id: buildMetaId(kind, key),
      kind,
      key: normalizeCategory(key),
      value,
      setAt: new Date().toISOString(),
      updatedAt: "",
      fieldUpdatedAt: {},
    };
    set((s) => ({
      mindMeta: [...s.mindMeta.filter((m) => m.id !== record.id), record],
    }));
    savePut("mindMeta", record);
  };

  return {
    mindCards: [],
    mindMeta: [],

    addMindCard: (patch = {}) => {
      const card = buildMindCard(patch);
      set((s) => ({ mindCards: [...s.mindCards, card] }));
      savePut("mindCards", card);
      return card;
    },
    bulkAddMindCards: (inputs) => {
      const cards = inputs.map(buildMindCard);
      set((s) => ({ mindCards: [...s.mindCards, ...cards] }));
      for (const card of cards) savePut("mindCards", card);
    },
    updateMindCard: (id, patch) => {
      let next: MindCard | undefined;
      set((s) => ({
        mindCards: s.mindCards.map((c) => {
          if (c.id !== id) return c;
          const merged = { ...c, ...patch, id };
          // Learning requires a hidden back to recall — a non-flippable card exits it.
          next = merged.flippable
            ? merged
            : { ...merged, box: null, nextDue: null, lastReviewed: null };
          return next;
        }),
      }));
      if (next) savePut("mindCards", next);
    },
    removeMindCard: (id) => {
      set((s) => ({ mindCards: s.mindCards.filter((c) => c.id !== id) }));
      saveRemove("mindCards", id);
    },
    hideMindCard: (cardId) => {
      if (isDerivedId(cardId)) putMeta("hide", cardId, true);
      else get().updateMindCard(cardId, { hiddenAt: new Date().toISOString() });
    },
    restoreMindCard: (cardId) => {
      if (isDerivedId(cardId)) putMeta("hide", cardId, false);
      else get().updateMindCard(cardId, { hiddenAt: null });
    },
    setMindCardLearning: (id, enabled) => {
      const card = get().mindCards.find((c) => c.id === id);
      if (!card || (enabled && !card.flippable)) return;
      get().updateMindCard(
        id,
        enabled
          ? { box: 1, nextDue: todayISO() }
          : { box: null, nextDue: null, lastReviewed: null },
      );
    },
    toggleMindCardLike: (cardId) => {
      if (isDerivedId(cardId)) {
        const existing = get().mindMeta.find((m) => m.id === buildMetaId("like", cardId));
        putMeta("like", cardId, !(existing?.value ?? false));
        return;
      }
      const card = get().mindCards.find((c) => c.id === cardId);
      if (!card) return;
      get().updateMindCard(cardId, {
        likedAt: card.likedAt === null ? new Date().toISOString() : null,
      });
    },
    gradeMindCard: (id, correct) => {
      const card = get().mindCards.find((c) => c.id === id);
      if (!card || card.box === null) return;
      get().updateMindCard(id, stepLeitner(card.box, correct, todayISO()));
    },
    setScrollToggle: (kind, key, enabled) => putMeta(kind, key, enabled),
    renameMindCategory: (from, to) => {
      const target = normalizeCategory(to);
      for (const card of get().mindCards.filter((c) => isSameCategory(c.category, from))) {
        get().updateMindCard(card.id, { category: target });
      }
      const targetId = buildMetaId("category", target);
      const existingToggle = get().mindMeta.find((m) => m.id === buildMetaId("category", from));
      if (existingToggle && !existingToggle.value) putMeta("category", target, false);
      if (existingToggle && existingToggle.id !== targetId) {
        set((s) => ({ mindMeta: s.mindMeta.filter((m) => m.id !== existingToggle.id) }));
        saveRemove("mindMeta", existingToggle.id);
      }
    },
  };
};

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

export const createCardsSlice: Slice<CardsSlice> = (set, get) => {
  const write = (next: Card) => {
    set((s) => ({ cards: s.cards.map((c) => (c.id === next.id ? next : c)) }));
    savePut("cards", next);
  };

  return {
    cards: [],
    cardPrefs: DEFAULT_CARD_PREFS,

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
