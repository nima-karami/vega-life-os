import {
  type Card,
  type CardCreate,
  type CardTypeId,
  listTypeSlots,
  type SlotId,
} from "@vega/shared";
import { todayISO } from "@/core/lib/date";

export interface CardDraft {
  type: CardTypeId;
  category: string;
  title: string;
  body: string;
  author: string | null;
  work: string | null;
  locator: string | null;
  phonetic: string | null;
  language: string | null;
  examples: string[];
  synonyms: string[];
}

const TEXT_SLOTS = ["title", "body"] as const;
const NULLABLE_SLOTS = ["author", "work", "locator", "phonetic", "language"] as const;
const ARRAY_SLOTS = ["examples", "synonyms"] as const;

export function createEmptyDraft(): CardDraft {
  return {
    type: "note",
    category: "",
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
}

export function toDraft(card: Card): CardDraft {
  return {
    type: card.type,
    category: card.category,
    title: card.title,
    body: card.body,
    author: card.author,
    work: card.work,
    locator: card.locator,
    phonetic: card.phonetic,
    language: card.language,
    examples: card.examples,
    synonyms: card.synonyms,
  };
}

export function readDraftSlot(draft: CardDraft, slot: SlotId): string | string[] {
  return draft[slot] ?? "";
}

export function setDraftSlot(draft: CardDraft, slot: SlotId, value: string | string[]): CardDraft {
  const next = { ...draft };
  if (slot === "examples" || slot === "synonyms") next[slot] = Array.isArray(value) ? value : [];
  else if (slot === "title" || slot === "body") next[slot] = typeof value === "string" ? value : "";
  else next[slot] = typeof value === "string" && value !== "" ? value : null;
  return next;
}

export function changeDraftType(draft: CardDraft, nextType: CardTypeId): CardDraft {
  const declared = new Set(listTypeSlots(nextType).map(([slot]) => slot));
  const next: CardDraft = { ...draft, type: nextType };
  for (const slot of TEXT_SLOTS) if (!declared.has(slot)) next[slot] = "";
  for (const slot of NULLABLE_SLOTS) if (!declared.has(slot)) next[slot] = null;
  for (const slot of ARRAY_SLOTS) if (!declared.has(slot)) next[slot] = [];
  return next;
}

export function isDraftComplete(draft: CardDraft): boolean {
  return listTypeSlots(draft.type).every(([slot, def]) => {
    if (def.required !== true) return true;
    const value = readDraftSlot(draft, slot);
    return Array.isArray(value) ? value.length > 0 : value.trim() !== "";
  });
}

export function toCardCreate(draft: CardDraft): CardCreate {
  return {
    type: draft.type,
    category: draft.category.trim(),
    title: draft.title.trim(),
    body: draft.body,
    author: draft.author,
    work: draft.work,
    locator: draft.locator,
    phonetic: draft.phonetic,
    language: draft.language,
    examples: draft.examples,
    synonyms: draft.synonyms,
    hasRecall: false,
    addedAt: todayISO(),
    hiddenAt: null,
    likedAt: null,
    box: null,
    lastReviewed: null,
    nextDue: null,
    reviewCount: 0,
  };
}

export function toPreviewCard(draft: CardDraft): Card {
  return { id: "draft", ...toCardCreate(draft), updatedAt: "", fieldUpdatedAt: {} };
}
