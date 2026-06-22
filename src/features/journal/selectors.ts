import type { Task } from "@/features/tasks/model";
import { dayCounts } from "@/features/tasks/selectors";

/**
 * A day is "reflectable" once it had at least one task and every task is
 * resolved (done or skip). `dayCounts(...).todo` already counts open+todo, i.e.
 * the unresolved remainder. Zero-task days are never reflectable.
 */
export function dayReflectable(tasks: Task[], date: string): boolean {
  const c = dayCounts(tasks, date);
  return c.total > 0 && c.todo === 0;
}
