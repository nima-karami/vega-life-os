import { minutesOf, shiftISO } from "@/core/lib/date";

export interface EventTiming {
  date: string | null;
  endDate: string | null;
  time: string | null;
  durationMin: number;
}

/** endDate is honoured for an all-day edit and DERIVED for a timed one — the two must never disagree. */
export function normalizeEventTiming(at: EventTiming): EventTiming {
  if (at.date == null) {
    return { date: null, endDate: null, time: at.time, durationMin: at.durationMin };
  }
  if (at.time == null) {
    const endDate = at.endDate ?? at.date;
    return { ...at, endDate: endDate < at.date ? at.date : endDate };
  }
  // Math.max keeps a zero-duration 00:00 block off the previous day.
  const lastMinute = minutesOf(at.time) + Math.max(at.durationMin, 1) - 1;
  return { ...at, endDate: shiftISO(at.date, Math.floor(lastMinute / 1440)) };
}
