import {
  type CalendarEventCreate,
  type DayEntryCreate,
  dedupeForDisplay,
  getAllDayLivedForDay,
  getTimedLivedForDay,
  partitionToday,
  type TaskCreate,
} from "@vega/shared";

function selectDayEvents<Event extends CalendarEventCreate>(
  events: Event[],
  date: string,
): Event[] {
  const visible = dedupeForDisplay(events);
  return [...getAllDayLivedForDay(visible, date), ...getTimedLivedForDay(visible, date)];
}

export function buildDayView<
  Task extends TaskCreate,
  Event extends CalendarEventCreate,
  Journal extends DayEntryCreate,
>(date: string, tasks: Task[], events: Event[], journalEntry: Journal | null) {
  return {
    date,
    tasks: partitionToday(tasks, date),
    calendarEvents: selectDayEvents(events, date),
    journalEntry,
  };
}
