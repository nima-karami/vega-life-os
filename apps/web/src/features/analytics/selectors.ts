import { addDays, format, startOfWeek, subDays } from "date-fns";
import { shiftISO, todayISO } from "@/core/lib/date";
import { type Goal, isGoalClosed } from "@/features/goals/model";
import { getGoalPaceBadge } from "@/features/goals/presentation";
import { computeHabitStreak, computeHabitWindowRate } from "@/features/habits";
import type { Habit } from "@/features/habits/model";
import { getPausedSpans, isHabitPausedOn } from "@/features/habits/paused-spans";
import { isActiveOnSchedule } from "@/features/habits/recurrence";
import { type DayEntry, hasGratitude } from "@/features/journal/model";
import { DEFAULT_RULES, resolveStreak, type SeqItem, type StreakRules } from "@/features/streaks";
import type { Task } from "@/features/tasks/model";

/** Any scheduled task dated within the last n days (inclusive, no future) — gates the
 *  "no activity in this range" hint. */
export function hasTasksInWindow(tasks: Task[], n: number): boolean {
  const today = todayISO();
  const lo = shiftISO(today, -(n - 1));
  return tasks.some((t) => t.date != null && t.date >= lo && t.date <= today);
}

/** Count of completed tasks per value over the last n days inclusive. Future-dated
 *  done tasks are excluded so they can't inflate the balance. */
export function countCompletedByValue(tasks: Task[], n = 30): Record<string, number> {
  const today = todayISO();
  const lo = shiftISO(today, -(n - 1));
  const out: Record<string, number> = {};
  for (const t of tasks) {
    if (t.status !== "done" || !t.date || t.date < lo || t.date > today || !t.valueId) continue;
    out[t.valueId] = (out[t.valueId] ?? 0) + 1;
  }
  return out;
}

export function getCurrentStreakTotal(tasks: Task[]): number {
  return tasks.filter((t) => t.status === "done").length;
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

export interface MoodPoint {
  iso: string;
  label: string;
  /** 1..5, or null when that day has no logged mood (a gap, never charted as 0). */
  mood: number | null;
}

/** Per-day mood over the last n days (oldest first); unlogged days stay null. */
export function computeMoodSeries(journal: DayEntry[], n = 30): MoodPoint[] {
  const byDate = new Map(journal.map((e) => [e.date, e]));
  return Array.from({ length: n }, (_, i) => {
    const d = subDays(new Date(), n - 1 - i);
    const iso = format(d, "yyyy-MM-dd");
    const entry = byDate.get(iso);
    return { iso, label: format(d, "MMM d"), mood: entry?.mood ?? null };
  });
}

/** Collapse a daily mood series into 7-day buckets (used for the year window so the
 *  chart stays readable); a bucket's mood is the mean of its logged days, else null. */
export function downsampleMoodWeekly(series: MoodPoint[]): MoodPoint[] {
  const buckets: MoodPoint[] = [];
  for (let i = 0; i < series.length; i += 7) {
    const chunk = series.slice(i, i + 7);
    const logged = chunk.filter((d) => d.mood != null);
    const mean = logged.length
      ? logged.reduce((sum, d) => sum + (d.mood ?? 0), 0) / logged.length
      : null;
    buckets.push({ iso: chunk[0].iso, label: chunk[0].label, mood: mean });
  }
  return buckets;
}

/** Per scheduled day: done, done-elsewhere (moved), neutral skip, a real miss, still-pending,
 *  or a non-scheduled off-day (shown faint for rhythm). */
export type TimelineKind = "done" | "moved" | "skip" | "miss" | "pending" | "off";

export interface TimelineDay {
  iso: string;
  label: string;
  kind: TimelineKind;
}

export interface HabitTimeline {
  streak: number;
  rate: number;
  done: number;
  missed: number;
  days: TimelineDay[];
}

const habitStatusRank = (status: Task["status"]) =>
  status === "done" ? 3 : status === "skip" ? 2 : 1;

function mapHabitInstancesBySlot(tasks: Task[], habitId: string): Map<string, Task> {
  const bySlot = new Map<string, Task>();
  for (const t of tasks) {
    if (t.habitId !== habitId) continue;
    const slot = t.slotDate ?? t.date;
    if (slot == null) continue;
    const prev = bySlot.get(slot);
    if (!prev || habitStatusRank(t.status) > habitStatusRank(prev.status)) bySlot.set(slot, t);
  }
  return bySlot;
}

function classifyTimelineDay(inst: Task | undefined, iso: string, floor: string): TimelineKind {
  if (inst?.status === "done") return (inst.date ?? iso) !== iso ? "moved" : "done";
  if (inst?.status === "skip" || inst?.status === "open") return "skip";
  return iso >= floor ? "pending" : "miss";
}

/** A habit's per-day report over the last windowDays: each scheduled day classified from
 *  its task instances, plus the headline streak/rate (shared with the rest of the app). */
export function computeHabitTimeline(
  tasks: Task[],
  habit: Habit,
  windowDays = 35,
  today: string = todayISO(),
  rules: StreakRules = DEFAULT_RULES,
): HabitTimeline {
  const bySlot = mapHabitInstancesBySlot(tasks, habit.id);
  const graceFloor = shiftISO(today, -rules.graceDays);
  const windowStart = shiftISO(today, -(windowDays - 1));
  const createdOn = habit.createdAt.slice(0, 10);
  const start = windowStart > createdOn ? windowStart : createdOn;
  const spans = getPausedSpans(habit, tasks);
  const days: TimelineDay[] = [];
  for (let iso = start; iso <= today; iso = shiftISO(iso, 1)) {
    const label = format(new Date(`${iso}T00:00:00`), "MMM d");
    const isPausedUndone = isHabitPausedOn(habit, spans, iso) && bySlot.get(iso)?.status !== "done";
    if (!isActiveOnSchedule(habit.schedule, iso) || isPausedUndone) {
      days.push({ iso, label, kind: "off" });
      continue;
    }
    days.push({ iso, label, kind: classifyTimelineDay(bySlot.get(iso), iso, graceFloor) });
  }
  const window = computeHabitWindowRate(tasks, habit, windowDays, today, rules);
  return {
    streak: computeHabitStreak(tasks, habit, today, rules),
    rate: window.rate,
    done: window.done,
    missed: window.missed,
    days: days.slice(-35),
  };
}

/** A closed goal is terminal (done → Completed, else Closed) and never gets a pace
 *  verdict; an open, in-progress goal carries the shared pace badge so Analytics and
 *  the goal card agree. Reuses `getGoalPaceBadge` / `isGoalClosed`. */
export type GoalVerdict =
  | { kind: "completed" }
  | { kind: "closed" }
  | { kind: "pace"; text: string; isBehind: boolean }
  | { kind: "none" };

export function computeGoalVerdict(goal: Goal, today: string = todayISO()): GoalVerdict {
  if (isGoalClosed(goal.status)) {
    return goal.status === "done" ? { kind: "completed" } : { kind: "closed" };
  }
  const badge = getGoalPaceBadge(goal, today);
  return badge ? { kind: "pace", text: badge.text, isBehind: badge.isBehind } : { kind: "none" };
}

/** Goals whose [start, end] overlaps the last `days` window ending today; a goal
 *  with no timeframe is always shown. Keeps the trajectory card scoped to the window. */
export function getGoalsInWindow(goals: Goal[], days: number, now: string = todayISO()): Goal[] {
  const windowStart = shiftISO(now, -(days - 1));
  return goals.filter((goal) => {
    if (!goal.start || !goal.end) return true;
    return goal.start <= now && goal.end >= windowStart;
  });
}
