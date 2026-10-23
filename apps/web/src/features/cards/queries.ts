import type { Card } from "@vega/shared";
import { matchKey } from "./model";

const collator = new Intl.Collator();

const CARD_TEXT_SLOTS = (card: Card): string[] => [
  card.title,
  card.body,
  card.author ?? "",
  card.work ?? "",
  card.locator ?? "",
  card.phonetic ?? "",
  card.language ?? "",
  ...card.examples,
  ...card.synonyms,
];

/** The category set is derived, never stored: first spelling a card used wins. */
export function listCardCategories(cards: Card[]): string[] {
  const firstSpellingByKey = new Map<string, string>();
  for (const card of cards) {
    const label = card.category.trim();
    if (!label) continue;
    const key = matchKey(label);
    if (!firstSpellingByKey.has(key)) firstSpellingByKey.set(key, label);
  }
  return [...firstSpellingByKey.values()].sort((a, b) => collator.compare(a, b));
}

// A write replaces the card object rather than mutating it, so the cache can never go stale.
const haystackByCard = new WeakMap<Card, string>();

export function getCardHaystack(card: Card): string {
  const cached = haystackByCard.get(card);
  if (cached !== undefined) return cached;
  const haystack = CARD_TEXT_SLOTS(card).join(" ").toLowerCase();
  haystackByCard.set(card, haystack);
  return haystack;
}

export function matchesCardQuery(card: Card, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return getCardHaystack(card).includes(needle);
}
