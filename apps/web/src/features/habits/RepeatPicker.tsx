import { Button, ButtonGroup } from "@heroui/react";
import { format, parseISO } from "date-fns";
import { Select } from "@/core/ui";
import { DayPicker } from "./DayPicker";
import { MonthDayPicker } from "./MonthDayPicker";

export type RepeatMode = "weekly" | "nweekly" | "monthly";
const INTERVAL_OPTIONS = [2, 3, 4, 5, 6, 7, 8];
const MODE_LABEL: Record<RepeatMode, string> = {
  weekly: "Weekly",
  nweekly: "Every N weeks",
  monthly: "Monthly",
};

export function RepeatPicker({
  mode,
  days,
  interval,
  daysOfMonth,
  lastDay,
  nextDate,
  disabled,
  onModeChange,
  onDaysChange,
  onIntervalChange,
  onMonthChange,
}: {
  mode: RepeatMode;
  days: number[];
  interval: number;
  daysOfMonth: number[];
  lastDay: boolean;
  nextDate: string | null;
  disabled?: boolean;
  onModeChange: (m: RepeatMode) => void;
  onDaysChange: (days: number[]) => void;
  onIntervalChange: (n: number) => void;
  onMonthChange: (next: { days: number[]; lastDay: boolean }) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <span className="mb-2.5 block text-xs text-muted">Repeat</span>
        <ButtonGroup>
          {(["weekly", "nweekly", "monthly"] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              aria-pressed={mode === m}
              variant={mode === m ? "primary" : "outline"}
              isDisabled={disabled}
              onPress={() => onModeChange(m)}
            >
              {MODE_LABEL[m]}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {mode === "nweekly" && (
        <div className="space-y-2.5">
          <span className="text-xs text-muted">Repeat every</span>
          <Select
            ariaLabel="Repeat every N weeks"
            value={String(interval)}
            onValueChange={(v) => onIntervalChange(Number(v))}
            options={INTERVAL_OPTIONS.map((n) => ({ value: String(n), label: `${n} weeks` }))}
          />
        </div>
      )}

      {(mode === "weekly" || mode === "nweekly") && (
        <DayPicker value={days} onChange={onDaysChange} disabled={disabled} />
      )}

      {mode === "monthly" && (
        <MonthDayPicker
          days={daysOfMonth}
          lastDay={lastDay}
          onChange={onMonthChange}
          disabled={disabled}
        />
      )}

      <p className="text-xs text-muted">
        {nextDate ? `Next on ${format(parseISO(nextDate), "EEE d MMM")}` : "No upcoming dates"}
      </p>
    </div>
  );
}
