import { addDays, format, startOfWeek, subDays } from "date-fns";
import { dowIndex, shiftISO } from "@/core/lib/date";
import type { CalendarEvent } from "@/features/calendar-sync/events-model";
import { computeHabitStreak } from "@/features/habits";
import type { Habit } from "@/features/habits/model";
import { type DayEntry, hasGratitude } from "@/features/journal/model";
import { DEFAULT_RULES, resolveStreak, type SeqItem, type StreakRules } from "@/features/streaks";
import type { Task } from "@/features/tasks/model";

export interface DayStat {
  iso: string;
  label: string;
  done: number;
  total: number;
  rate: number;
}

/** Per-day completion over the last n days (oldest first). */
export function computeDailyStats(tasks: Task[], n = 28): DayStat[] {
  return Array.from({ length: n }, (_, i) => {
    const d = subDays(new Date(), n - 1 - i);
    const iso = format(d, "yyyy-MM-dd");
    const day = tasks.filter((t) => t.date === iso);
    const counted = day.filter((t) => t.status !== "skip");
    const done = day.filter((t) => t.status === "done").length;
    return {
      iso,
      label: format(d, "EEEEE"),
      done,
      total: day.length,
      rate: counted.length ? done / counted.length : 0,
    };
  });
}

/** Overall resolved rate over the last n days (skips excluded). */
export function computeOverallRate(tasks: Task[], n = 30): number {
  const lo = format(subDays(new Date(), n), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const window = tasks.filter(
    (t) => t.date && t.date >= lo && t.date <= today && t.status !== "skip",
  );
  if (!window.length) return 0;
  return window.filter((t) => t.status === "done").length / window.length;
}

/** Count of completed tasks per value over the last n days. */
export function countCompletedByValue(tasks: Task[], n = 28): Record<string, number> {
  const lo = format(subDays(new Date(), n), "yyyy-MM-dd");
  const out: Record<string, number> = {};
  for (const t of tasks) {
    if (t.status !== "done" || !t.date || t.date < lo || !t.valueId) continue;
    out[t.valueId] = (out[t.valueId] ?? 0) + 1;
  }
  return out;
}

/**
 * Per-value lived-event time over the last n days: a value-tagged timed event adds
 * its duration; an all-day tagged event adds one occurrence (no clock-hours). Tagged
 * history (removed in Google) still counts. Additive to the values picture — habit
 * streaks are untouched.
 */
export function computeValueTime(
  events: CalendarEvent[],
  n = 28,
): Record<string, { minutes: number; occurrences: number }> {
  const lo = format(subDays(new Date(), n), "yyyy-MM-dd");
  const out: Record<string, { minutes: number; occurrences: number }> = {};
  for (const e of events) {
    if (!e.valueId || !e.date || e.date < lo) continue;
    const bucket = out[e.valueId] ?? { minutes: 0, occurrences: 0 };
    bucket.occurrences += 1;
    if (!e.allDay) bucket.minutes += e.durationMin;
    out[e.valueId] = bucket;
  }
  return out;
}

export function getCurrentStreakTotal(tasks: Task[]): number {
  return tasks.filter((t) => t.status === "done").length;
}

const DOW_NAME = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const doneRate = (list: Task[]) =>
  list.length ? list.filter((t) => t.status === "done").length / list.length : 0;

function weekdayStrengthInsight(window: Task[]): string | null {
  const byDow = Array.from({ length: 7 }, () => ({ done: 0, total: 0 }));
  for (const t of window) {
    if (!t.date) continue;
    const di = dowIndex(t.date);
    byDow[di].total++;
    if (t.status === "done") byDow[di].done++;
  }
  const dowRanked = byDow
    .map((x, i) => ({ i, rate: x.total ? x.done / x.total : 0, total: x.total }))
    .filter((x) => x.total >= 3)
    .sort((a, b) => b.rate - a.rate);
  if (dowRanked.length >= 3 && dowRanked[0].rate - dowRanked[dowRanked.length - 1].rate >= 0.1) {
    const hi = dowRanked[0];
    const loDay = dowRanked[dowRanked.length - 1];
    return `You follow through most on ${DOW_NAME[hi.i]}s (${Math.round(hi.rate * 100)}%) and least on ${DOW_NAME[loDay.i]}s (${Math.round(loDay.rate * 100)}%).`;
  }
  return null;
}

function timeOfDayInsight(window: Task[]): string | null {
  const morning = window.filter((t) => t.time && parseInt(t.time, 10) < 12);
  const evening = window.filter((t) => t.time && parseInt(t.time, 10) >= 18);
  if (morning.length >= 5 && evening.length >= 5) {
    const morningRate = doneRate(morning);
    const eveningRate = doneRate(evening);
    if (Math.abs(morningRate - eveningRate) >= 0.08) {
      return `${morningRate > eveningRate ? "Mornings" : "Evenings"} stick better — ${Math.round(Math.max(morningRate, eveningRate) * 100)}% vs ${Math.round(Math.min(morningRate, eveningRate) * 100)}% the other way.`;
    }
  }
  return null;
}

function goalLinkInsight(window: Task[]): string | null {
  const goalTasks = window.filter((t) => t.goalId);
  const looseTasks = window.filter((t) => !t.goalId && t.valueId);
  if (goalTasks.length >= 5 && looseTasks.length >= 5) {
    const goalRate = doneRate(goalTasks);
    const looseRate = doneRate(looseTasks);
    if (Math.abs(goalRate - looseRate) >= 0.08) {
      return `${goalRate > looseRate ? "Goal-linked work" : "Goal-less habits"} land more reliably (${Math.round(Math.max(goalRate, looseRate) * 100)}%) than ${goalRate > looseRate ? "goal-less habits" : "goal-linked work"} (${Math.round(Math.min(goalRate, looseRate) * 100)}%).`;
    }
  }
  return null;
}

function strongestChainInsight(tasks: Task[], habits: Habit[], rules: StreakRules): string | null {
  const topChain = habits
    .map((h) => ({ habit: h, streak: computeHabitStreak(tasks, h, undefined, rules) }))
    .sort((a, b) => b.streak - a.streak)[0];
  if (topChain && topChain.streak >= 4) {
    return `Your strongest chain is "${topChain.habit.name}" at ${topChain.streak} days — worth protecting.`;
  }
  return null;
}

/**
 * Deterministic, non-obvious observations from the data — proactive intelligence,
 * no LLM required. Returns up to 4 insight strings (only when there's enough signal).
 */
export function computeInsights(
  tasks: Task[],
  habits: Habit[],
  rules: StreakRules = DEFAULT_RULES,
): string[] {
  const lo = format(subDays(new Date(), 60), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const window = tasks.filter(
    (t) => t.date && t.date >= lo && t.date <= today && t.status !== "skip",
  );
  return [
    weekdayStrengthInsight(window),
    timeOfDayInsight(window),
    goalLinkInsight(window),
    strongestChainInsight(tasks, habits, rules),
  ]
    .filter((line): line is string => line !== null)
    .slice(0, 4);
}

export interface ReflectionStat {
  /** Per-day flags over the window, oldest first. */
  series: { iso: string; on: boolean }[];
  /** Days logged in the window. */
  count: number;
  /** Consecutive days up to today (today not-yet-done doesn't break the chain). */
  streak: number;
  rate: number;
}

export interface ReflectionStats {
  journaled: ReflectionStat;
  gratitude: ReflectionStat;
}

const hasJournalEntry = (entry?: DayEntry): boolean => !!entry && entry.journal.trim() !== "";

/**
 * Streak over FULL history (floored at the first-ever entry, like a habit's createdAt),
 * healed through the shared engine and the active rules. A day within the grace window
 * that isn't logged yet is pending (not a miss); older empty days are misses.
 */
function reflectionStreak(
  byDate: Map<string, DayEntry>,
  pred: (e?: DayEntry) => boolean,
  rules: StreakRules,
  today: string,
): number {
  let earliest: string | null = null;
  for (const d of byDate.keys()) if (earliest === null || d < earliest) earliest = d;
  if (earliest === null) return 0;
  const graceFloor = shiftISO(today, -rules.graceDays);
  const seq: SeqItem[] = [];
  for (let d = earliest; d <= today; d = shiftISO(d, 1)) {
    if (pred(byDate.get(d))) seq.push({ kind: "D", date: d });
    else if (d < graceFloor) seq.push({ kind: "M", date: d });
    // within grace and not yet logged → pending, neither counts nor breaks
  }
  return resolveStreak(seq, rules).count;
}

function reflectionStat(
  byDate: Map<string, DayEntry>,
  n: number,
  pred: (e?: DayEntry) => boolean,
  rules: StreakRules,
  today: string,
): ReflectionStat {
  const series = Array.from({ length: n }, (_, i) => {
    const iso = format(subDays(new Date(), n - 1 - i), "yyyy-MM-dd");
    return { iso, on: pred(byDate.get(iso)) };
  });
  const count = series.filter((d) => d.on).length;
  return {
    series,
    count,
    streak: reflectionStreak(byDate, pred, rules, today),
    rate: n ? count / n : 0,
  };
}

/** Journaling + gratitude tracking: an n-day display window, but streaks over full history. */
export function computeReflectionStats(
  journal: DayEntry[],
  n = 28,
  rules: StreakRules = DEFAULT_RULES,
): ReflectionStats {
  const byDate = new Map(journal.map((e) => [e.date, e]));
  const today = format(new Date(), "yyyy-MM-dd");
  return {
    journaled: reflectionStat(byDate, n, hasJournalEntry, rules, today),
    gratitude: reflectionStat(byDate, n, hasGratitude, rules, today),
  };
}

export interface GridCell {
  iso: string;
  rate: number;
  total: number;
  future: boolean;
}

/** GitHub-style consistency grid: `weeks` columns × 7 day-rows (Mon..Sun). */
export function buildConsistencyGrid(
  tasks: Task[],
  weeks = 22,
): { cols: GridCell[][]; months: { label: string; col: number }[] } {
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const today = format(new Date(), "yyyy-MM-dd");
  const byDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.date) continue;
    const dayTasks = byDate.get(t.date);
    if (dayTasks) dayTasks.push(t);
    else byDate.set(t.date, [t]);
  }

  const cols: GridCell[][] = [];
  const months: { label: string; col: number }[] = [];
  let lastMonth = -1;
  for (let w = weeks - 1; w >= 0; w--) {
    const wkStart = subDays(thisWeekStart, w * 7);
    const colIdx = weeks - 1 - w;
    const col: GridCell[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = format(addDays(wkStart, d), "yyyy-MM-dd");
      const day = byDate.get(iso) ?? [];
      const counted = day.filter((t) => t.status !== "skip");
      const done = day.filter((t) => t.status === "done").length;
      col.push({
        iso,
        rate: counted.length ? done / counted.length : 0,
        total: day.length,
        future: iso > today,
      });
    }
    const m = wkStart.getMonth();
    if (m !== lastMonth) {
      months.push({ label: format(wkStart, "MMM"), col: colIdx });
      lastMonth = m;
    }
    cols.push(col);
  }
  return { cols, months };
}

export interface WeekPoint {
  /** ISO date of the week's Monday. */
  weekStartISO: string;
  /** Short label, e.g. "Jul 6". */
  label: string;
  done: number;
  /** Scheduled (skips excluded) tasks that week. */
  total: number;
  /** done / total, 0 when the week had nothing scheduled. */
  rate: number;
}

/** Weekly follow-through for the last n weeks (oldest first), carrying the raw counts
 *  so the trend chart can label each bar — not just the bare rate. */
export function computeWeeklyTrend(tasks: Task[], n = 12): WeekPoint[] {
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: n }, (_, i) => {
    const wkStart = subDays(thisWeek, (n - 1 - i) * 7);
    const lo = format(wkStart, "yyyy-MM-dd");
    const hi = format(subDays(thisWeek, (n - 2 - i) * 7), "yyyy-MM-dd");
    const wk = tasks.filter((t) => t.date && t.date >= lo && t.date < hi && t.status !== "skip");
    const done = wk.filter((t) => t.status === "done").length;
    return {
      weekStartISO: lo,
      label: format(wkStart, "MMM d"),
      done,
      total: wk.length,
      rate: wk.length ? done / wk.length : 0,
    };
  });
}
