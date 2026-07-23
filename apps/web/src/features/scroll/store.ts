import { todayISO } from "@/core/lib/date";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import { stepLeitner } from "./leitner";
import {
  isDerivedId,
  isSameCategory,
  type MindCard,
  type MindMetaRecord,
  metaId,
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
  setMindCardLearning: (id: string, on: boolean) => void;
  gradeMindCard: (id: string, correct: boolean) => void;
  setScrollToggle: (kind: "category" | "source", key: string, enabled: boolean) => void;
  renameMindCategory: (from: string, to: string) => void;
}

/** Absence of a toggle record means enabled — first run needs zero config. */
export function isScrollKeyEnabled(
  meta: MindMetaRecord[],
  kind: "category" | "source",
  key: string,
): boolean {
  const record = meta.find((m) => m.id === metaId(kind, key));
  return record ? record.value : true;
}

function buildMindCard(patch: Partial<MindCard>): MindCard {
  return {
    id: patch.id ?? uid("mc_"),
    title: patch.title ?? "",
    body: patch.body ?? "",
    category: normalizeCategory(patch.category ?? ""),
    source: patch.source ?? null,
    addedAt: patch.addedAt ?? todayISO(),
    hiddenAt: patch.hiddenAt ?? null,
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
      id: metaId(kind, key),
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
          next = { ...c, ...patch, id };
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
    setMindCardLearning: (id, on) => {
      get().updateMindCard(
        id,
        on ? { box: 1, nextDue: todayISO() } : { box: null, nextDue: null, lastReviewed: null },
      );
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
      const targetId = metaId("category", target);
      const old = get().mindMeta.find((m) => m.id === metaId("category", from));
      if (old && !old.value) putMeta("category", target, false);
      if (old && old.id !== targetId) {
        set((s) => ({ mindMeta: s.mindMeta.filter((m) => m.id !== old.id) }));
        saveRemove("mindMeta", old.id);
      }
    },
  };
};
