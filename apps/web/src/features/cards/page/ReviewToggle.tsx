import { Button } from "@heroui/react";
import { cx, Icon, useCompact } from "@/core/ui";
import type { ReviewControlState } from "./review-status";

const TOGGLE =
  "h-11 gap-2 whitespace-nowrap px-4 font-medium text-sm sm:h-8 sm:px-3 sm:text-[13px]";

export interface ReviewToggleProps {
  state: ReviewControlState;
  status: string;
  onToggle: () => void;
}

/** The one Review cell: a saved card and an unsaved draft press the same control. */
export function ReviewToggle({ state, status, onToggle }: ReviewToggleProps) {
  const isCompact = useCompact();
  const isDisabled = state === "neverLearnable";
  const isOn = state === "learning";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* `aria-disabled`, never `isDisabled`: prompt greys *in place* and must stay in the a11y
          tree with its pressed state readable — a native `disabled` would remove both. */}
      <Button
        size="sm"
        variant={isOn ? "primary" : "secondary"}
        aria-pressed={isOn}
        aria-disabled={isDisabled}
        onPress={() => {
          if (isDisabled) return;
          onToggle();
        }}
        className={cx(TOGGLE, isDisabled && "border-transparent bg-surface-secondary text-muted")}
      >
        <Icon name="brain" size={isCompact ? 16 : 14} />
        Learning
      </Button>
      <span className="text-[13px] text-muted tabular-nums sm:text-xs">{status}</span>
    </div>
  );
}
