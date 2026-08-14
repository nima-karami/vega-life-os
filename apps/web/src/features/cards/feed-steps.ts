import { CARD_TYPES, type Card, foldsByDefault } from "@vega/shared";
import { daysBetween, formatShortDate } from "@/core/lib/date";
import { stepLeitner } from "./leitner";

export type FeedStepName = "face" | "reveal" | "recall";

const TOP_BOX = 5;

/** Tapping cycles: a card always turns back to its face rather than dead-ending on the last step. */
export function nextFeedStep(
  shape: "open" | "folded" | "graded",
  current: FeedStepName,
): FeedStepName | null {
  if (shape === "open") return null;
  if (current === "face") return "reveal";
  if (current === "reveal") return shape === "graded" ? "recall" : "face";
  return "face";
}

// Deliberately not canPromote: the title clause is left out so an untitled card still
// shows the row, which is what routes it to its Title field (spec §4).
export function offersPromotion(card: Pick<Card, "type" | "hasRecall">): boolean {
  return CARD_TYPES[card.type].learnable !== false && !foldsByDefault(card) && !card.hasRecall;
}

export function describeRecallInterval(box: number, correct: boolean, today: string): string {
  const { nextDue } = stepLeitner(box, correct, today);
  const days = daysBetween(nextDue, today);
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

export function buildRecallMeta(
  card: Pick<Card, "box" | "reviewCount" | "lastReviewed">,
): string[] {
  if (card.box === null) return [];
  const meta = [`BOX ${card.box} OF ${TOP_BOX}`];
  if (card.reviewCount > 0) meta.push(`SEEN ${card.reviewCount}×`);
  if (card.lastReviewed !== null)
    meta.push(`LAST ${formatShortDate(card.lastReviewed).toUpperCase()}`);
  return meta;
}
