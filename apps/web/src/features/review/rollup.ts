import type { Habit } from "@/features/habits/model";
import { countHabitSlots } from "@/features/habits/selectors";
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

  const habitRows = ctx.habits
    .filter((habit) => habit.tracked)
    .map((h) => ({ h, ...countHabitSlots(tasks, h, pastIsos, today) }))
    .filter((row) => row.total > 0);

  return { doneByValue: groupDoneByValue(tasks, ctx, pastIsos), habitRows };
}
