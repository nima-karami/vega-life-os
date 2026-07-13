import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { type GCalendar, isVegaCalendar, listCalendars } from "@/features/calendar-sync";

/**
 * Pick which Google calendars feed VEGA (multi-select, persisted on toggle).
 * VEGA writes its own task-blocks to a separate auto-created "VEGA" calendar,
 * so your real calendars stay uncluttered — surfaced here as a note.
 */
export function CalendarPicker() {
  const pushToast = useStore((s) => s.pushToast);
  const selected = useStore((s) => s.gcal.readCalendarIds);
  const setReadCalendarIds = useStore((s) => s.setGcalReadCalendarIds);
  const writeId = useStore((s) => s.gcal.writeCalendarId);
  const [calendars, setCalendars] = useState<GCalendar[] | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    listCalendars(false)
      // VEGA's own write-calendar as a read source would be circular
      .then((list) => setCalendars(list.filter((c) => c.id !== writeId && !isVegaCalendar(c))))
      .catch(() => setHasFailed(true));
  }, [writeId]);

  const toggleCalendar = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setReadCalendarIds(next);
    pushToast("Calendar selection saved");
  };

  if (hasFailed)
    return <p className="text-sm text-muted">Couldn’t load your calendars — try Sync now.</p>;
  if (!calendars) return <p className="text-sm text-muted">Loading your calendars…</p>;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">Choose which calendars appear in VEGA.</p>
      <div className="flex flex-col gap-1.5">
        {calendars.map((c) => {
          const isSelected = selected.includes(c.id);
          return (
            <Button
              key={c.id}
              type="button"
              variant={isSelected ? "primary" : "secondary"}
              aria-pressed={isSelected}
              onPress={() => toggleCalendar(c.id)}
              className="justify-start"
            >
              <span
                aria-hidden
                className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: c.backgroundColor ?? "#9aa0a6" }}
              />
              <span className="truncate">{c.summary}</span>
              {c.primary && <span className="ml-1 text-xs text-muted">· primary</span>}
              {isSelected && <Icon name="check" size={14} className="ml-auto" />}
            </Button>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-muted">
        VEGA writes your scheduled tasks to a separate <span className="font-medium">VEGA</span>{" "}
        calendar in Google, so these stay uncluttered.
      </p>
    </div>
  );
}
