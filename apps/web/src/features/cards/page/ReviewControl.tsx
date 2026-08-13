import { Button } from "@heroui/react";
import { type Card, canPromote } from "@vega/shared";
import { useTodayISO } from "@/core/lib/clock";
import { useStore } from "@/core/store";
import { cx, Icon, useCompact } from "@/core/ui";
import { buildReviewStatus, getReviewControlState } from "./review-status";

const TOGGLE =
  "h-11 gap-2 whitespace-nowrap px-4 font-medium text-sm sm:h-8 sm:px-3 sm:text-[13px]";

export function ReviewControl({ card }: { card: Card }) {
  const today = useTodayISO();
  const isCompact = useCompact();
  const setCardLearning = useStore((s) => s.setCardLearning);
  const promoteCard = useStore((s) => s.promoteCard);

  const state = getReviewControlState(card);
  const isDisabled = state === "neverLearnable";
  const isOn = state === "learning";

  const handlePress = () => {
    if (isDisabled) return;
    if (state === "promotable") {
      if (!canPromote(card)) return;
      promoteCard(card.id);
      setCardLearning(card.id, true);
      return;
    }
    setCardLearning(card.id, !isOn);
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* `aria-disabled`, never `isDisabled`: prompt greys *in place* and must stay in the a11y
          tree with its pressed state readable — a native `disabled` would remove both. */}
      <Button
        size="sm"
        variant={isOn ? "primary" : "secondary"}
        aria-pressed={isOn}
        aria-disabled={isDisabled}
        onPress={handlePress}
        className={cx(TOGGLE, isDisabled && "border-transparent bg-surface-secondary text-muted")}
      >
        <Icon name="brain" size={isCompact ? 16 : 14} />
        Learning
      </Button>
      <span className="text-[13px] text-muted tabular-nums sm:text-xs">
        {buildReviewStatus(card, today, isCompact ? "short" : "full")}
      </span>
    </div>
  );
}
