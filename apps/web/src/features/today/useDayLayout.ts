import { useMemo } from "react";
import { useStore } from "@/core/store";
import { useCalendarAutoRefresh } from "@/features/calendar/useCalendarAutoRefresh";
import { filterVisibleEvents } from "@/features/calendar-sync";
import type { Task } from "@/features/tasks/model";
import { type DayLayout, layoutDay } from "./today-logic";

/**
 * The day's remaining rows with lived Google events folded in. Events are sourced
 * exactly as /calendar sources them — the global toggle, then per-calendar
 * visibility — so the two surfaces can never disagree, and a disconnected account
 * gets the task-only layout Today has always had.
 */
export function useDayLayout(
  remaining: Task[],
  date: string,
): { layout: DayLayout; eventCount: number } {
  const calendarEvents = useStore((s) => s.calendarEvents);
  const calendarPrefs = useStore((s) => s.gcalStatus?.calendarPrefs);
  const showGoogleEvents = useStore((s) => s.showGoogleEvents);
  useCalendarAutoRefresh();

  const visibleEvents = useMemo(
    () => (showGoogleEvents ? filterVisibleEvents(calendarEvents, calendarPrefs ?? {}) : []),
    [calendarEvents, calendarPrefs, showGoogleEvents],
  );

  return useMemo(() => {
    const layout = layoutDay(remaining, visibleEvents, date);
    const timedEvents = layout.timedRows.filter((r) => r.kind === "event").length;
    return { layout, eventCount: layout.allDay.length + timedEvents };
  }, [remaining, visibleEvents, date]);
}
