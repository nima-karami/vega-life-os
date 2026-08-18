import { Button } from "@heroui/react";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { buildCalendarRows } from "./filter-model";

/** Per-calendar show/hide for the calendar grid; which calendars sync is chosen in Settings. */
export function CalendarsSection() {
  const status = useStore((s) => s.gcalStatus);
  const setCalendarVisible = useStore((s) => s.setCalendarVisible);
  const rows = buildCalendarRows(status);
  if (rows.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <p className="text-xs font-medium text-muted">Calendars</p>
      {rows.map((row) => (
        <Button
          key={row.id}
          type="button"
          size="sm"
          variant={row.isVisible ? "primary" : "secondary"}
          aria-pressed={row.isVisible}
          onPress={() => setCalendarVisible(row.id, !row.isVisible)}
          className="justify-start"
        >
          <span
            aria-hidden
            className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: row.color ?? "#9aa0a6" }}
          />
          <span className="truncate">{row.summary}</span>
          {row.isVisible && <Icon name="check" size={14} className="ml-auto" />}
        </Button>
      ))}
      <p className="text-xs leading-relaxed text-muted">Choose which calendars sync in Settings.</p>
    </div>
  );
}
