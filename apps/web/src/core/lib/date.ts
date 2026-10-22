import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfWeek,
} from "date-fns";

export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const todayISO = (ref: Date = new Date()) => format(ref, "yyyy-MM-dd");

export const localDayOf = (timestamp: string) => todayISO(new Date(timestamp));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(date: string | null | undefined): date is string {
  return !!date && ISO_DATE.test(date) && isValid(parseISO(date));
}

/** Monday-anchored week start for a reference date. */
export const weekStartOf = (ref: Date = new Date()) => startOfWeek(ref, { weekStartsOn: 1 });

export interface WeekDay {
  dow: string;
  dom: number;
  iso: string;
  today: boolean;
  index: number; // 0..6, Mon..Sun
}

export function getWeekDays(ref: Date = new Date(), today: string = todayISO(ref)): WeekDay[] {
  const ws = weekStartOf(ref);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    const dISO = format(d, "yyyy-MM-dd");
    return {
      dow: DOW[i],
      dom: d.getDate(),
      iso: dISO,
      today: dISO === today,
      index: i,
    };
  });
}

/**
 * The Mon-anchored week `offset` weeks from the one holding `todayIso`, which offset 0 is
 * therefore always a column of. Derived per render rather than snapshotted into state on
 * mount: the display zone can resolve after the first paint, and a frozen reference then
 * describes a different week than the day its columns are flagged against.
 */
export function getWeekDaysFor(todayIso: string, offset = 0): WeekDay[] {
  return getWeekDays(addDays(weekStartOf(parseISO(todayIso)), offset * 7), todayIso);
}

/** Mon..Sun index (0..6) for an ISO date. */
export function dowIndex(isoDate: string): number {
  const d = parseISO(isoDate);
  return (d.getDay() + 6) % 7;
}

export const formatShortDate = (isoDate: string) => format(parseISO(isoDate), "MMM d");

export const formatLongDate = (isoDate: string) => format(parseISO(isoDate), "EEE · MMM d · yyyy");

export const daysBetween = (a: string, b: string) =>
  differenceInCalendarDays(parseISO(a), parseISO(b));

/** ISO date shifted by N calendar days (negative steps backward). */
export const shiftISO = (isoDate: string, days: number) =>
  format(addDays(parseISO(isoDate), days), "yyyy-MM-dd");

/**
 * Human label for a date relative to a reference (default today):
 * "Today" / "Tomorrow" / "Yesterday", else the weekday name ("Saturday").
 */
export function formatRelativeDay(isoDate: string, ref: string = todayISO()): string {
  const diff = daysBetween(isoDate, ref);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return format(parseISO(isoDate), "EEEE");
}

/** minutes since midnight from "HH:mm" */
export const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const addMinutes = (time: string, mins: number) => {
  const total = minutesOf(time) + mins;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
