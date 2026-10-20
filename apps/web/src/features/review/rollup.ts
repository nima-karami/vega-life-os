import type { Habit } from "@/features/habits/model";
import { type DoneContext, type DoneGroup, groupDoneByValue } from "@/features/tasks/done-groups";
import type { Task } from "@/features/tasks/model";

export interface HabitRow {
  h: Habit;
  done: number;
  total: number;
}

export interface WeekRollup {
  doneByValue: DoneGroup[];
  habitRows: HabitRow[];
}

/**
 * Pure weekly rollup behind the Review section. `weekIsos` is the 7 ISO day-strings
 * of the week; `today` is injected so days that have not happened never count.
 */
export function computeWeekRollup(
  tasks: Task[],
  ctx: DoneContext,
  weekIsos: string[],
  today: string,
): WeekRollup {
  const pastIsos = weekIsos.filter((iso) => iso <= today);
  const weekTasks = tasks.filter((t) => t.date && pastIsos.includes(t.date));

  const habitRows = ctx.habits
    .map((h) => {
      const scheduled = weekTasks.filter((t) => t.habitId === h.id && t.status !== "skip");
      return {
        h,
        done: scheduled.filter((t) => t.status === "done").length,
        total: scheduled.length,
      };
    })
    .filter((row) => row.total > 0);

  return { doneByValue: groupDoneByValue(tasks, ctx, pastIsos), habitRows };
}
