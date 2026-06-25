import { addDays, format, getDate, lastDayOfMonth, parseISO } from "date-fns";
import { daysBetween, dowIndex, todayISO, weekStartOf } from "@/core/lib/date";
import { recurrenceLabel } from "./editor";
import type { Habit, HabitSchedule } from "./model";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const listFmt = new Intl.ListFormat(undefined, { style: "long", type: "conjunction" });

/** The habit's schedule, with a weekly/interval-1 fallback for legacy records. */
export function habitSchedule(h: Habit): HabitSchedule {
  return (
    h.schedule ?? { type: "weekly", days: h.days, interval: 1, anchor: h.createdAt.slice(0, 10) }
  );
}

const weekStartISO = (iso: string) => format(weekStartOf(parseISO(iso)), "yyyy-MM-dd");

/** Is the schedule active on the given ISO date? */
export function isActiveOnSchedule(s: HabitSchedule, iso: string): boolean {
  if (s.type === "weekly") {
    if (s.days[dowIndex(iso)] !== 1) return false;
    if (s.interval <= 1) return true;
    const weeks = Math.abs(daysBetween(weekStartISO(iso), weekStartISO(s.anchor))) / 7;
    return Math.round(weeks) % s.interval === 0;
  }
  const d = parseISO(iso);
  const dom = getDate(d);
  const last = getDate(lastDayOfMonth(d));
  if (s.lastDay && dom === last) return true;
  return s.daysOfMonth.some((n) => Math.min(n, last) === dom);
}

/** Wrapper used by the materializers. */
export function isActiveOn(h: Habit, iso: string): boolean {
  return isActiveOnSchedule(habitSchedule(h), iso);
}

/** First active date ≥ fromIso, scanning up to 400 days; null only for a "Never" schedule. */
export function nextOccurrence(s: HabitSchedule, fromIso: string = todayISO()): string | null {
  let d = parseISO(fromIso);
  for (let i = 0; i < 400; i++) {
    const iso = format(d, "yyyy-MM-dd");
    if (isActiveOnSchedule(s, iso)) return iso;
    d = addDays(d, 1);
  }
  return null;
}

const ordinal = (n: number): string => {
  const suf = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suf[(v - 20) % 10] ?? suf[v] ?? suf[0]}`;
};

/** THE recurrence label for every schedule (card + editor). Supersedes recurrenceLabel. */
export function recurrenceText(s: HabitSchedule): string {
  if (s.type === "monthly") {
    const parts = [...s.daysOfMonth].sort((a, b) => a - b).map(ordinal);
    if (s.lastDay) parts.push("last day");
    if (!parts.length) return "Never";
    return `Monthly on the ${listFmt.format(parts)}`;
  }
  const base = recurrenceLabel(s.days);
  if (s.interval <= 1 || base === "Never") return base;
  const dayList = s.days
    .map((d, i) => (d ? DAY_SHORT[i] : null))
    .filter(Boolean)
    .join(" / ");
  return `Every ${s.interval} weeks on ${dayList}`;
}
