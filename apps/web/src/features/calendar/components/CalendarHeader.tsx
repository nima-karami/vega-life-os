import { Button } from "@heroui/react";
import { formatShortDate, type WeekDay } from "@/core/lib/date";
import { Icon } from "@/core/ui";
import { isForeignDisplayZone } from "@/features/calendar-sync/useDisplayZone";
import type { Goal } from "@/features/goals";
import { CalendarFilterButton } from "../CalendarFilterButton";
import { CalendarSync } from "../CalendarSync";

function formatZoneCity(zone: string): string {
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

function formatRangeTitle(compact: boolean, days: WeekDay[], activeDay: WeekDay): string {
  if (compact) return `${activeDay.dow} · ${formatShortDate(activeDay.iso)}`;
  return `${formatShortDate(days[0].iso)}-${formatShortDate(days[6].iso)}`;
}

// Stacked below sm, one guarded row above: the title is a date, so a header that
// could wrap would change height on the weekday's glyph widths alone.
export function CalendarHeader({
  compact,
  days,
  activeDay,
  displayZone,
  focusableGoals,
  onPrev,
  onToday,
  onNext,
}: {
  compact: boolean;
  days: WeekDay[];
  activeDay: WeekDay;
  displayZone: string;
  focusableGoals: Goal[];
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
}) {
  const unit = compact ? "day" : "week";
  return (
    <header className="mb-4 flex flex-col gap-y-2 sm:flex-row sm:items-center sm:gap-x-4">
      <div className="min-w-0 sm:flex-1">
        <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight text-foreground">
          {formatRangeTitle(compact, days, activeDay)}
        </h1>
        {isForeignDisplayZone(displayZone) && (
          <p className="truncate text-xs text-muted">{`Times in ${formatZoneCity(displayZone)}`}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-x-3">
        <CalendarSync />
        <CalendarFilterButton focusableGoals={focusableGoals} />
        <div className="flex items-center gap-1.5">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={`Previous ${unit}`}
            onPress={onPrev}
          >
            <Icon name="chevL" size={16} />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onPress={onToday}
            aria-current={days.some((d) => d.today) ? "date" : undefined}
          >
            Today
          </Button>
          <Button isIconOnly size="sm" variant="ghost" aria-label={`Next ${unit}`} onPress={onNext}>
            <Icon name="chevR" size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
}
