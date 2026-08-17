import { Button } from "@heroui/react";
import { Icon } from "@/core/ui";
import { formatMonthLabel, shiftMonthKey } from "./month-cursor";

const STEP_CELL =
  "grid h-9 w-[34px] place-items-center text-muted transition-colors hover:text-foreground";

export interface FinanceMonthCursorProps {
  month: string;
  currentMonth: string;
  onChange: (month: string) => void;
}

/** The page's primary axis, fused into one control. The label is its own live region. */
export function FinanceMonthCursor({ month, currentMonth, onChange }: FinanceMonthCursorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center overflow-hidden rounded-[12px] border border-border bg-surface">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => onChange(shiftMonthKey(month, -1))}
          className={STEP_CELL}
        >
          <Icon name="chevL" size={16} />
        </button>
        <span
          aria-live="polite"
          aria-atomic="true"
          className="px-1.5 text-sm font-medium text-foreground"
        >
          {formatMonthLabel(month)}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => onChange(shiftMonthKey(month, 1))}
          className={STEP_CELL}
        >
          <Icon name="chevR" size={16} />
        </button>
      </div>
      {month !== currentMonth && (
        <Button size="sm" variant="ghost" onPress={() => onChange(currentMonth)}>
          This month
        </Button>
      )}
    </div>
  );
}
