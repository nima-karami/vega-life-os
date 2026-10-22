import type { ReactNode } from "react";
import { formatLongDate, formatRelativeDay } from "@/core/lib/date";
import { CalendarPopover, Icon, IconButton } from "@/core/ui";
import { describeDay } from "../today-logic";

export function TodayHeader({
  viewDate,
  today,
  taskCount,
  eventCount,
  onViewDateChange,
  onStepViewDate,
  action,
}: {
  viewDate: string;
  today: string;
  taskCount: number;
  eventCount: number;
  onViewDateChange: (date: string) => void;
  onStepViewDate: (delta: number) => void;
  action: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
      <p className="text-sm text-muted">{formatLongDate(viewDate)}</p>
      <div className="flex items-center gap-0.5 justify-self-end">
        <IconButton
          name="chevL"
          size={18}
          label="Previous day"
          onPress={() => onStepViewDate(-1)}
        />
        <CalendarPopover
          value={viewDate}
          onChange={(v) => v && onViewDateChange(v)}
          showClear={false}
          align="end"
          triggerLabel="Pick a date"
          triggerClassName="inline-grid h-8 w-8 place-items-center rounded-[8px] text-muted outline-none transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          triggerContent={<Icon name="calendar" size={16} />}
        />
        <IconButton name="chevR" size={18} label="Next day" onPress={() => onStepViewDate(1)} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {formatRelativeDay(viewDate, today)}
      </h1>
      <div className="justify-self-end">{action}</div>
      <div className="col-span-2 flex items-center gap-2">
        <p className="text-sm text-muted">{describeDay(taskCount, eventCount)}</p>
        {viewDate !== today && (
          <button
            type="button"
            onClick={() => onViewDateChange(today)}
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Jump to today
          </button>
        )}
      </div>
    </header>
  );
}
