import { format, subDays, startOfWeek } from "date-fns";
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
