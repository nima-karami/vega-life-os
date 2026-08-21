import { CARD_TYPES, type Card, foldsByDefault } from "@vega/shared";
import { daysBetween } from "@/core/lib/date";
import { stepLeitner } from "./leitner";

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
