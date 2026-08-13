import { CARD_TYPES, type Card } from "@vega/shared";
import { pluralize } from "@/core/lib/plural";
import type { ColumnSort } from "@/core/ui";
import { type CardFilterState, matchesCardFilter } from "./manager-filter";
import { matchesCardQuery } from "./queries";

export type CardSortColumn = "title" | "type" | "category" | "learning" | "addedAt";
export type CardSort = ColumnSort<CardSortColumn>;

export const DEFAULT_CARD_SORT: CardSort = { column: "addedAt", direction: "desc" };

export const CARD_SORT_COLUMNS: readonly { column: CardSortColumn; label: string }[] = [
  { column: "title", label: "Title" },
  { column: "type", label: "Type" },
  { column: "category", label: "Category" },
  { column: "learning", label: "Learning" },
  { column: "addedAt", label: "Added" },
];

export interface CardStats {
  total: number;
  learning: number;
  dueToday: number;
}

const collator = new Intl.Collator();

export const describeCardLearning = (card: Card): string =>
  card.box === null ? "Not learning" : `Learning · box ${card.box}`;

export function computeCardStats(cards: Card[], today: string): CardStats {
  let learning = 0;
  let dueToday = 0;
  for (const card of cards) {
    if (card.box !== null) learning++;
    if (card.box !== null && card.nextDue !== null && card.nextDue <= today) dueToday++;
  }
  return { total: cards.length, learning, dueToday };
}

export function describeCardStats(stats: CardStats, visible: number): string {
  if (visible < stats.total) return `${visible} of ${pluralize(stats.total, "card")} · filtered`;
  return `${pluralize(stats.total, "card")} · ${stats.learning} learning · ${stats.dueToday} due today`;
}

const compareNewest = (a: Card, b: Card): number =>
  b.addedAt.localeCompare(a.addedAt) || b.id.localeCompare(a.id);

const compareLearning = (a: Card, b: Card): number => {
  if ((a.box === null) !== (b.box === null)) return a.box === null ? -1 : 1;
  return (a.box ?? 0) - (b.box ?? 0);
};

const compareByColumn = (column: CardSortColumn, a: Card, b: Card): number => {
  switch (column) {
    case "title":
      return collator.compare(a.title, b.title);
    case "type":
      return collator.compare(CARD_TYPES[a.type].label, CARD_TYPES[b.type].label);
    case "category":
      return collator.compare(a.category, b.category);
    case "learning":
      return compareLearning(a, b);
    case "addedAt":
      return a.addedAt.localeCompare(b.addedAt);
  }
};

export function queryCards(
  cards: Card[],
  options: { query: string; filter: CardFilterState; sort: CardSort; today: string },
): Card[] {
  const rows = cards.filter(
    (card) =>
      matchesCardFilter(card, options.filter, options.today) &&
      matchesCardQuery(card, options.query),
  );
  return rows.sort((a, b) => {
    const ordered = compareByColumn(options.sort.column, a, b);
    return (options.sort.direction === "asc" ? ordered : -ordered) || compareNewest(a, b);
  });
}
