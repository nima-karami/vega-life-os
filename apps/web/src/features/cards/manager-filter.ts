import type { Card, CardTypeId } from "@vega/shared";

export type LearningFilterId = "learning" | "not-learning" | "due";

export interface CardFilterState {
  types: CardTypeId[];
  learning: LearningFilterId[];
  categories: string[];
  /** the Visibility group's one value — checked narrows the list to hidden cards */
  hiddenOnly: boolean;
}

export const EMPTY_CARD_FILTER: CardFilterState = {
  types: [],
  learning: [],
  categories: [],
  hiddenOnly: false,
};

export const LEARNING_FILTERS: readonly { id: LearningFilterId; label: string }[] = [
  { id: "learning", label: "Learning" },
  { id: "not-learning", label: "Not learning" },
  { id: "due", label: "Due today" },
];

export const toCategoryKey = (raw: string): string => raw.trim().toLowerCase();

export function countCheckedFilters(filter: CardFilterState): number {
  return (
    filter.types.length +
    filter.learning.length +
    filter.categories.length +
    (filter.hiddenOnly ? 1 : 0)
  );
}

export function toggleFilterValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((held) => held !== value) : [...values, value];
}

function matchesLearning(card: Card, value: LearningFilterId, today: string): boolean {
  if (value === "learning") return card.box !== null;
  if (value === "not-learning") return card.box === null;
  return card.box !== null && card.nextDue !== null && card.nextDue <= today;
}

export function matchesCardFilter(card: Card, filter: CardFilterState, today: string): boolean {
  if (filter.hiddenOnly && card.hiddenAt === null) return false;
  if (filter.types.length > 0 && !filter.types.includes(card.type)) return false;
  if (
    filter.learning.length > 0 &&
    !filter.learning.some((value) => matchesLearning(card, value, today))
  ) {
    return false;
  }
  if (filter.categories.length > 0) {
    const key = toCategoryKey(card.category);
    if (!filter.categories.some((label) => toCategoryKey(label) === key)) return false;
  }
  return true;
}
