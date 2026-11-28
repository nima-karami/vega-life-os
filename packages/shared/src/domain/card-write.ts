import type { Card } from "../entities/card";
import { isLearnable } from "../entities/card-rules";
import { CARD_TYPES, type SlotId } from "../entities/card-types";
export const normalizeCategory = (raw: string) => raw.trim();
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

export const NO_SCHEDULE = { box: null, nextDue: null, lastReviewed: null } as const;

/** Rule 2 and rule 4 of the schema, applied on the way in so no write can violate them. */
export function conformCard(card: Card): Card {
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

export function conformCardWrite(card: Card) {
  return conformCard({ ...card, category: normalizeCategory(card.category) });
}
