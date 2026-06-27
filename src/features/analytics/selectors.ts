import { addDays, format, startOfWeek, subDays } from "date-fns";
import { dowIndex } from "@/core/lib/date";
import { habitStreak } from "@/features/habits";
import type { Habit } from "@/features/habits/model";
import { type DayEntry, hasGratitude } from "@/features/journal/model";
import type { Task } from "@/features/tasks/model";

export interface DayStat {
  iso: string;
  label: string;
  done: number;
  total: number;
  rate: number;
}

/** Per-day completion over the last n days (oldest first). */
export function dailyStats(tasks: Task[], n = 28): DayStat[] {
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

/** Weekly follow-through rate for the last n weeks (oldest first). */
export function weeklyRate(tasks: Task[], n = 12): number[] {
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: n }, (_, i) => {
    const wkStart = subDays(thisWeek, (n - 1 - i) * 7);
    const wkEnd = subDays(thisWeek, (n - 2 - i) * 7);
    const lo = format(wkStart, "yyyy-MM-dd");
    const hi = format(wkEnd, "yyyy-MM-dd");
    const wk = tasks.filter((t) => t.date && t.date >= lo && t.date < hi && t.status !== "skip");
    if (!wk.length) return 0;
    return wk.filter((t) => t.status === "done").length / wk.length;
  });
}

/** Overall resolved rate over the last n days (skips excluded). */
export function overallRate(tasks: Task[], n = 30): number {
  const lo = format(subDays(new Date(), n), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const window = tasks.filter(
    (t) => t.date && t.date >= lo && t.date <= today && t.status !== "skip",
  );
  if (!window.length) return 0;
  return window.filter((t) => t.status === "done").length / window.length;
}

/** Count of completed tasks per value over the last n days. */
export function completedByValue(tasks: Task[], n = 28): Record<string, number> {
  const lo = format(subDays(new Date(), n), "yyyy-MM-dd");
  const out: Record<string, number> = {};
  for (const t of tasks) {
    if (t.status !== "done" || !t.date || t.date < lo || !t.valueId) continue;
    out[t.valueId] = (out[t.valueId] ?? 0) + 1;
  }
  return out;
}

export function currentStreakTotal(tasks: Task[]): number {
  return tasks.filter((t) => t.status === "done").length;
}

const DOW_NAME = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const doneRate = (list: Task[]) =>
  list.length ? list.filter((t) => t.status === "done").length / list.length : 0;

/**
 * Deterministic, non-obvious observations from the data — proactive intelligence,
 * no LLM required. Returns up to 4 insight strings (only when there's enough signal).
 */
export function insights(tasks: Task[], habits: Habit[]): string[] {
  const out: string[] = [];
  const lo = format(subDays(new Date(), 60), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const window = tasks.filter(
    (t) => t.date && t.date >= lo && t.date <= today && t.status !== "skip",
  );

  // weekday strength
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
    out.push(
      `You follow through most on ${DOW_NAME[hi.i]}s (${Math.round(hi.rate * 100)}%) and least on ${DOW_NAME[loDay.i]}s (${Math.round(loDay.rate * 100)}%).`,
    );
  }

  // morning vs evening
  const morning = window.filter((t) => t.time && parseInt(t.time, 10) < 12);
  const evening = window.filter((t) => t.time && parseInt(t.time, 10) >= 18);
  if (morning.length >= 5 && evening.length >= 5) {
    const mr = doneRate(morning);
    const er = doneRate(evening);
    if (Math.abs(mr - er) >= 0.08) {
      out.push(
        `${mr > er ? "Mornings" : "Evenings"} stick better — ${Math.round(Math.max(mr, er) * 100)}% vs ${Math.round(Math.min(mr, er) * 100)}% the other way.`,
      );
    }
  }

  // goal-linked vs goal-less work
  const goalT = window.filter((t) => t.goalId);
  const looseT = window.filter((t) => !t.goalId && t.valueId);
  if (goalT.length >= 5 && looseT.length >= 5) {
    const gr = doneRate(goalT);
    const ur = doneRate(looseT);
    if (Math.abs(gr - ur) >= 0.08) {
      out.push(
        `${gr > ur ? "Goal-linked work" : "Goal-less habits"} land more reliably (${Math.round(Math.max(gr, ur) * 100)}%) than ${gr > ur ? "goal-less habits" : "goal-linked work"} (${Math.round(Math.min(gr, ur) * 100)}%).`,
      );
    }
  }

  // strongest chain
  const topChain = habits
    .map((h) => ({ h, s: habitStreak(tasks, h) }))
    .sort((a, b) => b.s - a.s)[0];
  if (topChain && topChain.s >= 4) {
    out.push(
      `Your strongest chain is "${topChain.h.name}" at ${topChain.s} days — worth protecting.`,
    );
  }

  return out.slice(0, 4);
}

// ─── Reflection (journaling + gratitude as built-in daily habits) ────────────

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

const journaledDay = (e?: DayEntry): boolean => !!e && e.journal.trim() !== "";

function reflectionStat(
  byDate: Map<string, DayEntry>,
  n: number,
  pred: (e?: DayEntry) => boolean,
): ReflectionStat {
  const series = Array.from({ length: n }, (_, i) => {
    const iso = format(subDays(new Date(), n - 1 - i), "yyyy-MM-dd");
    return { iso, on: pred(byDate.get(iso)) };
  });
  const count = series.filter((d) => d.on).length;
  let i = series.length - 1;
  // Today not logged yet shouldn't read as a broken streak — start from yesterday.
  if (i >= 0 && !series[i].on) i--;
  let streak = 0;
  for (; i >= 0; i--) {
    if (series[i].on) streak++;
    else break;
  }
  return { series, count, streak, rate: n ? count / n : 0 };
}

/** Journaling + gratitude logged per day over the last n days — habit-style tracking. */
export function reflectionStats(journal: DayEntry[], n = 28): ReflectionStats {
  const byDate = new Map(journal.map((e) => [e.date, e]));
  return {
    journaled: reflectionStat(byDate, n, journaledDay),
    gratitude: reflectionStat(byDate, n, hasGratitude),
  };
}

export interface GridCell {
  iso: string;
  rate: number;
  total: number;
  future: boolean;
}

/** GitHub-style consistency grid: `weeks` columns × 7 day-rows (Mon..Sun). */
export function consistencyGrid(
  tasks: Task[],
  weeks = 22,
): { cols: GridCell[][]; months: { label: string; col: number }[] } {
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const today = format(new Date(), "yyyy-MM-dd");
  const byDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.date) continue;
    const arr = byDate.get(t.date);
    if (arr) arr.push(t);
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
