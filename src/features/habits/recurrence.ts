import { addDays, format, getDate, lastDayOfMonth, parseISO } from "date-fns";
import { daysBetween, dowIndex, todayISO, weekStartOf } from "@/core/lib/date";
import type { Habit, HabitSchedule } from "./model";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const listFmt = new Intl.ListFormat(undefined, { style: "long", type: "conjunction" });

/** The habit's schedule — the single source of truth (always present post-normalize). */
export function habitSchedule(h: Habit): HabitSchedule {
  return h.schedule;
}

/** A stored/legacy habit shape that may still carry the retired `days`/`recurrence` fields. */
type LegacyHabit = Habit & { days?: number[]; recurrence?: string };

/** Coerce any stored or legacy habit to the consolidated shape: `schedule` present,
 *  no `days`/`recurrence`. Derives weekly/interval-1 from a legacy `days` mask. */
export function normalizeHabit(raw: LegacyHabit): Habit {
  const schedule: HabitSchedule = raw.schedule ?? {
    type: "weekly",
    days: raw.days ?? [1, 1, 1, 1, 1, 1, 1],
    interval: 1,
    anchor: (raw.createdAt ?? todayISO()).slice(0, 10),
  };
  const { days: _days, recurrence: _recurrence, ...rest } = raw;
  void _days;
  void _recurrence;
  return { ...rest, schedule };
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

/** Length-7 Mon..Sun weekday mask; a monthly habit has none (all-zero). */
export function weeklyMask(h: Habit): number[] {
  const s = habitSchedule(h);
  return s.type === "weekly" ? s.days : [0, 0, 0, 0, 0, 0, 0];
}

/** Human label derived from a 7-day mask (Mon..Sun). Used as the weekly base of `recurrenceText`. */
export function recurrenceLabel(days: number[]): string {
  const on = days.map((d, i) => (d ? i : -1)).filter((i) => i >= 0);
  if (on.length === 7) return "Every day";
  if (on.length === 0) return "Never";
  if (on.join() === "0,1,2,3,4") return "Weekdays";
  if (on.join() === "5,6") return "Weekends";
  return on.map((i) => DAY_SHORT[i]).join(" / ");
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

/** Latest active date ≤ fromIso (the scheduled slot a task on `fromIso` most likely
 *  fulfils), scanning back up to 400 days; null only for a "Never" schedule. */
export function slotOnOrBefore(s: HabitSchedule, fromIso: string): string | null {
  let d = parseISO(fromIso);
  for (let i = 0; i < 400; i++) {
    const iso = format(d, "yyyy-MM-dd");
    if (isActiveOnSchedule(s, iso)) return iso;
    d = addDays(d, -1);
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
