import { type Card, canPromote } from "@vega/shared";
import { useTodayISO } from "@/core/lib/clock";
import { useStore } from "@/core/store";
import { useCompact } from "@/core/ui";
import { ReviewToggle } from "./ReviewToggle";
import { buildReviewStatus, getReviewControlState } from "./review-status";

export function ReviewControl({ card }: { card: Card }) {
  const today = useTodayISO();
  const isCompact = useCompact();
  const setCardLearning = useStore((s) => s.setCardLearning);
  const promoteCard = useStore((s) => s.promoteCard);

  const state = getReviewControlState(card);

  const handleToggle = () => {
    if (state === "promotable") {
      if (!canPromote(card)) return;
      promoteCard(card.id);
      setCardLearning(card.id, true);
      return;
    }
    setCardLearning(card.id, state !== "learning");
  };

  return (
    <ReviewToggle
      state={state}
      status={buildReviewStatus(card, today, isCompact ? "short" : "full")}
      onToggle={handleToggle}
    />
  );
}
