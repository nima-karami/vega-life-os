import { CARD_TYPES, type Card, type CardTypeId, isLearnable } from "@vega/shared";
import { todayISO } from "@/core/lib/date";
import type { MenuItem } from "@/core/ui";
import type { PickerOption } from "./FixedListPicker";

export interface CardRowActions {
  onPatch: (id: string, patch: Partial<Card>) => void;
  /** Type is never patched straight through — the page owes a confirm when review is lost. */
  onTypeChange: (card: Card, nextType: CardTypeId) => void;
  onToggleHidden: (card: Card) => void;
  onToggleSelect: (id: string) => void;
  onOpen: (card: Card) => void;
  /** Delete is never direct either — the page owns the confirm + undo. */
  onRequestDelete: (card: Card) => void;
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

export const buildDeleteConfirmBody = (card: Card): string =>
  `This removes “${card.title}” from the deck.`;

/** The one place the table row and the gallery tile both build their right-click menu. */
export const buildCardMenuItems = (
  card: Card,
  actions: CardRowActions,
  opts: { isSelected: boolean },
): MenuItem[] => {
  const isHidden = card.hiddenAt !== null;
  const isLearning = card.box !== null;
  return [
    { label: "Open", icon: "arrow-right", onSelect: () => actions.onOpen(card) },
    {
      label: opts.isSelected ? "Deselect" : "Select",
      icon: "check",
      onSelect: () => actions.onToggleSelect(card.id),
    },
    {
      label: isLearning ? "Stop learning" : "Start learning",
      icon: "book",
      disabled: !isLearning && !isLearnable(card),
      onSelect: () => actions.onPatch(card.id, buildLearningPatch(!isLearning)),
    },
    {
      label: isHidden ? "Restore" : "Hide",
      icon: isHidden ? "eye" : "eye-off",
      onSelect: () => actions.onToggleHidden(card),
    },
    {
      label: "Delete",
      icon: "trash",
      danger: true,
      onSelect: () => actions.onRequestDelete(card),
    },
  ];
};
