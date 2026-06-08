import {
  addDays,
  format,
  parseISO,
  startOfWeek,
  differenceInCalendarDays,
  isToday as dfnsIsToday,
} from "date-fns";

export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const todayISO = (ref: Date = new Date()) => format(ref, "yyyy-MM-dd");

export const isoToDate = (s: string) => parseISO(s);

/** Monday-anchored week start for a reference date. */
export const weekStartOf = (ref: Date = new Date()) =>
  startOfWeek(ref, { weekStartsOn: 1 });

export interface WeekDay {
  dow: string;
  dom: number;
  iso: string;
  today: boolean;
  index: number; // 0..6, Mon..Sun
}

export function weekDays(ref: Date = new Date()): WeekDay[] {
  const ws = weekStartOf(ref);
  const today = todayISO(ref);
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

/** Mon..Sun index (0..6) for an ISO date. */
export function dowIndex(isoDate: string): number {
  const d = parseISO(isoDate);
  return (d.getDay() + 6) % 7;
}

export const fmtShort = (isoDate: string) =>
  format(parseISO(isoDate), "MMM d");

export const fmtLong = (isoDate: string) =>
  format(parseISO(isoDate), "EEE · MMM d · yyyy");

export const isToday = (isoDate: string) => dfnsIsToday(parseISO(isoDate));

export const daysBetween = (a: string, b: string) =>
  differenceInCalendarDays(parseISO(a), parseISO(b));

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
