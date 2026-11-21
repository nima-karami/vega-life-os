import type { TaskCreate as Task } from "../entities/task";
import { getDayQueue, isAnytimeHabit, isResolved } from "./task-selectors";

const NO_SETTLING: ReadonlySet<string> = new Set();

export interface TodayGroups<T extends Task = Task> {
  /** open | todo cards — still to do today, sorted by time then order */
  remaining: T[];
  /** done | skip cards — resolved today, sorted by time then order */
  done: T[];
  /** anytime habits still to do — the slim rows under "Anytime today", in the user's order */
  anytime: T[];
  /** resolved anytime habits — slim rows under the Done cards */
  anytimeDone: T[];
}

/**
 * Partition today's queue into the card groups and the Anytime groups, each split at
 * `isResolved` and sorted by `getDayQueue` (time, then order). A resolved task in
 * `settlingIds` stays in its to-do group until its done moment has played out.
 */
export function partitionToday<T extends Task>(
  tasks: T[],
  date: string,
  settlingIds: ReadonlySet<string> = NO_SETTLING,
): TodayGroups<T> {
  const groups: TodayGroups<T> = { remaining: [], done: [], anytime: [], anytimeDone: [] };
  for (const t of getDayQueue(tasks, date)) {
    const isDone = isResolved(t) && !settlingIds.has(t.id);
    if (isAnytimeHabit(t)) (isDone ? groups.anytimeDone : groups.anytime).push(t);
    else (isDone ? groups.done : groups.remaining).push(t);
  }
  return groups;
}
