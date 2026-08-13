import { CARD_TYPES, type Card, hasReveal } from "@vega/shared";
import { daysBetween, formatShortDate } from "@/core/lib/date";

export type ReviewControlState = "learning" | "notLearning" | "promotable" | "neverLearnable";

export function getReviewControlState(card: Card): ReviewControlState {
  if (CARD_TYPES[card.type].learnable === false) return "neverLearnable";
  if (card.box !== null) return "learning";
  return hasReveal(card) ? "notLearning" : "promotable";
}

function formatDuePhrase(nextDue: string | null, today: string): string | null {
  if (nextDue === null) return null;
  const days = daysBetween(nextDue, today);
  if (days <= 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

export function buildReviewStatus(card: Card, today: string, variant: "full" | "short"): string {
  const state = getReviewControlState(card);
  if (state === "neverLearnable") return "Not learnable · a prompt is answered, not recalled";
  if (state === "promotable") return "Not in review · hide the body to recall this";

  const added = `added ${formatShortDate(card.addedAt)}`;
  if (state === "notLearning") {
    return variant === "short" ? "Not learning" : `Not learning · ${added}`;
  }

  const parts = [card.lastReviewed === null ? "In review" : "Graded", `box ${card.box}`];
  const due = formatDuePhrase(card.nextDue, today);
  if (due !== null) parts.push(due);
  if (variant === "full") {
    if (card.reviewCount > 0) {
      parts.push(`${card.reviewCount} ${card.reviewCount === 1 ? "review" : "reviews"}`);
    }
    parts.push(added);
  }
  return parts.join(" · ");
}
