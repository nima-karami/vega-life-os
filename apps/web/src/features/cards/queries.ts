import { CARD_TYPES, type Card } from "@vega/shared";
import { isSameCategory, matchKey } from "./model";

export type CardFilter = "all" | "learning" | "regular" | "hidden";
export type CardSortColumn = "title" | "type" | "category" | "status" | "addedAt";
export type CardSort = { column: CardSortColumn; direction: "asc" | "desc" };

export const DEFAULT_CARD_SORT: CardSort = { column: "addedAt", direction: "desc" };

const collator = new Intl.Collator();

const matchesFilter = (card: Card, filter: CardFilter): boolean => {
  switch (filter) {
    case "learning":
      return card.box !== null;
    case "regular":
      return card.box === null && card.hiddenAt === null;
    case "hidden":
      return card.hiddenAt !== null;
    default:
      return card.hiddenAt === null;
  }
};

const compareNewest = (a: Card, b: Card): number =>
  b.addedAt.localeCompare(a.addedAt) || b.id.localeCompare(a.id);

const compareStatus = (a: Card, b: Card): number => {
  if ((a.box === null) !== (b.box === null)) return a.box === null ? 1 : -1;
  if (a.box !== null && b.box !== null && a.box !== b.box) return b.box - a.box;
  return 0;
};

const compareByColumn = (column: CardSortColumn, a: Card, b: Card): number => {
  switch (column) {
    case "title":
      return collator.compare(a.title, b.title);
    case "type":
      return collator.compare(CARD_TYPES[a.type].label, CARD_TYPES[b.type].label);
    case "category":
      return collator.compare(a.category, b.category);
    case "status":
      return compareStatus(a, b);
    case "addedAt":
      return a.addedAt.localeCompare(b.addedAt);
  }
};

export function queryCards(
  cards: Card[],
  options: { query: string; filter: CardFilter; sort: CardSort; category: string | null },
): Card[] {
  const normalizedQuery = options.query.trim().toLowerCase();

  const rows = cards.filter((card) => {
    if (!matchesFilter(card, options.filter)) return false;
    if (options.category !== null && !isSameCategory(card.category, options.category)) return false;
    if (normalizedQuery) {
      const haystack = `${card.title} ${card.body}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  });

  return rows.sort((a, b) => {
    const ordered = compareByColumn(options.sort.column, a, b);
    return (options.sort.direction === "asc" ? ordered : -ordered) || compareNewest(a, b);
  });
}

export function computeStats(
  cards: Card[],
  today: string,
): { cards: number; learning: number; dueToday: number } {
  let learning = 0;
  let dueToday = 0;
  for (const card of cards) {
    if (card.box !== null) learning++;
    if (card.nextDue !== null && card.nextDue <= today) dueToday++;
  }
  return { cards: cards.length, learning, dueToday };
}

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

export function matchesCardQuery(card: Card, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return CARD_TEXT_SLOTS(card).join(" ").toLowerCase().includes(needle);
}
