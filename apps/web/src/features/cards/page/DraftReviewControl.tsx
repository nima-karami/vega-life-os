import type { Card } from "@vega/shared";
import { useTodayISO } from "@/core/lib/clock";
import { ReviewToggle } from "./ReviewToggle";
import { buildReviewStatus, getReviewControlState } from "./review-status";

export interface DraftReviewControlProps {
  card: Card;
  onToggle: (next: boolean) => void;
}

/** Backed by the draft, not the store: the press records intent, it schedules nothing. */
export function DraftReviewControl({ card, onToggle }: DraftReviewControlProps) {
  const today = useTodayISO();
  const state = getReviewControlState(card);

  return (
    <ReviewToggle
      state={state}
      status={buildReviewStatus(card, today, "draft")}
      onToggle={() => onToggle(state !== "learning")}
    />
  );
}
