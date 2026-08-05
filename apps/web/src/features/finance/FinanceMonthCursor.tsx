import { Button } from "@heroui/react";
import { IconButton } from "@/core/ui";
import { formatMonthLabel, shiftMonthKey } from "./month-cursor";

export interface FinanceMonthCursorProps {
  month: string;
  currentMonth: string;
  onChange: (month: string) => void;
}

/** The dashboard's primary axis. The label is its own live region, so a step is announced. */
export function FinanceMonthCursor({ month, currentMonth, onChange }: FinanceMonthCursorProps) {
  return (
    <div className="flex items-center gap-1">
      <IconButton
        name="chevL"
        label="Previous month"
        onPress={() => onChange(shiftMonthKey(month, -1))}
      />
      <span
        aria-live="polite"
        aria-atomic="true"
        className="min-w-[8.5rem] text-center text-sm font-medium text-foreground"
      >
        {formatMonthLabel(month)}
      </span>
      <IconButton
        name="chevR"
        label="Next month"
        onPress={() => onChange(shiftMonthKey(month, 1))}
      />
      {month !== currentMonth && (
        <Button size="sm" variant="ghost" onPress={() => onChange(currentMonth)}>
          This month
        </Button>
      )}
    </div>
  );
}
