import {
  type CalendarEventCreate,
  type DayEntryCreate,
  partitionToday,
  type TaskCreate,
} from "@vega/shared";

function isEventOnDate(event: CalendarEventCreate, date: string): boolean {
  if (event.status === "cancelled" || event.removedAt || event.pendingDelete || !event.date) {
    return false;
  }
  if (event.date === date) return true;
  if (!event.endDate || event.date > date) return false;
  return (event.time == null || event.durationMin >= 1440) && date <= event.endDate;
}

export function buildDayView<
  Task extends TaskCreate,
  Event extends CalendarEventCreate,
  Journal extends DayEntryCreate,
>(date: string, tasks: Task[], events: Event[], journalEntry: Journal | null) {
  return {
    date,
    tasks: partitionToday(tasks, date),
    calendarEvents: events.filter((event) => isEventOnDate(event, date)),
    journalEntry,
  };
}
