import { CARD_TYPES, type Card, type CardTypeId, isLearnable } from "@vega/shared";
import { todayISO } from "@/core/lib/date";
import type { PickerOption } from "./FixedListPicker";

export interface CardRowActions {
  onPatch: (id: string, patch: Partial<Card>) => void;
  /** Type is never patched straight through — the page owes a confirm when review is lost. */
  onTypeChange: (card: Card, nextType: CardTypeId) => void;
  onToggleHidden: (card: Card) => void;
  onToggleSelect: (id: string) => void;
  onOpen: (card: Card) => void;
}

/** Both the row chip and the filter panel read this, so a registry entry reaches both at once. */
export const buildTypeOptions = (
  registry: Record<string, { label: string }> = CARD_TYPES,
): PickerOption[] => Object.entries(registry).map(([id, def]) => ({ id, label: def.label }));

export const buildLearningOptions = (card: Card): PickerOption[] => [
  { id: "learning", label: "Learning", isDisabled: !isLearnable(card) },
  { id: "not-learning", label: "Not learning" },
];

export const buildLearningPatch = (isLearning: boolean): Partial<Card> =>
  isLearning ? { box: 1, nextDue: todayISO() } : { box: null, nextDue: null, lastReviewed: null };
