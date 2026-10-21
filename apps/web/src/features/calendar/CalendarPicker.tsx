import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { getTrpcClient, type TrpcClient } from "@/core/persistence/trpc-client";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";

type GoogleCalendar = Awaited<ReturnType<TrpcClient["calendar"]["listCalendars"]["query"]>>[number];

/**
 * Pick which Google calendars feed VEGA (multi-select, persisted on toggle).
 * VEGA writes its own task-blocks to a separate auto-created "VEGA" calendar,
 * so your real calendars stay uncluttered — surfaced here as a note. The server's
 * listCalendars already excludes the VEGA write-calendar.
 */
export function CalendarPicker() {
  const pushToast = useStore((s) => s.pushToast);
  const status = useStore((s) => s.gcalStatus);
  const refreshGcalStatus = useStore((s) => s.refreshGcalStatus);
  const selected = status?.readCalendarIds ?? [];
  const [calendars, setCalendars] = useState<GoogleCalendar[] | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTrpcClient()
      .calendar.listCalendars.query()
      .then(setCalendars)
      .catch(() => setHasFailed(true));
  }, []);

  const toggleCalendar = async (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((calendarId) => calendarId !== id)
      : [...selected, id];
    setSaving(true);
    try {
      await getTrpcClient().calendar.setReadCalendars.mutate({ ids: next });
      await refreshGcalStatus();
      pushToast("Calendar selection saved");
    } catch (error) {
      pushToast(
        error instanceof Error && error.message.includes("10")
          ? "At most 10 calendars can sync"
          : "Couldn’t save calendar selection",
      );
    } finally {
      setSaving(false);
    }
  };

  if (hasFailed)
    return <p className="text-sm text-muted">Couldn’t load your calendars. Try Sync now.</p>;
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
              isDisabled={saving}
              onPress={() => void toggleCalendar(c.id)}
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
