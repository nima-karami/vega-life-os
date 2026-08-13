import {
  CARD_TYPES,
  type Card,
  type CardTypeId,
  foldsByDefault,
  isLearnable,
  listTypeSlots,
} from "@vega/shared";

const TEXT_SLOTS = ["title", "body"] as const;
const NULLABLE_SLOTS = ["author", "work", "locator", "phonetic", "language"] as const;
const ARRAY_SLOTS = ["examples", "synonyms"] as const;

/** Only a learnable type that does not already fold has a promotion to carry. */
const canCarryRecall = (nextType: CardTypeId): boolean =>
  CARD_TYPES[nextType].learnable !== false && !foldsByDefault({ type: nextType });

const nextHasRecall = (card: Card, nextType: CardTypeId): boolean =>
  canCarryRecall(nextType) && card.hasRecall;

export function buildTypeChangePatch(card: Card, nextType: CardTypeId): Partial<Card> {
  const declared = new Set(listTypeSlots(nextType).map(([slot]) => slot));
  const patch: Partial<Card> = { type: nextType };
  for (const slot of TEXT_SLOTS) if (!declared.has(slot)) patch[slot] = "";
  for (const slot of NULLABLE_SLOTS) if (!declared.has(slot)) patch[slot] = null;
  for (const slot of ARRAY_SLOTS) if (!declared.has(slot)) patch[slot] = [];

  const hasRecall = nextHasRecall(card, nextType);
  if (!canCarryRecall(nextType) || hasRecall !== card.hasRecall) patch.hasRecall = hasRecall;
  if (!isLearnable({ type: nextType, hasRecall })) {
    patch.box = null;
    patch.nextDue = null;
    patch.lastReviewed = null;
  }
  return patch;
}

export function losesReviewOnTypeChange(card: Card, nextType: CardTypeId): boolean {
  return (
    card.box !== null && !isLearnable({ type: nextType, hasRecall: nextHasRecall(card, nextType) })
  );
}

export function buildTypeChangeConfirmBody(nextType: CardTypeId): string {
  return `This card is in review. Changing to ${CARD_TYPES[nextType].label} ends its schedule.`;
}
