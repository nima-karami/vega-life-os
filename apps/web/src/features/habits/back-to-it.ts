import type { Task } from "@/features/tasks/model";
import { type Habit, isHabitActive } from "./model";
import { hasLapsedPreviousSlot } from "./selectors";

/** Today's open instance of a tracked, active habit whose previous slot lapsed. */
export function shouldNudgeBackToIt(
  task: Task,
  habit: Habit | undefined,
  tasks: Task[],
  today: string,
): boolean {
  if (!habit?.tracked || !isHabitActive(habit)) return false;
  if (task.date !== today || task.status !== "todo") return false;
  return hasLapsedPreviousSlot(tasks, habit, today);
}
