import type { Task } from "@/features/tasks/model";
import { todayISO } from "@/core/lib/date";

export const habitInstances = (tasks: Task[], habitId: string) =>
  tasks
    .filter((t) => t.habitId === habitId && t.date)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1));

/**
 * Consecutive most-recent completed instances (date <= today). "skip" is
 * neutral (doesn't count, doesn't break); first missed "todo" in the past breaks.
 */
export function habitStreak(tasks: Task[], habitId: string): number {
  const today = todayISO();
  const past = habitInstances(tasks, habitId)
    .filter((t) => t.date! <= today)
    .reverse();
  let streak = 0;
  for (const t of past) {
    if (t.status === "done") streak++;
    else if (t.status === "skip") continue;
    else break; // todo/doing in the past = a miss
  }
  return streak;
}

/** done / (done + missed), skips excluded, over past+today instances. */
export function habitRate(tasks: Task[], habitId: string): number {
  const today = todayISO();
  const past = habitInstances(tasks, habitId).filter((t) => t.date! <= today);
  const counted = past.filter((t) => t.status !== "skip");
  if (!counted.length) return 0;
  const done = counted.filter((t) => t.status === "done").length;
  return done / counted.length;
}

/** A small completion history (most recent N), 1=done 0=miss -1=skip. */
export function habitHistory(
  tasks: Task[],
  habitId: string,
  n = 14,
): number[] {
  const today = todayISO();
  return habitInstances(tasks, habitId)
    .filter((t) => t.date! <= today)
    .slice(-n)
    .map((t) => (t.status === "done" ? 1 : t.status === "skip" ? -1 : 0));
}
