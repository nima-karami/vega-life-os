import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import type { Value } from "@/features/values/model";

export interface HabitRow {
  h: Habit;
  rate: number;
  done: number;
  total: number;
}

export interface WeekRollup {
  /** resolved completion rate for the week (0..1), skips excluded */
  completion: number;
  /** completed-task count per value, in value order */
  byValue: { v: Value; n: number }[];
  /** largest per-value count, floored at 1 (for bar scaling) */
  maxV: number;
  /** completed goal-linked tasks, capped */
  wins: Task[];
  /** past-due unresolved tasks (not done, not skip, before today), capped */
  slipped: Task[];
  /** per-habit completion for the week */
  habitRows: HabitRow[];
}

const CAP = 6;

/**
 * Pure weekly rollup — the numbers behind the Review section's "mirror".
 *
 * Extracted verbatim from the prior ReviewPage so the computation is unit-testable
 * and unchanged. `weekIsos` is the 7 ISO day-strings of the week; `today` is the
 * current ISO date (injected for determinism/testability).
 */
export function computeWeekRollup(
  tasks: Task[],
  values: Value[],
  habits: Habit[],
  weekIsos: string[],
  today: string,
): WeekRollup {
  const weekTasks = tasks.filter((t) => t.date && weekIsos.includes(t.date));
  const counted = weekTasks.filter((t) => t.status !== "skip");
  const done = weekTasks.filter((t) => t.status === "done");
  const completion = counted.length ? done.length / counted.length : 0;

  const byValue = values.map((v) => ({
    v,
    n: done.filter((t) => t.valueId === v.id).length,
  }));
  const maxV = Math.max(1, ...byValue.map((x) => x.n));

  const wins = done.filter((t) => t.goalId).slice(0, CAP);
  const slipped = weekTasks
    .filter((t) => (t.date ?? "") < today && t.status !== "done" && t.status !== "skip")
    .slice(0, CAP);

  const habitRows = habits.map((h) => {
    const scheduled = weekTasks.filter((t) => t.habitId === h.id && t.status !== "skip");
    const doneCount = scheduled.filter((t) => t.status === "done").length;
    return {
      h,
      rate: scheduled.length ? doneCount / scheduled.length : 0,
      done: doneCount,
      total: scheduled.length,
    };
  });

  return { completion, byValue, maxV, wins, slipped, habitRows };
}
