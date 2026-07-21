import { Button } from "@heroui/react";
import { useStore } from "@/core/store";
import { Icon, Popover } from "@/core/ui";

/** Per-calendar show/hide for the calendar grid; which calendars sync is chosen in Settings. */
export function CalendarsPopover() {
  const status = useStore((s) => s.gcalStatus);
  const setCalendarVisible = useStore((s) => s.setCalendarVisible);
  if (!status?.connected || status.readCalendarIds.length === 0) return null;

  return (
    <Popover
      align="end"
      triggerLabel="Choose visible calendars"
      triggerClassName="rounded-[8px] p-1.5 text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
      triggerContent={<Icon name="layers" size={15} />}
      className="w-64"
    >
      <div className="flex w-full flex-col gap-1.5 p-3">
        <p className="text-xs font-medium text-muted">Calendars</p>
        {status.readCalendarIds.map((calendarId) => {
          const pref = status.calendarPrefs[calendarId] ?? {
            visible: true,
            summary: calendarId,
            color: null,
          };
          return (
            <Button
              key={calendarId}
              type="button"
              size="sm"
              variant={pref.visible ? "primary" : "secondary"}
              aria-pressed={pref.visible}
              onPress={() => setCalendarVisible(calendarId, !pref.visible)}
              className="justify-start"
            >
              <span
                aria-hidden
                className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: pref.color ?? "#9aa0a6" }}
              />
              <span className="truncate">{pref.summary}</span>
              {pref.visible && <Icon name="check" size={14} className="ml-auto" />}
            </Button>
          );
        })}
        <p className="text-xs leading-relaxed text-muted">
          Choose which calendars sync in Settings.
        </p>
      </div>
    </Popover>
  );
}
